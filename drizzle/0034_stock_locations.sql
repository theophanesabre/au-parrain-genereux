-- Existing declarations remain laboratory history. Never infer past shop stock.
ALTER TABLE sp_movements ADD COLUMN destination TEXT NOT NULL DEFAULT '' CHECK(destination IN ('','shop'));
CREATE TABLE sp_shop_balances (
 reference_id TEXT PRIMARY KEY REFERENCES sp_references(id),
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(typeof(quantity)='integer' AND quantity>=0 AND quantity<=1000000000000)
);
INSERT INTO sp_shop_balances(reference_id,quantity) SELECT id,0 FROM sp_references;
CREATE TRIGGER sp_shop_reference_balance AFTER INSERT ON sp_references BEGIN
 INSERT INTO sp_shop_balances(reference_id,quantity) VALUES(NEW.id,0);
END;
CREATE TABLE sp_shop_movements (
 id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,
 reference_id TEXT NOT NULL REFERENCES sp_references(id),reference_name TEXT NOT NULL,unit TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('shop_in','shop_out','lab_transfer','lab_correction','web_reserve','web_return')),
 direction INTEGER NOT NULL CHECK(direction IN (-1,1)),quantity INTEGER NOT NULL CHECK(typeof(quantity)='integer' AND quantity>0),
 before_quantity INTEGER NOT NULL,after_quantity INTEGER NOT NULL CHECK(after_quantity>=0 AND after_quantity<=1000000000000),
 origin_id TEXT UNIQUE REFERENCES sp_movements(id),correction_of TEXT UNIQUE REFERENCES sp_shop_movements(id),web_product_id TEXT REFERENCES products(id),web_product_name TEXT NOT NULL DEFAULT '',
 actor TEXT NOT NULL,actor_name TEXT NOT NULL,created_at TEXT NOT NULL,lot_code TEXT NOT NULL DEFAULT '',comment TEXT NOT NULL DEFAULT ''
);
CREATE INDEX sp_shop_ref_date ON sp_shop_movements(reference_id,created_at DESC);
CREATE INDEX sp_shop_date ON sp_shop_movements(created_at DESC);
CREATE TRIGGER sp_shop_validate BEFORE INSERT ON sp_shop_movements BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sp_references r JOIN sp_shop_balances b ON b.reference_id=r.id
 WHERE r.id=NEW.reference_id AND r.category='finished' AND r.unit=NEW.unit AND (r.archived=0 OR NEW.kind='lab_correction' OR NEW.correction_of IS NOT NULL)
 AND b.quantity=NEW.before_quantity AND NEW.after_quantity=b.quantity+NEW.direction*NEW.quantity)
 THEN RAISE(ABORT,'sp shop balance conflict') END;
 SELECT CASE WHEN NEW.correction_of IS NOT NULL AND (length(trim(NEW.comment))=0 OR NOT EXISTS(SELECT 1 FROM sp_shop_movements m WHERE m.id=NEW.correction_of AND m.correction_of IS NULL AND m.origin_id IS NULL AND m.reference_id=NEW.reference_id AND m.quantity=NEW.quantity AND m.direction=-NEW.direction AND m.web_product_id IS NEW.web_product_id)) THEN RAISE(ABORT,'sp shop invalid correction') END;
 SELECT CASE WHEN NEW.unit IN ('piece','sac','carton') AND NEW.quantity%1000<>0 THEN RAISE(ABORT,'sp shop whole units') END;
 SELECT CASE WHEN NEW.kind IN ('shop_in','web_return','lab_transfer') AND NEW.direction<>1
 OR NEW.kind IN ('shop_out','web_reserve') AND NEW.direction<>-1 THEN RAISE(ABORT,'sp shop invalid direction') END;
 SELECT CASE WHEN NEW.kind IN ('lab_transfer','lab_correction') AND NOT EXISTS(
 SELECT 1 FROM sp_movements m WHERE m.id=NEW.origin_id AND m.reference_id=NEW.reference_id AND m.destination='shop'
 AND m.quantity=NEW.quantity AND m.direction=-NEW.direction)
 OR NEW.kind NOT IN ('lab_transfer','lab_correction') AND NEW.origin_id IS NOT NULL THEN RAISE(ABORT,'sp shop invalid origin') END;
 SELECT CASE WHEN NEW.kind IN ('web_reserve','web_return') AND (NEW.unit<>'piece' OR NEW.quantity%1000<>0 OR NOT EXISTS(
 SELECT 1 FROM products p WHERE p.id=NEW.web_product_id AND p.archived=0 AND p.id<>'bonbon' AND p.id NOT LIKE 'bonbon-%'
 AND (NEW.kind<>'web_return' OR p.stock>=NEW.quantity/1000) AND (NEW.kind<>'web_reserve' OR p.stock+NEW.quantity/1000<=100000000)))
 OR NEW.kind NOT IN ('web_reserve','web_return') AND NEW.web_product_id IS NOT NULL THEN RAISE(ABORT,'sp shop invalid web transfer') END;
