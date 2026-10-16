-- Confirmation reserves stock atomically in the same D1 transaction as the order update.
CREATE TRIGGER order_reserve BEFORE UPDATE OF status ON orders
WHEN OLD.status = 'draft' AND NEW.status = 'confirmed'
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.items) AS line LEFT JOIN products p ON p.id = json_extract(line.value,'$.id')
    WHERE p.id IS NULL OR p.stock < json_extract(line.value,'$.quantity')
  ) THEN RAISE(ABORT, 'stock insufficient or product unavailable') END;
  UPDATE products SET stock = stock - (
    SELECT json_extract(line.value,'$.quantity') FROM json_each(NEW.items) AS line WHERE json_extract(line.value,'$.id') = products.id
  ), version = version + 1 WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.items));
END;
--> statement-breakpoint
CREATE TRIGGER order_release AFTER UPDATE OF status ON orders
WHEN OLD.status IN ('confirmed','preparing') AND NEW.status = 'cancelled'
BEGIN
  UPDATE products SET stock = stock + (
    SELECT json_extract(line.value,'$.quantity') FROM json_each(NEW.items) AS line WHERE json_extract(line.value,'$.id') = products.id
  ), version = version + 1 WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.items));
END;
--> statement-breakpoint
CREATE TRIGGER product_reserved BEFORE DELETE ON products
WHEN EXISTS (SELECT 1 FROM orders, json_each(orders.items) AS line WHERE orders.status IN ('confirmed','preparing','ready') AND json_extract(line.value,'$.id') = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'product unavailable: reserved stock');
END;
