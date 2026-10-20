DROP TRIGGER IF EXISTS notify_order_confirmed;
--> statement-breakpoint
CREATE TRIGGER notify_order_confirmed AFTER INSERT ON orders
WHEN NEW.payment_mode='live' AND NEW.payment_status='paid' AND NEW.status='confirmed'
 AND EXISTS(SELECT 1 FROM notification_settings WHERE enabled=1)
BEGIN
 INSERT OR IGNORE INTO order_notifications(id,order_id,event,channel)
 VALUES(NEW.id||':confirmed:sms',NEW.id,'confirmed','sms');
END;
--> statement-breakpoint
UPDATE order_notifications SET state='skipped',error='Email envoyé uniquement lorsque la commande est prête',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE event='confirmed' AND channel='email' AND state IN ('pending','failed');