END;
CREATE TRIGGER sp_shop_apply AFTER INSERT ON sp_shop_movements BEGIN
 UPDATE sp_shop_balances SET quantity=NEW.after_quantity WHERE reference_id=NEW.reference_id;
 UPDATE products SET stock=stock-NEW.direction*(NEW.quantity/1000),version=version+1
 WHERE id=NEW.web_product_id AND NEW.kind IN ('web_reserve','web_return');
END;
CREATE TRIGGER sp_lab_destination_validate BEFORE INSERT ON sp_movements WHEN NEW.destination='shop' BEGIN
 SELECT CASE WHEN NEW.kind NOT IN ('production_out','correction') OR NEW.category<>'finished'
 OR (NEW.kind='correction' AND NOT EXISTS(SELECT 1 FROM sp_movements WHERE id=NEW.correction_of AND destination='shop'))
 THEN RAISE(ABORT,'sp shop invalid laboratory transfer') END;
END;
CREATE TRIGGER sp_lab_destination_apply AFTER INSERT ON sp_movements WHEN NEW.destination='shop' BEGIN
 INSERT INTO sp_shop_movements(id,request_key,payload,reference_id,reference_name,unit,kind,direction,quantity,before_quantity,after_quantity,origin_id,actor,actor_name,created_at,lot_code,comment)
 SELECT NEW.id,'lab:'||NEW.request_key,NEW.payload,NEW.reference_id,NEW.reference_name,NEW.unit,
 CASE WHEN NEW.kind='correction' THEN 'lab_correction' ELSE 'lab_transfer' END,-NEW.direction,NEW.quantity,
 b.quantity,b.quantity-NEW.direction*NEW.quantity,NEW.id,NEW.actor,NEW.actor_name,NEW.created_at,NEW.lot_code,NEW.comment
 FROM sp_shop_balances b WHERE b.reference_id=NEW.reference_id;
END;
CREATE TRIGGER sp_shop_balance_guard BEFORE UPDATE ON sp_shop_balances WHEN NEW.reference_id<>OLD.reference_id OR NEW.quantity<>(
 SELECT COALESCE(SUM(direction*quantity),0) FROM sp_shop_movements WHERE reference_id=OLD.reference_id)
 BEGIN SELECT RAISE(ABORT,'sp shop journal required'); END;
CREATE TRIGGER sp_shop_balance_keep BEFORE DELETE ON sp_shop_balances BEGIN SELECT RAISE(ABORT,'sp shop journal required'); END;
CREATE TRIGGER sp_shop_movement_keep_update BEFORE UPDATE ON sp_shop_movements BEGIN SELECT RAISE(ABORT,'sp shop immutable'); END;
CREATE TRIGGER sp_shop_movement_keep_delete BEFORE DELETE ON sp_shop_movements BEGIN SELECT RAISE(ABORT,'sp shop immutable'); END;
-- A shop history also locks the reference unit/category.
CREATE TRIGGER sp_shop_reference_fixed BEFORE UPDATE ON sp_references WHEN (NEW.unit<>OLD.unit OR NEW.category<>OLD.category)
 AND EXISTS(SELECT 1 FROM sp_shop_movements WHERE reference_id=OLD.id) BEGIN SELECT RAISE(ABORT,'sp fixed reference'); END;
