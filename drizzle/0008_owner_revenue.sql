CREATE TABLE IF NOT EXISTS `payment_events` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `provider_event_id` text,
  `source` text DEFAULT 'manual' NOT NULL,
  `status` text NOT NULL,
  `product` text NOT NULL,
  `tier` text,
  `customer_email` text,
  `customer_name` text,
  `currency` text NOT NULL,
  `amount` integer NOT NULL,
  `fee` integer DEFAULT 0 NOT NULL,
  `net` integer NOT NULL,
  `paid_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `payment_events_paid` ON `payment_events` (`paid_at`);
CREATE INDEX IF NOT EXISTS `payment_events_currency` ON `payment_events` (`currency`,`paid_at`);
CREATE UNIQUE INDEX IF NOT EXISTS `payment_events_provider_event` ON `payment_events` (`provider`,`provider_event_id`);
