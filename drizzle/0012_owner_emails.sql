CREATE TABLE IF NOT EXISTS `owner_emails` (
  `email` text PRIMARY KEY NOT NULL,
  `role` text DEFAULT 'owner' NOT NULL,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL,
  `revoked_at` integer,
  FOREIGN KEY (`created_by`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `owner_emails_active` ON `owner_emails` (`revoked_at`,`created_at`);
