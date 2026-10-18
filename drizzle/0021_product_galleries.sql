ALTER TABLE products ADD COLUMN images TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE products ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
-- Owner requested removal: retain the row for its paid order and stock reservation.
UPDATE products SET archived=1,published=0,version=version+1 WHERE id='coffret' AND lower(name)='coffret amour' AND archived=0;
--> statement-breakpoint
UPDATE products SET images=json_array(image,'/images/boite-decouverte-maison-vues.jpg'),version=version+1 WHERE id='boite-decouverte-maison' AND image='/images/boite-decouverte-maison.jpg' AND images='[]';
