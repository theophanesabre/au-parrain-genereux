CREATE TABLE IF NOT EXISTS order_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id)
);
--> statement-breakpoint
INSERT OR IGNORE INTO order_numbers (order_id)
SELECT id FROM orders WHERE NOT EXISTS (SELECT 1 FROM order_numbers WHERE order_id=orders.id) ORDER BY created_at, id;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS orders_assign_number AFTER INSERT ON orders
BEGIN
  INSERT INTO order_numbers (order_id) VALUES (NEW.id);
END;
