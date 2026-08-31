import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';

import { getChatGPTUser } from '@/app/chatgpt-auth';
import {
  createActivationToken,
  hashActivationCode,
  hashActivationToken,
  isActivationCodeFormat,
  normalizeActivationCode,
} from '@/lib/activation-codes';
import { ACTIVATION_COOKIE_NAME } from '@/lib/activation-session';
import { ensureDatabase } from '@/lib/d1';

// A video upload can take a while on a mobile connection.  Keep the activation
// lease aligned with the upload session, while still making it short-lived.
const SESSION_TTL_SECONDS = 2 * 60 * 60;

type ActivationCodeRow = {
  id: string;
  status: 'unused' | 'used';
  template_id: string | null;
};

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function codeFromBody(value: unknown) {
  if (!value || typeof value !== 'object' || !('code' in value) || typeof value.code !== 'string') {
    return '';
  }
  return normalizeActivationCode(value.code);
}

function guestOwner() {
  const id = crypto.randomUUID();
  return {
    userId: `guest-${id}`,
    email: `guest-${id}@activation.davetly.invalid`,
    displayName: 'Davetiye müşterisi',
  };
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const code = codeFromBody(body);
  if (!isActivationCodeFormat(code)) {
    return NextResponse.json({ error: 'Kod biçimi geçersiz. PDF’deki WED-XXXX-XXXX-XXXX kodunu girin.' }, { status: 422 });
  }

  await ensureDatabase();
  // PDF alıcısının ayrıca uygulamaya giriş yapması gerekmez. Oturum açmışsa
  // mevcut hesabına, değilse yalnızca bu aktivasyon için geçici bir kullanıcıya
  // bağlanır. Asıl yetki her zaman HttpOnly aktivasyon çerezindedir.
  const user = (await getChatGPTUser()) ?? guestOwner();

  const codeHash = await hashActivationCode(code);
  const activationCode = await env.DB.prepare(`SELECT id, status, template_id FROM activation_codes
    WHERE code_hash = ? LIMIT 1`).bind(codeHash).first<ActivationCodeRow>();
  if (!activationCode) {
    return NextResponse.json({ error: 'Bu aktivasyon kodu geçerli değil. PDF’deki kodu kontrol edin.' }, { status: 404 });
  }
  if (activationCode.status === 'used') {
    return NextResponse.json({ error: 'Bu aktivasyon kodu daha önce bir davetiye için kullanılmış.' }, { status: 409 });
  }

  const activationToken = createActivationToken();
  const tokenHash = await hashActivationToken(activationToken);
  const sessionId = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const results = await env.DB.batch([
    env.DB.prepare(`INSERT INTO app_users (id, email, display_name)
      VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email,
      display_name = excluded.display_name`)
      .bind(user.userId, user.email.toLowerCase(), user.displayName),
    env.DB.prepare(`UPDATE activation_sessions SET status = 'expired'
      WHERE code_id = ? AND status = 'active' AND expires_at <= unixepoch()`)
      .bind(activationCode.id),
    env.DB.prepare(`INSERT INTO activation_sessions (
        id, code_id, owner_user_id, token_hash, status, expires_at
      ) SELECT ?, id, ?, ?, 'active', ? FROM activation_codes
      WHERE id = ? AND status = 'unused'`).bind(
      sessionId, user.userId, tokenHash, expiresAt, activationCode.id,
    ),
  ]);

  if (results[2]?.meta.changes !== 1) {
    const current = await env.DB.prepare(`SELECT status FROM activation_codes WHERE id = ?`)
      .bind(activationCode.id).first<{ status: 'unused' | 'used' }>();
    const error = current?.status === 'used'
      ? 'Bu aktivasyon kodu başka bir cihazda kullanıldı.'
      : 'Kod şu anda doğrulanamadı. Lütfen tekrar deneyin.';
    return NextResponse.json({ error }, { status: 409 });
  }

  const response = NextResponse.json({
    ok: true,
    templateId: activationCode.template_id,
    expiresInSeconds: SESSION_TTL_SECONDS,
  });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set({
    name: ACTIVATION_COOKIE_NAME,
    value: activationToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
