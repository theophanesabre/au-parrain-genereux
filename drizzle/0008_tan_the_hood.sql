CREATE TABLE `checkout_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`fingerprint` text NOT NULL,
	`items` text NOT NULL,
	`total_cents` integer NOT NULL,
	`shipping_cents` integer NOT NULL,
	`delivery` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'creating' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkout_attempts_session_id_unique` ON `checkout_attempts` (`session_id`);--> statement-breakpoint
CREATE TABLE `payment_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`webhook_secret` text NOT NULL,
	`account_id` text NOT NULL,
	`endpoint_id` text NOT NULL,
	`mode` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`shipping_cents` integer,
	`countries` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stripe_refunds` (
	`payment_intent` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_status` text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_session_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_payment_intent` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_mode` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_address` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_session_id_unique` ON `orders` (`stripe_session_id`);--> statement-breakpoint
CREATE TRIGGER checkout_reserve BEFORE INSERT ON checkout_attempts
WHEN NEW.status='creating'
BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM json_each(NEW.items) AS line LEFT JOIN products p ON p.id=json_extract(line.value,'$.id')
  WHERE p.id IS NULL OR p.published!=1 OR p.price_cents!=json_extract(line.value,'$.price_cents') OR p.stock<json_extract(line.value,'$.quantity')
 ) THEN RAISE(ABORT,'stock insufficient or product unavailable') END;
 UPDATE products SET stock=stock-(SELECT json_extract(value,'$.quantity') FROM json_each(NEW.items) WHERE json_extract(value,'$.id')=products.id),version=version+1
 WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.items));
END;
--> statement-breakpoint
CREATE TRIGGER checkout_release AFTER UPDATE OF status ON checkout_attempts
WHEN OLD.status IN ('creating','open') AND NEW.status IN ('expired','failed')
BEGIN
 UPDATE products SET stock=stock+(SELECT json_extract(value,'$.quantity') FROM json_each(NEW.items) WHERE json_extract(value,'$.id')=products.id),version=version+1
 WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.items));
END;
--> statement-breakpoint
CREATE TRIGGER product_checkout_reserved BEFORE DELETE ON products
WHEN EXISTS (SELECT 1 FROM checkout_attempts,json_each(checkout_attempts.items) AS line WHERE checkout_attempts.status IN ('creating','open') AND json_extract(line.value,'$.id')=OLD.id)
BEGIN SELECT RAISE(ABORT,'product unavailable: reserved stock'); END;
