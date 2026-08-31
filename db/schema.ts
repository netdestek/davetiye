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
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex('idx_invitations_public_token').on(table.publicTokenHash),
  index('idx_invitations_owner_updated').on(table.ownerUserId, table.updatedAt),
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
