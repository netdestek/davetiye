import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase, hashPublicToken } from '@/lib/d1';

type InvitationBody = {
  hostNames?: string;
  eventAt?: string;
  venueName?: string;
  venueAddress?: string;
  description?: string;
  videoKey?: string;
  audioKey?: string;
};

function createToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Devam etmek için giriş yapın.' }, { status: 401 });

  let body: InvitationBody;
  try {
    body = await request.json() as InvitationBody;
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const hostNames = body.hostNames?.trim() ?? '';
  const eventAt = body.eventAt?.trim() ?? '';
  if (hostNames.length < 2 || !eventAt || Number.isNaN(Date.parse(eventAt))) {
    return NextResponse.json({ error: 'Etkinlik adı ve tarihi zorunludur.' }, { status: 422 });
  }

  await ensureDatabase();
  const token = createToken();
  const tokenHash = await hashPublicToken(token);
  const invitationId = crypto.randomUUID();
  const email = user.email.toLocaleLowerCase('tr-TR');

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO app_users (id, email, display_name)
      VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email,
      display_name = excluded.display_name`).bind(user.userId, email, user.displayName),
    env.DB.prepare(`INSERT INTO invitations (
      id, owner_user_id, title, host_names, event_at, venue_name, venue_address,
      description, video_key, audio_key, public_token_hash, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`).bind(
      invitationId, user.userId, 'Özel davet', hostNames, eventAt,
      body.venueName?.trim() || null, body.venueAddress?.trim() || null,
      body.description?.trim() || null, body.videoKey || null, body.audioKey || null, tokenHash,
    ),
  ]);

  const url = new URL(`/davet/${token}`, request.url).toString();
  return NextResponse.json({ ok: true, invitationId, token, url }, { status: 201 });
}
