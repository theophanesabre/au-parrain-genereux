CREATE TABLE `puck_pages` (
	`path` text PRIMARY KEY NOT NULL,
	`published` text,
	`draft` text,
	`version` integer DEFAULT 1 NOT NULL
);
