CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `subject` text NOT NULL,
  `name` text,
  `email` text,
  `message` text NOT NULL,
  `device` text,
  `tree_title` text,
  `proof` text,
  `permission_to_reply` integer DEFAULT 1 NOT NULL,
  `diagnostics` text,
  `status` text DEFAULT 'open' NOT NULL,
  `priority` text DEFAULT 'normal' NOT NULL,
  `delivery_status` text DEFAULT 'serene-relay-not-configured' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `last_reply_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `support_tickets_status` ON `support_tickets` (`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `support_tickets_email` ON `support_tickets` (`email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `support_tickets_created` ON `support_tickets` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `support_replies` (
  `id` text PRIMARY KEY NOT NULL,
  `ticket_id` text NOT NULL,
  `author_id` text NOT NULL,
  `author_email` text NOT NULL,
  `message` text NOT NULL,
  `delivery_status` text DEFAULT 'stored-only' NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`author_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `support_replies_ticket` ON `support_replies` (`ticket_id`,`created_at`);
