ALTER TABLE orders ADD COLUMN customer_email TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN customer_phone TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE orders SET customer_email=contact WHERE contact LIKE '%@%' AND customer_email='';
--> statement-breakpoint
CREATE TABLE notification_settings (
 id TEXT PRIMARY KEY CHECK(id='brevo'), secret TEXT NOT NULL,
 sender_email TEXT NOT NULL, sender_name TEXT NOT NULL, sms_sender TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), version INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE order_notifications (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
 event TEXT NOT NULL CHECK(event IN ('confirmed','ready')),
 channel TEXT NOT NULL CHECK(channel IN ('email','sms')),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','accepted','failed','uncertain','skipped')),
 attempts INTEGER NOT NULL DEFAULT 0, provider_id TEXT, error TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT,
 UNIQUE(order_id,event,channel)
);
--> statement-breakpoint
CREATE INDEX order_notifications_queue ON order_notifications(state,created_at);
--> statement-breakpoint
CREATE TRIGGER notify_order_confirmed AFTER INSERT ON orders
WHEN NEW.payment_mode='live' AND NEW.payment_status='paid' AND NEW.status='confirmed'
 AND EXISTS(SELECT 1 FROM notification_settings WHERE enabled=1)
BEGIN
 INSERT OR IGNORE INTO order_notifications(id,order_id,event,channel)
 VALUES(NEW.id||':confirmed:email',NEW.id,'confirmed','email'),(NEW.id||':confirmed:sms',NEW.id,'confirmed','sms');
END;
--> statement-breakpoint
CREATE TRIGGER notify_order_ready AFTER UPDATE OF status ON orders
WHEN NEW.status='ready' AND OLD.status<>'ready' AND NEW.payment_mode='live' AND NEW.payment_status='paid'
 AND EXISTS(SELECT 1 FROM notification_settings WHERE enabled=1)
BEGIN
 INSERT OR IGNORE INTO order_notifications(id,order_id,event,channel)
 VALUES(NEW.id||':ready:email',NEW.id,'ready','email'),(NEW.id||':ready:sms',NEW.id,'ready','sms');
END;
