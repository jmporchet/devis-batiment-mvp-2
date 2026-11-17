CREATE TABLE `price_items` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`unit` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`category` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
