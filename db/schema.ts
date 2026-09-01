import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const appUsers = sqliteTable('app_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  status: text('status', { enum: ['active', 'disabled'] }).notNull().default('active'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (table) => [uniqueIndex('idx_app_users_email').on(table.email)]);

export const videoLibrary = sqliteTable('video_library', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  videoKey: text('video_key').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  createdByUserId: text('created_by_user_id').notNull().references(() => appUsers.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex('idx_video_library_video_key').on(table.videoKey),
  index('idx_video_library_status_created').on(table.status, table.createdAt),
]);

export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  hostNames: text('host_names').notNull(),
  eventAt: text('event_at').notNull(),
  timezone: text('timezone').notNull().default('Europe/Istanbul'),
  venueName: text('venue_name'),
  venueAddress: text('venue_address'),
  mapUrl: text('map_url'),
  description: text('description'),
  videoKey: text('video_key'),
  posterKey: text('poster_key'),
  audioKey: text('audio_key'),
  publicTokenHash: text('public_token_hash').notNull(),
  activationCodeId: text('activation_code_id'),
  videoLibraryId: text('video_library_id').references(() => videoLibrary.id, { onDelete: 'restrict' }),
  videoConfigJson: text('video_config_json').notNull().default('{"version":1,"overlays":[]}'),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex('idx_invitations_public_token').on(table.publicTokenHash),
  uniqueIndex('idx_invitations_activation_code').on(table.activationCodeId),
  index('idx_invitations_owner_updated').on(table.ownerUserId, table.updatedAt),
  index('idx_invitations_video_library').on(table.videoLibraryId),
]);

export const activationCodes = sqliteTable('activation_codes', {
  id: text('id').primaryKey(),
  codeHash: text('code_hash').notNull(),
  status: text('status', { enum: ['unused', 'used'] }).notNull().default('unused'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  usedAt: integer('used_at'),
  orderReference: text('order_reference'),
  templateId: text('template_id'),
  invitationId: text('invitation_id'),
  usedByUserId: text('used_by_user_id').references(() => appUsers.id, { onDelete: 'set null' }),
}, (table) => [
  uniqueIndex('idx_activation_codes_code_hash').on(table.codeHash),
  uniqueIndex('idx_activation_codes_order_reference').on(table.orderReference),
  uniqueIndex('idx_activation_codes_invitation').on(table.invitationId),
  index('idx_activation_codes_status_created').on(table.status, table.createdAt),
]);

export const activationSessions = sqliteTable('activation_sessions', {
  id: text('id').primaryKey(),
  codeId: text('code_id').notNull().references(() => activationCodes.id, { onDelete: 'cascade' }),
  ownerUserId: text('owner_user_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  status: text('status', { enum: ['active', 'redeemed', 'expired', 'revoked'] }).notNull().default('active'),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  redeemedAt: integer('redeemed_at'),
}, (table) => [
  uniqueIndex('idx_activation_sessions_token_hash').on(table.tokenHash),
  index('idx_activation_sessions_code_status').on(table.codeId, table.status, table.expiresAt),
  index('idx_activation_sessions_owner_status').on(table.ownerUserId, table.status, table.expiresAt),
]);

export const mediaUploads = sqliteTable('media_uploads', {
  id: text('id').primaryKey(),
  objectKey: text('object_key').notNull(),
  ownerUserId: text('owner_user_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['video', 'poster'] }).notNull(),
  contentType: text('content_type').notNull(),
  expectedSize: integer('expected_size').notNull(),
  partSize: integer('part_size').notNull(),
  expectedParts: integer('expected_parts').notNull(),
  status: text('status', {
    enum: ['initiated', 'completed', 'attached', 'aborted', 'failed', 'expired', 'deleted'],
  }).notNull().default('initiated'),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex('idx_media_uploads_object_key').on(table.objectKey),
  index('idx_media_uploads_owner_status').on(table.ownerUserId, table.status, table.createdAt),
]);

export const guests = sqliteTable('guests', {
  id: text('id').primaryKey(),
  invitationId: text('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  phone: text('phone'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex('idx_guests_invitation_name').on(table.invitationId, table.normalizedName),
  index('idx_guests_invitation').on(table.invitationId),
]);

export const rsvps = sqliteTable('rsvps', {
  guestId: text('guest_id').primaryKey().references(() => guests.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['yes', 'no', 'maybe'] }).notNull(),
  partySize: integer('party_size').notNull().default(0),
  note: text('note'),
  respondedAt: integer('responded_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => [
  check('rsvps_party_size_check', sql`${table.partySize} >= 0 AND ${table.partySize} <= 20`),
  index('idx_rsvps_status').on(table.status),
]);
