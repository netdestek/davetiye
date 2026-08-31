CREATE TABLE `activation_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`status` text DEFAULT 'unused' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`used_at` integer,
	`order_reference` text,
	`template_id` text,
	`invitation_id` text,
	`used_by_user_id` text,
	FOREIGN KEY (`used_by_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_activation_codes_code_hash` ON `activation_codes` (`code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_activation_codes_invitation` ON `activation_codes` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `idx_activation_codes_status_created` ON `activation_codes` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `activation_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`code_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`redeemed_at` integer,
	FOREIGN KEY (`code_id`) REFERENCES `activation_codes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_activation_sessions_token_hash` ON `activation_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_activation_sessions_code_status` ON `activation_sessions` (`code_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_activation_sessions_owner_status` ON `activation_sessions` (`owner_user_id`,`status`,`expires_at`);--> statement-breakpoint
ALTER TABLE `invitations` ADD `activation_code_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitations_activation_code` ON `invitations` (`activation_code_id`);--> statement-breakpoint
