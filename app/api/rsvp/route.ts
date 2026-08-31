import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import {
  ensureDatabase,
  getInvitationMetrics,
  getPublicInvitation,
  normalizeGuestName,
} from '@/lib/d1';

type RsvpBody = {
  slug?: string;
  name?: string;
  status?: 'yes' | 'no' | 'maybe';
  partySize?: number;
  note?: string;
};

export async function POST(request: Request) {
  let body: RsvpBody;
  try {
    body = await request.json() as RsvpBody;
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const name = body.name?.trim() ?? '';
  const note = body.note?.trim() ?? '';
  const status = body.status;
  const partySize = status === 'yes' ? Number(body.partySize ?? 1) : 0;

  if (!body.slug || !status || !['yes', 'no', 'maybe'].includes(status)) {
    return NextResponse.json({ error: 'Katılım durumunu seçin.' }, { status: 422 });
  }
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Adınızı ve soyadınızı girin.' }, { status: 422 });
  }
  if (!Number.isInteger(partySize) || partySize < 0 || partySize > 20) {
    return NextResponse.json({ error: 'Geçerli bir kişi sayısı girin.' }, { status: 422 });
  }
  if (note.length > 500) {
    return NextResponse.json({ error: 'Not en fazla 500 karakter olabilir.' }, { status: 422 });
  }

  await ensureDatabase();
  const invitation = await getPublicInvitation(body.slug);
  if (!invitation) {
    return NextResponse.json({ error: 'Davetiye bulunamadı.' }, { status: 404 });
  }

  const normalizedName = normalizeGuestName(name);
  const existing = await env.DB.prepare(
    'SELECT id FROM guests WHERE invitation_id = ? AND normalized_name = ? LIMIT 1',
  ).bind(invitation.id, normalizedName).first<{ id: string }>();
  const guestId = existing?.id ?? crypto.randomUUID();

  if (existing) {
    await env.DB.prepare('UPDATE guests SET name = ?, updated_at = unixepoch() WHERE id = ?')
      .bind(name, guestId).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO guests (id, invitation_id, name, normalized_name) VALUES (?, ?, ?, ?)',
    ).bind(guestId, invitation.id, name, normalizedName).run();
  }

  await env.DB.prepare(`INSERT INTO rsvps (guest_id, status, party_size, note)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guest_id) DO UPDATE SET status = excluded.status,
      party_size = excluded.party_size, note = excluded.note, updated_at = unixepoch()`)
    .bind(guestId, status, partySize, note || null).run();

  const metrics = await getInvitationMetrics(invitation.id);
  return NextResponse.json({ ok: true, metrics });
}
