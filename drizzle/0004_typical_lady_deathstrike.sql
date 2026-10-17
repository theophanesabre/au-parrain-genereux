CREATE TABLE `highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`placement` text NOT NULL,
	`kicker` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image` text NOT NULL,
	`alt` text NOT NULL,
	`image_fit` text DEFAULT 'cover' NOT NULL,
	`button_label` text NOT NULL,
	`href` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
