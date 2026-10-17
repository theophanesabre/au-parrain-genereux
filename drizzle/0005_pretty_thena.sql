CREATE TABLE `site_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
