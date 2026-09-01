import { env } from 'cloudflare:workers';

export type PublicInvitation = {
  id: string;
  title: string;
  hostNames: string;
  eventAt: string;
  venueName: string;
  venueAddress: string;
  mapUrl: string;
  description: string;
  videoKey: string;
  posterKey: string;
};

export type InvitationMetrics = {
  invitedGuests: number;
  attendingGuests: number;
  declinedGuests: number;
  maybeGuests: number;
  awaitingResponse: number;
  expectedAttendees: number;
};

export type GuestResponse = {
  id: string;
  name: string;
  status: 'yes' | 'no' | 'maybe' | null;
  partySize: number;
  note: string;
  respondedAt: number | null;
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT, role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS user_identities (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, provider_subject TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
    revoked_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS google_login_attempts (
    state_hash TEXT PRIMARY KEY, nonce_hash TEXT NOT NULL,
    return_to TEXT NOT NULL CHECK(return_to IN ('/hesap','/olustur')),
    expires_at INTEGER NOT NULL, used_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS video_library (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, video_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
    created_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, host_names TEXT NOT NULL, event_at TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul', venue_name TEXT, venue_address TEXT,
    map_url TEXT, description TEXT, video_key TEXT, poster_key TEXT, audio_key TEXT,
    public_token_hash TEXT NOT NULL UNIQUE, activation_code_id TEXT UNIQUE,
    video_library_id TEXT REFERENCES video_library(id) ON DELETE RESTRICT,
    video_config_json TEXT NOT NULL DEFAULT '{"version":1,"overlays":[]}',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS activation_codes (
    id TEXT PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','used')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), used_at INTEGER,
    order_reference TEXT, template_id TEXT, invitation_id TEXT UNIQUE,
    used_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
    reserved_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
    reserved_until INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS activation_sessions (
    id TEXT PRIMARY KEY, code_id TEXT NOT NULL REFERENCES activation_codes(id) ON DELETE CASCADE,
    owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','redeemed','expired','revoked')),
    expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), redeemed_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS media_uploads (
    id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE,
    owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('video','poster')), content_type TEXT NOT NULL,
    expected_size INTEGER NOT NULL CHECK(expected_size > 0),
    part_size INTEGER NOT NULL CHECK(part_size > 0),
    expected_parts INTEGER NOT NULL CHECK(expected_parts > 0),
    status TEXT NOT NULL DEFAULT 'initiated'
      CHECK(status IN ('initiated','completed','attached','aborted','failed','expired','deleted')),
    expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY, invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    name TEXT NOT NULL, normalized_name TEXT NOT NULL, phone TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(invitation_id, normalized_name)
  )`,
  `CREATE TABLE IF NOT EXISTS rsvps (
    guest_id TEXT PRIMARY KEY REFERENCES guests(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('yes','no','maybe')),
    party_size INTEGER NOT NULL DEFAULT 0 CHECK(party_size BETWEEN 0 AND 20),
    note TEXT, responded_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  'CREATE INDEX IF NOT EXISTS idx_invitations_owner_updated ON invitations(owner_user_id, updated_at DESC)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_subject ON user_identities(provider, provider_subject)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_email ON user_identities(provider, email COLLATE NOCASE)',
  'CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires ON user_sessions(user_id, expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_google_login_attempts_nonce ON google_login_attempts(nonce_hash)',
  'CREATE INDEX IF NOT EXISTS idx_google_login_attempts_expires ON google_login_attempts(expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_invitations_video_library ON invitations(video_library_id)',
  'CREATE INDEX IF NOT EXISTS idx_video_library_status_created ON video_library(status, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_activation_codes_status_created ON activation_codes(status, created_at DESC)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_nocase ON app_users(email COLLATE NOCASE)',
  'CREATE INDEX IF NOT EXISTS idx_activation_codes_reservation ON activation_codes(reserved_by_user_id, reserved_until)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_codes_order_reference ON activation_codes(order_reference)',
  'CREATE INDEX IF NOT EXISTS idx_activation_sessions_code_status ON activation_sessions(code_id, status, expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_activation_sessions_owner_status ON activation_sessions(owner_user_id, status, expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_media_uploads_owner_status ON media_uploads(owner_user_id, status, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_guests_invitation ON guests(invitation_id)',
  'CREATE INDEX IF NOT EXISTS idx_rsvps_status ON rsvps(status)',
];

let schemaReady = false;

async function ensureActivationSchema(db: D1Database) {
  const columns = await db.prepare('PRAGMA table_info(invitations)').all<{ name: string }>();
  if (!columns.results.some((column) => column.name === 'activation_code_id')) {
    try {
      await db.prepare('ALTER TABLE invitations ADD COLUMN activation_code_id TEXT').run();
    } catch (error) {
      const refreshed = await db.prepare('PRAGMA table_info(invitations)').all<{ name: string }>();
      if (!refreshed.results.some((column) => column.name === 'activation_code_id')) throw error;
    }
  }
  if (!columns.results.some((column) => column.name === 'video_library_id')) {
    try {
      await db.prepare('ALTER TABLE invitations ADD COLUMN video_library_id TEXT REFERENCES video_library(id) ON DELETE RESTRICT').run();
    } catch (error) {
      const refreshed = await db.prepare('PRAGMA table_info(invitations)').all<{ name: string }>();
      if (!refreshed.results.some((column) => column.name === 'video_library_id')) throw error;
    }
  }
  if (!columns.results.some((column) => column.name === 'video_config_json')) {
    try {
      await db.prepare(`ALTER TABLE invitations ADD COLUMN video_config_json TEXT NOT NULL DEFAULT '{"version":1,"overlays":[]}'`).run();
    } catch (error) {
      const refreshed = await db.prepare('PRAGMA table_info(invitations)').all<{ name: string }>();
      if (!refreshed.results.some((column) => column.name === 'video_config_json')) throw error;
    }
  }

  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_activation_code ON invitations(activation_code_id)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_invitations_video_library ON invitations(video_library_id)').run();
}

export async function hashPublicToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeGuestName(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

export async function ensureDatabase() {
  if (schemaReady) return;
  const db = env.DB;
  if (!db) throw new Error('D1 veritabanı bağlantısı bulunamadı.');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await ensureActivationSchema(db);
  if (env.DAVETLY_ENABLE_DEMO === 'true') await seedDemoInvitation();
  schemaReady = true;
}

async function seedDemoInvitation() {
  const db = env.DB;
  const tokenHash = await hashPublicToken('ahmet-zeynep-x7p92k');
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO app_users (id, email, display_name, role)
      VALUES ('demo-owner', 'elif@davetly.test', 'Elif Aydın', 'admin')`),
    db.prepare(`INSERT OR IGNORE INTO invitations (
      id, owner_user_id, title, host_names, event_at, venue_name, venue_address,
      map_url, description, public_token_hash, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`).bind(
      'demo-wedding', 'demo-owner', 'Birlikte bir ömre', 'Elif & Arda',
      '2026-09-12T19:30:00+03:00', 'Liva Davet', 'Polonezköy, Beykoz / İstanbul',
      'https://www.google.com/maps/search/?api=1&query=Polonezk%C3%B6y+Beykoz',
      'Bu güzel günümüzde sizi de aramızda görmekten mutluluk duyarız.', tokenHash,
    ),
    db.prepare(`INSERT OR IGNORE INTO guests (id, invitation_id, name, normalized_name)
      VALUES ('guest-selin', 'demo-wedding', 'Selin Yılmaz', 'selin yılmaz')`),
    db.prepare(`INSERT OR IGNORE INTO guests (id, invitation_id, name, normalized_name)
      VALUES ('guest-mert', 'demo-wedding', 'Mert Erdem', 'mert erdem')`),
    db.prepare(`INSERT OR IGNORE INTO guests (id, invitation_id, name, normalized_name)
      VALUES ('guest-burcu', 'demo-wedding', 'Burcu Akın', 'burcu akın')`),
    db.prepare(`INSERT OR IGNORE INTO guests (id, invitation_id, name, normalized_name)
      VALUES ('guest-can', 'demo-wedding', 'Can Öz', 'can öz')`),
    db.prepare(`INSERT OR IGNORE INTO rsvps (guest_id, status, party_size, note)
      VALUES ('guest-selin', 'yes', 2, 'Heyecanla bekliyoruz!')`),
    db.prepare(`INSERT OR IGNORE INTO rsvps (guest_id, status, party_size, note)
      VALUES ('guest-mert', 'yes', 1, 'Mutluluklar dilerim.')`),
    db.prepare(`INSERT OR IGNORE INTO rsvps (guest_id, status, party_size, note)
      VALUES ('guest-burcu', 'no', 0, 'Ne yazık ki şehir dışında olacağız.')`),
  ]);
}

export async function getPublicInvitation(token: string): Promise<PublicInvitation | null> {
  await ensureDatabase();
  const tokenHash = await hashPublicToken(token);
  const row = await env.DB.prepare(`SELECT id, title, host_names, event_at, venue_name,
      venue_address, map_url, description, video_key, poster_key FROM invitations
      WHERE public_token_hash = ? AND status = 'published' LIMIT 1`)
    .bind(tokenHash).first<Record<string, string>>();
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    hostNames: row.host_names,
    eventAt: row.event_at,
    venueName: row.venue_name ?? '',
    venueAddress: row.venue_address ?? '',
    mapUrl: row.map_url ?? '#',
    description: row.description ?? '',
    videoKey: row.video_key ?? '',
    posterKey: row.poster_key ?? '',
  };
}

export async function getInvitationMetrics(invitationId: string): Promise<InvitationMetrics> {
  await ensureDatabase();
  const row = await env.DB.prepare(`SELECT COUNT(g.id) AS invited_guests,
      COALESCE(SUM(CASE WHEN r.status = 'yes' THEN 1 ELSE 0 END), 0) AS attending_guests,
      COALESCE(SUM(CASE WHEN r.status = 'no' THEN 1 ELSE 0 END), 0) AS declined_guests,
      COALESCE(SUM(CASE WHEN r.status = 'maybe' THEN 1 ELSE 0 END), 0) AS maybe_guests,
      COALESCE(SUM(CASE WHEN r.guest_id IS NULL THEN 1 ELSE 0 END), 0) AS awaiting_response,
      COALESCE(SUM(CASE WHEN r.status = 'yes' THEN r.party_size ELSE 0 END), 0) AS expected_attendees
    FROM guests g LEFT JOIN rsvps r ON r.guest_id = g.id WHERE g.invitation_id = ?`)
    .bind(invitationId).first<Record<string, number>>();
  return {
    invitedGuests: Number(row?.invited_guests ?? 0),
    attendingGuests: Number(row?.attending_guests ?? 0),
    declinedGuests: Number(row?.declined_guests ?? 0),
    maybeGuests: Number(row?.maybe_guests ?? 0),
    awaitingResponse: Number(row?.awaiting_response ?? 0),
    expectedAttendees: Number(row?.expected_attendees ?? 0),
  };
}

export async function getGuestResponses(invitationId: string): Promise<GuestResponse[]> {
  await ensureDatabase();
  const result = await env.DB.prepare(`SELECT g.id, g.name, r.status, r.party_size,
      r.note, r.responded_at FROM guests g LEFT JOIN rsvps r ON r.guest_id = g.id
      WHERE g.invitation_id = ? ORDER BY COALESCE(r.responded_at, g.created_at) DESC LIMIT 100`)
    .bind(invitationId).all<Record<string, string | number | null>>();
  return result.results.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: (row.status as GuestResponse['status']) ?? null,
    partySize: Number(row.party_size ?? 0),
    note: String(row.note ?? ''),
    respondedAt: row.responded_at ? Number(row.responded_at) : null,
  }));
}
