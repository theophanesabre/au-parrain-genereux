-- Dedicated laboratory ledger: deliberately no foreign key or trigger to e-commerce.
CREATE TABLE sp_users (
 user_id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('laboratory','shop')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL, updated_by TEXT NOT NULL
);
CREATE TABLE sp_references (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 category TEXT NOT NULL CHECK(category IN ('raw','finished')),
 unit TEXT NOT NULL CHECK(unit IN ('kg','g','piece','sac','carton','litre')),
 threshold INTEGER CHECK(threshold IS NULL OR (typeof(threshold)='integer' AND threshold>=0)),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, created_by TEXT NOT NULL
);
CREATE TABLE sp_balances (
 reference_id TEXT PRIMARY KEY REFERENCES sp_references(id),
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(typeof(quantity)='integer' AND quantity>=0 AND quantity<=1000000000000)
);
CREATE TRIGGER sp_reference_balance AFTER INSERT ON sp_references BEGIN
 INSERT INTO sp_balances(reference_id,quantity) VALUES(NEW.id,0);
END;
CREATE TABLE sp_lots (
 id TEXT PRIMARY KEY, reference_id TEXT NOT NULL REFERENCES sp_references(id), code TEXT NOT NULL,
 supplier TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, created_by TEXT NOT NULL,
 UNIQUE(reference_id,code)
);
CREATE TABLE sp_movements (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
 reference_id TEXT NOT NULL REFERENCES sp_references(id), reference_name TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('raw','finished')), unit TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('raw_in','raw_out','production_in','production_out','correction')),
 direction INTEGER NOT NULL CHECK(direction IN (-1,1)),
 quantity INTEGER NOT NULL CHECK(typeof(quantity)='integer' AND quantity>0 AND quantity<=1000000000000),
 before_quantity INTEGER NOT NULL, after_quantity INTEGER NOT NULL CHECK(after_quantity>=0 AND after_quantity<=1000000000000),
 actor TEXT NOT NULL, actor_name TEXT NOT NULL, actor_role TEXT NOT NULL CHECK(actor_role IN ('admin','laboratory','shop')),
 created_at TEXT NOT NULL, occurred_on TEXT NOT NULL,
 lot_id TEXT REFERENCES sp_lots(id), lot_code TEXT NOT NULL DEFAULT '', supplier TEXT NOT NULL DEFAULT '',
 comment TEXT NOT NULL DEFAULT '', correction_of TEXT UNIQUE REFERENCES sp_movements(id)
);
CREATE INDEX sp_reference_search ON sp_references(category,archived,name);
CREATE INDEX sp_movement_date ON sp_movements(created_at DESC,id);
CREATE INDEX sp_movement_reference ON sp_movements(reference_id,created_at DESC);
CREATE INDEX sp_movement_kind ON sp_movements(kind,occurred_on);
CREATE INDEX sp_movement_actor ON sp_movements(actor,created_at DESC);
CREATE INDEX sp_movement_lot ON sp_movements(lot_id,created_at DESC);
CREATE TABLE sp_access_audit (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, target TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TRIGGER sp_reference_fixed BEFORE UPDATE ON sp_references
 WHEN (NEW.unit<>OLD.unit OR NEW.category<>OLD.category) AND EXISTS(SELECT 1 FROM sp_movements WHERE reference_id=OLD.id)
 BEGIN SELECT RAISE(ABORT,'sp fixed reference'); END;
CREATE TRIGGER sp_reference_keep BEFORE DELETE ON sp_references BEGIN SELECT RAISE(ABORT,'sp archive only'); END;
CREATE TRIGGER sp_lot_keep_update BEFORE UPDATE ON sp_lots BEGIN SELECT RAISE(ABORT,'sp immutable lot'); END;
CREATE TRIGGER sp_lot_keep_delete BEFORE DELETE ON sp_lots BEGIN SELECT RAISE(ABORT,'sp immutable lot'); END;
CREATE TRIGGER sp_movement_validate BEFORE INSERT ON sp_movements BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sp_references r JOIN sp_balances b ON b.reference_id=r.id
 WHERE r.id=NEW.reference_id AND r.unit=NEW.unit AND r.category=NEW.category
 AND (r.archived=0 OR NEW.kind='correction') AND b.quantity=NEW.before_quantity
 AND NEW.after_quantity=b.quantity+NEW.direction*NEW.quantity)
 THEN RAISE(ABORT,'sp balance conflict') END;
 SELECT CASE WHEN NEW.unit IN ('piece','sac','carton') AND NEW.quantity%1000<>0 THEN RAISE(ABORT,'sp whole units') END;
 SELECT CASE WHEN (NEW.kind='raw_in' AND (NEW.category<>'raw' OR NEW.direction<>1))
 OR (NEW.kind='raw_out' AND (NEW.category<>'raw' OR NEW.direction<>-1))
 OR (NEW.kind='production_in' AND (NEW.category<>'finished' OR NEW.direction<>1))
 OR (NEW.kind='production_out' AND (NEW.category<>'finished' OR NEW.direction<>-1))
 THEN RAISE(ABORT,'sp invalid movement') END;
 SELECT CASE WHEN NEW.actor_role='shop' AND NEW.kind<>'production_out'
 OR NEW.actor_role='laboratory' AND NEW.kind NOT IN ('raw_in','raw_out','production_in')
 THEN RAISE(ABORT,'sp forbidden movement') END;
 SELECT CASE WHEN (NEW.lot_code<>'' AND NEW.lot_id IS NULL) OR (NEW.lot_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sp_lots WHERE id=NEW.lot_id AND reference_id=NEW.reference_id AND code=NEW.lot_code AND supplier=NEW.supplier))
 THEN RAISE(ABORT,'sp invalid lot') END;
 SELECT CASE WHEN NEW.kind='correction' AND (NEW.actor_role<>'admin' OR length(trim(NEW.comment))=0 OR NOT EXISTS(
 SELECT 1 FROM sp_movements m WHERE m.id=NEW.correction_of AND m.correction_of IS NULL
 AND m.reference_id=NEW.reference_id AND m.quantity=NEW.quantity AND m.direction=-NEW.direction
 AND m.lot_id IS NEW.lot_id AND m.occurred_on=NEW.occurred_on))
 OR NEW.kind<>'correction' AND NEW.correction_of IS NOT NULL THEN RAISE(ABORT,'sp invalid correction') END;
