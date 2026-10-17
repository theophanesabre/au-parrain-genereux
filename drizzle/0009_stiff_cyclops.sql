ALTER TABLE `checkout_attempts` ADD `params` text NOT NULL;--> statement-breakpoint
ALTER TABLE `checkout_attempts` ADD `requester` text NOT NULL;--> statement-breakpoint
CREATE TRIGGER checkout_rate_limit BEFORE INSERT ON checkout_attempts
WHEN (SELECT COUNT(*) FROM checkout_attempts WHERE requester=NEW.requester AND status IN ('creating','open'))>=5
BEGIN SELECT RAISE(ABORT,'checkout rate limit'); END;
--> statement-breakpoint
CREATE TRIGGER checkout_configuration BEFORE INSERT ON checkout_attempts
WHEN NOT EXISTS (SELECT 1 FROM payment_settings WHERE id='stripe' AND enabled=1 AND mode=NEW.mode)
BEGIN SELECT RAISE(ABORT,'payment configuration changed'); END;
