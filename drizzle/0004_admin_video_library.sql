CREATE TABLE `video_library` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`video_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "video_library_size_check" CHECK("video_library"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_video_library_video_key` ON `video_library` (`video_key`);--> statement-breakpoint
CREATE INDEX `idx_video_library_status_created` ON `video_library` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `invitations` ADD `video_library_id` text REFERENCES video_library(id) ON DELETE restrict;--> statement-breakpoint
ALTER TABLE `invitations` ADD `video_config_json` text DEFAULT '{"version":1,"overlays":[]}' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_invitations_video_library` ON `invitations` (`video_library_id`);
