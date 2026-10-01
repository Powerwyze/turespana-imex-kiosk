CREATE TABLE `kiosk_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`destination_id` text NOT NULL,
	`marketing_opt_in` integer DEFAULT 0 NOT NULL,
	`consent_at` text,
	`consent_version` text NOT NULL,
	`consent_text` text NOT NULL,
	`terms_url` text NOT NULL,
	`privacy_url` text NOT NULL,
	`created_at` text NOT NULL,
	`client` text NOT NULL,
	`event` text NOT NULL,
	`source` text NOT NULL,
	`portrait_hash` text NOT NULL
);
