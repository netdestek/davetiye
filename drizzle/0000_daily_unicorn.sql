CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_users_email` ON `app_users` (`email`);--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`phone` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_guests_invitation_name` ON `guests` (`invitation_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `idx_guests_invitation` ON `guests` (`invitation_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`title` text NOT NULL,
	`host_names` text NOT NULL,
	`event_at` text NOT NULL,
	`timezone` text DEFAULT 'Europe/Istanbul' NOT NULL,
	`venue_name` text,
	`venue_address` text,
	`map_url` text,
	`description` text,
	`video_key` text,
	`poster_key` text,
	`audio_key` text,
	`public_token_hash` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitations_public_token` ON `invitations` (`public_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_invitations_owner_updated` ON `invitations` (`owner_user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `rsvps` (
	`guest_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`party_size` integer DEFAULT 0 NOT NULL,
	`note` text,
	`responded_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rsvps_party_size_check" CHECK("rsvps"."party_size" >= 0 AND "rsvps"."party_size" <= 20)
);
--> statement-breakpoint
CREATE INDEX `idx_rsvps_status` ON `rsvps` (`status`);