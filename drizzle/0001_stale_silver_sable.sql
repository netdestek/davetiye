CREATE TABLE `media_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`content_type` text NOT NULL,
	`expected_size` integer NOT NULL,
	`part_size` integer NOT NULL,
	`expected_parts` integer NOT NULL,
	`status` text DEFAULT 'initiated' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_media_uploads_object_key` ON `media_uploads` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_media_uploads_owner_status` ON `media_uploads` (`owner_user_id`,`status`,`created_at`);