END;
CREATE TRIGGER sp_movement_apply AFTER INSERT ON sp_movements BEGIN
 UPDATE sp_balances SET quantity=NEW.after_quantity WHERE reference_id=NEW.reference_id;
END;
-- Balance changes require the immediately corresponding immutable ledger state.
CREATE TRIGGER sp_balance_guard BEFORE UPDATE ON sp_balances WHEN NEW.reference_id<>OLD.reference_id OR NEW.quantity<>(
 SELECT COALESCE(SUM(direction*quantity),0) FROM sp_movements WHERE reference_id=OLD.reference_id)
 BEGIN SELECT RAISE(ABORT,'sp journal required'); END;
CREATE TRIGGER sp_balance_keep BEFORE DELETE ON sp_balances BEGIN SELECT RAISE(ABORT,'sp journal required'); END;
CREATE TRIGGER sp_movement_keep_update BEFORE UPDATE ON sp_movements BEGIN SELECT RAISE(ABORT,'sp immutable movement'); END;
CREATE TRIGGER sp_movement_keep_delete BEFORE DELETE ON sp_movements BEGIN SELECT RAISE(ABORT,'sp immutable movement'); END;
CREATE TRIGGER sp_audit_keep_update BEFORE UPDATE ON sp_access_audit BEGIN SELECT RAISE(ABORT,'sp immutable audit'); END;
CREATE TRIGGER sp_audit_keep_delete BEFORE DELETE ON sp_access_audit BEGIN SELECT RAISE(ABORT,'sp immutable audit'); END;
