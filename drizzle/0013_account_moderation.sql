CREATE TABLE IF NOT EXISTS `account_moderation` (
  `account_id` text PRIMARY KEY NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `reason` text,
  `note` text,
  `warnings` integer DEFAULT 0 NOT NULL,
  `last_action` text DEFAULT 'active' NOT NULL,
  `updated_at` integer NOT NULL,
  `updated_by` text NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`updated_by`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `account_moderation_status` ON `account_moderation` (`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `account_moderation_events` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `action` text NOT NULL,
  `reason` text,
  `note` text,
  `created_at` integer NOT NULL,
  `created_by` text NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`created_by`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `account_moderation_events_account` ON `account_moderation_events` (`account_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `account_moderation_events_created` ON `account_moderation_events` (`created_at`);
