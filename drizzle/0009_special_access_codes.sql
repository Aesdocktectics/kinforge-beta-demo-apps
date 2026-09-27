CREATE TABLE IF NOT EXISTS `special_access_codes` (
  `hash` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `recipient_email` text,
  `note` text,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL,
  `expires_at` integer,
  `max_uses` integer DEFAULT 1 NOT NULL,
  `use_count` integer DEFAULT 0 NOT NULL,
  `revoked_at` integer,
  `last_redeemed_by` text,
  `last_redeemed_at` integer,
  FOREIGN KEY (`created_by`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`last_redeemed_by`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE INDEX IF NOT EXISTS `special_access_codes_created` ON `special_access_codes` (`created_at`);
CREATE INDEX IF NOT EXISTS `special_access_codes_recipient` ON `special_access_codes` (`recipient_email`);
