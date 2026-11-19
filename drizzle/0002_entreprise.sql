CREATE TABLE `company` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`street` text DEFAULT '' NOT NULL,
	`postal_city` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`vat_number` text DEFAULT '' NOT NULL,
	`iban` text DEFAULT '' NOT NULL,
	`validity_days` integer DEFAULT 30 NOT NULL,
	`payment_terms` text DEFAULT '' NOT NULL,
	`footer_note` text DEFAULT '' NOT NULL,
	`logo` blob,
	`logo_mime_type` text,
	`updated_at` integer NOT NULL
);
