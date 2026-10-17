CREATE TABLE `image_replacements` (
	`original` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
);
