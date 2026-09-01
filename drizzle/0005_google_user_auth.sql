ALTER TABLE `activation_codes` ADD `reserved_by_user_id` text REFERENCES app_users(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `activation_codes` ADD `reserved_until` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_users_email_nocase` ON `app_users` (`email` COLLATE NOCASE);--> statement-breakpoint
CREATE INDEX `idx_activation_codes_reservation` ON `activation_codes` (`reserved_by_user_id`,`reserved_until`);--> statement-breakpoint
CREATE TABLE `user_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`email` text COLLATE NOCASE NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_identities_provider_subject` ON `user_identities` (`provider`,`provider_subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_identities_provider_email` ON `user_identities` (`provider`,`email`);--> statement-breakpoint
CREATE INDEX `idx_user_identities_user` ON `user_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_sessions_token_hash` ON `user_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_user_expires` ON `user_sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_expires` ON `user_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `google_login_attempts` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`nonce_hash` text NOT NULL,
	`return_to` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	CONSTRAINT "google_login_attempts_return_to_check" CHECK (`return_to` IN ('/hesap','/olustur'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_google_login_attempts_nonce` ON `google_login_attempts` (`nonce_hash`);--> statement-breakpoint
CREATE INDEX `idx_google_login_attempts_expires` ON `google_login_attempts` (`expires_at`);
