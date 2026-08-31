import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import {
  ACTIVATION_COOKIE_NAME,
  getActivationSessionFailureReason,
  getActiveActivationSession,
} from '@/lib/activation-session';
import { ensureDatabase, hashPublicToken } from '@/lib/d1';

type InvitationBody = {
  hostNames?: unknown;
  eventAt?: unknown;
  venueName?: unknown;
  venueAddress?: unknown;
  description?: unknown;
  videoKey?: unknown;
  posterKey?: unknown;
};

type MediaKind = 'video' | 'poster';

const MEDIA_RULES = {
  video: {
    maxBytes: 250 * 1024 * 1024,
    contentTypes: new Set(['video/mp4', 'video/webm']),
  },
  poster: {
    maxBytes: 10 * 1024 * 1024,
    contentTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
  },
};

function createToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function validateOwnedMedia(key: string, kind: MediaKind, userId: string) {
  const prefix = `uploads/${encodeURIComponent(userId)}/`;
  if (!key.startsWith(prefix) || key.includes('..')) return false;

  const session = await env.DB.prepare(`SELECT expected_size, content_type FROM media_uploads
    WHERE object_key = ? AND owner_user_id = ? AND kind = ?
    AND status IN ('completed','attached') LIMIT 1`)
    .bind(key, userId, kind).first<{ expected_size: number; content_type: string }>();
  if (!session) return false;

  const object = await env.FILES.head(key);
  if (!object) return false;
  const contentType = object.httpMetadata?.contentType ?? '';
  return object.customMetadata?.ownerUserId === userId &&
    object.customMetadata?.mediaKind === kind &&
    object.size === session.expected_size && object.size <= MEDIA_RULES[kind].maxBytes &&
    contentType === session.content_type &&
    MEDIA_RULES[kind].contentTypes.has(contentType);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'İstek kaynağı doğrulanamadı.' }, { status: 403 });
  }
  await ensureDatabase();
  const user = await getActiveActivationSession(request);
  if (!user) {
    const reason = await getActivationSessionFailureReason(request);
    if (reason === 'used') {
      return NextResponse.json({ error: 'Bu aktivasyon kodu başka bir davetiye için kullanılmış.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Aktivasyon oturumunuz geçersiz veya sona ermiş. PDF’deki kodu yeniden girin.' }, { status: 409 });
  }

  let body: InvitationBody;
  try {
    body = await request.json() as InvitationBody;
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const hostNames = textValue(body.hostNames);
  const eventAt = textValue(body.eventAt);
  const venueName = textValue(body.venueName);
  const venueAddress = textValue(body.venueAddress);
  const description = textValue(body.description);
  const videoKey = textValue(body.videoKey);
  const posterKey = textValue(body.posterKey);
  if (hostNames.length < 2 || hostNames.length > 120 || !eventAt ||
      Number.isNaN(Date.parse(eventAt)) || venueName.length < 2 || venueName.length > 160 ||
      venueAddress.length > 300 || description.length > 300) {
    return NextResponse.json({ error: 'Etkinlik adı, tarihi ve mekân bilgilerini kontrol edin.' }, { status: 422 });
  }
  if (!videoKey || !(await validateOwnedMedia(videoKey, 'video', user.userId))) {
    return NextResponse.json({ error: 'Yayınlanabilir bir video yükleyin.' }, { status: 422 });
  }
  if (posterKey && !(await validateOwnedMedia(posterKey, 'poster', user.userId))) {
    return NextResponse.json({ error: 'Kapak görseli doğrulanamadı.' }, { status: 422 });
  }

  const token = createToken();
  const tokenHash = await hashPublicToken(token);
  const invitationId = crypto.randomUUID();
  const email = user.email.toLowerCase();
  const mapUrl = venueAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueAddress)}`
    : null;

  let results: D1Result[];
  try {
    results = await env.DB.batch([
      env.DB.prepare(`INSERT INTO app_users (id, email, display_name)
      VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email,
      display_name = excluded.display_name`).bind(user.userId, email, user.displayName),
      // D1 batches are transactional. Reserving the code first means that only one
      // concurrent request can reach the invitation insert; a later statement failure
      // rolls this update back together with the rest of the batch.
      env.DB.prepare(`UPDATE activation_codes
        SET status = 'used', used_at = unixepoch(), used_by_user_id = ?, invitation_id = ?
        WHERE id = ? AND status = 'unused' AND used_at IS NULL AND invitation_id IS NULL
          AND EXISTS (
            SELECT 1 FROM activation_sessions
            WHERE id = ? AND code_id = activation_codes.id AND owner_user_id = ? AND token_hash = ?
              AND status = 'active' AND expires_at > unixepoch()
          )`).bind(user.userId, invitationId, user.codeId, user.id, user.userId, user.tokenHash),
      env.DB.prepare(`INSERT INTO invitations (
      id, owner_user_id, title, host_names, event_at, venue_name, venue_address,
      map_url, description, video_key, poster_key, public_token_hash, activation_code_id, status
    ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, id, 'published'
      FROM activation_codes
      WHERE id = ? AND status = 'used' AND invitation_id = ? AND used_by_user_id = ?`).bind(
        invitationId, user.userId, 'Özel davet', hostNames, eventAt,
        venueName, venueAddress || null, mapUrl, description || null, videoKey,
        posterKey || null, tokenHash, user.codeId, invitationId, user.userId,
      ),
      env.DB.prepare(`UPDATE activation_sessions SET
        status = CASE WHEN id = ? THEN 'redeemed' ELSE 'revoked' END,
        redeemed_at = CASE WHEN id = ? THEN unixepoch() ELSE redeemed_at END
      WHERE code_id = ? AND status = 'active'
        AND EXISTS (SELECT 1 FROM invitations WHERE id = ? AND owner_user_id = ?)`)
        .bind(user.id, user.id, user.codeId, invitationId, user.userId),
      env.DB.prepare(`UPDATE media_uploads SET status = 'attached', updated_at = unixepoch()
      WHERE object_key = ? AND owner_user_id = ? AND status IN ('completed','attached')
        AND EXISTS (SELECT 1 FROM invitations WHERE id = ? AND owner_user_id = ?)`)
        .bind(videoKey, user.userId, invitationId, user.userId),
      ...(posterKey ? [env.DB.prepare(`UPDATE media_uploads SET status = 'attached', updated_at = unixepoch()
      WHERE object_key = ? AND owner_user_id = ? AND status IN ('completed','attached')
        AND EXISTS (SELECT 1 FROM invitations WHERE id = ? AND owner_user_id = ?)`)
        .bind(posterKey, user.userId, invitationId, user.userId)] : []),
    ]);
  } catch {
    const current = await env.DB.prepare(`SELECT status FROM activation_codes WHERE id = ? LIMIT 1`)
      .bind(user.codeId).first<{ status: 'unused' | 'used' }>();
    if (current?.status === 'used') {
      return NextResponse.json({ error: 'Bu aktivasyon kodu başka bir cihazda kullanıldı.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Davetiye kaydedilemedi. Aktivasyon kodunuz kullanılmadı; tekrar deneyin.' }, { status: 503 });
  }

  if (!results[1]?.meta.changes || !results[2]?.meta.changes) {
    const current = await env.DB.prepare(`SELECT status FROM activation_codes WHERE id = ? LIMIT 1`)
      .bind(user.codeId).first<{ status: 'unused' | 'used' }>();
    const error = current?.status === 'used'
      ? 'Bu aktivasyon kodu başka bir cihazda kullanıldı.'
      : 'Aktivasyon kodu doğrulanamadı. PDF’deki kodu yeniden girin.';
    return NextResponse.json({ error }, { status: 409 });
  }

  const url = new URL(`/davet/${token}`, request.url).toString();
  const response = NextResponse.json({ ok: true, invitationId, token, url }, { status: 201 });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set({
    name: ACTIVATION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:',
    path: '/',
    maxAge: 0,
  });
  return response;
}
