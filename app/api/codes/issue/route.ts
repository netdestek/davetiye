import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';

import { ensureConfiguredAdmin, getChatGPTUser } from '@/app/chatgpt-auth';
import { createActivationCode, hashActivationCode } from '@/lib/activation-codes';
import { ensureDatabase } from '@/lib/d1';

type IssueBody = { orderReference?: unknown; templateId?: unknown };

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
  }

  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Giriş yapmalısınız.' }, { status: 401 });
  if (!(await ensureConfiguredAdmin(user))) {
    return NextResponse.json({ error: 'Aktivasyon kodu oluşturma yetkiniz yok.' }, { status: 403 });
  }

  let body: IssueBody;
  try {
    body = await request.json() as IssueBody;
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const orderReference = cleanText(body.orderReference);
  const templateId = cleanText(body.templateId);
  if (orderReference.length < 2 || orderReference.length > 120 || templateId.length > 100) {
    return NextResponse.json({ error: 'Sipariş referansını ve şablon bilgisini kontrol edin.' }, { status: 422 });
  }

  await ensureDatabase();
  const account = await env.DB.prepare(`SELECT role FROM app_users WHERE id = ? LIMIT 1`)
    .bind(user.userId).first<{ role: string }>();
  if (account?.role !== 'admin') {
    return NextResponse.json({ error: 'Aktivasyon kodu oluşturma yetkiniz yok.' }, { status: 403 });
  }

  const existing = await env.DB.prepare(`SELECT id, status FROM activation_codes
    WHERE order_reference = ? LIMIT 1`).bind(orderReference)
    .first<{ id: string; status: 'unused' | 'used' }>();
  if (existing) {
    return NextResponse.json({
      error: 'Bu sipariş için daha önce bir aktivasyon kodu oluşturuldu. Güvenlik nedeniyle kod yeniden gösterilemez.',
    }, { status: 409 });
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createActivationCode();
    const codeHash = await hashActivationCode(code);
    const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO activation_codes (
      id, code_hash, status, order_reference, template_id
    ) VALUES (?, ?, 'unused', ?, ?)`)
      .bind(crypto.randomUUID(), codeHash, orderReference, templateId || null).run();
    if (inserted.meta.changes === 1) {
      const response = NextResponse.json({ ok: true, code, orderReference, templateId: templateId || null }, { status: 201 });
      // The plaintext code is shown exactly once and must never be cached by a browser or proxy.
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    const duplicateOrder = await env.DB.prepare(`SELECT id FROM activation_codes
      WHERE order_reference = ? LIMIT 1`).bind(orderReference).first<{ id: string }>();
    if (duplicateOrder) {
      return NextResponse.json({
        error: 'Bu sipariş için daha önce bir aktivasyon kodu oluşturuldu. Güvenlik nedeniyle kod yeniden gösterilemez.',
      }, { status: 409 });
    }
  }

  return NextResponse.json({ error: 'Yeni kod oluşturulamadı. Lütfen tekrar deneyin.' }, { status: 503 });
}
