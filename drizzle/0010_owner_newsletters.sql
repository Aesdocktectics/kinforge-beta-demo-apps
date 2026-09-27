CREATE TABLE `newsletter_subscribers` (
  `account_id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `name` text,
  `status` text DEFAULT 'subscribed' NOT NULL,
  `source` text DEFAULT 'account' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `newsletter_subscribers_status` ON `newsletter_subscribers` (`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `newsletter_subscribers_email` ON `newsletter_subscribers` (`email`);
--> statement-breakpoint
CREATE TABLE `newsletter_releases` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `subject` text NOT NULL,
  `summary` text,
  `status` text NOT NULL,
  `object_key` text NOT NULL,
  `attachment_count` integer DEFAULT 0 NOT NULL,
  `size` integer DEFAULT 0 NOT NULL,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL,
  `released_at` integer,
  `recipient_count` integer DEFAULT 0 NOT NULL,
  `delivery_status` text DEFAULT 'published-only-email-not-configured' NOT NULL,
  FOREIGN KEY (`created_by`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `newsletter_releases_created` ON `newsletter_releases` (`created_at`);
--> statement-breakpoint
CREATE INDEX `newsletter_releases_status` ON `newsletter_releases` (`status`,`created_at`);
