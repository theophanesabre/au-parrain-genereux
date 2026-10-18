ALTER TABLE highlights ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE highlights_state(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
INSERT INTO highlights_state(id,version) VALUES (1,0);
--> statement-breakpoint
CREATE TRIGGER highlights_write_version BEFORE UPDATE ON highlights_state WHEN NEW.version<>OLD.version+1 BEGIN SELECT RAISE(ABORT,'highlight version conflict'); END;
--> statement-breakpoint
-- Use the managed lists on the existing home page; retain manual slide data for recovery.
UPDATE puck_pages SET published=CASE WHEN published IS NULL THEN NULL ELSE json_set(published,'$.content',json((SELECT json_group_array(json(value)) FROM (SELECT CASE WHEN json_extract(value,'$.type') IN ('Bandeau','Nouveautes') THEN json_set(value,'$.props.source','managed') ELSE value END value FROM json_each(puck_pages.published,'$.content') ORDER BY CAST(key AS INTEGER))))) END,draft=CASE WHEN draft IS NULL THEN NULL ELSE json_set(draft,'$.content',json((SELECT json_group_array(json(value)) FROM (SELECT CASE WHEN json_extract(value,'$.type') IN ('Bandeau','Nouveautes') THEN json_set(value,'$.props.source','managed') ELSE value END value FROM json_each(puck_pages.draft,'$.content') ORDER BY CAST(key AS INTEGER))))) END,version=version+1 WHERE path='/';
