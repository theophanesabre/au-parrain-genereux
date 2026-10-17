ALTER TABLE products ADD COLUMN weight TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE products ADD COLUMN conservation TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE products ADD COLUMN ingredients TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE products ADD COLUMN allergens TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE products SET weight='150 g',version=version+1 WHERE id='boite-decouverte-maison' AND weight='';
--> statement-breakpoint
UPDATE products SET description='Un calendrier de l’Avent pour découvrir, jour après jour, 24 bonbons en chocolat.',version=version+1 WHERE id='calendrier-conte-avent' AND description='Calendrier de l’Avent composé de 24 bonbons en chocolat.';
