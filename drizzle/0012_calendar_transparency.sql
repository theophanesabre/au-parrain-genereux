-- Replace the raster checkerboard with the supplied calendar cutout, preserving content and edits.
UPDATE highlights SET image='/images/calendrier-conte-avent.png',version=version+1 WHERE image='/images/calendrier-conte-avent.jpg';
--> statement-breakpoint
UPDATE puck_pages SET published=replace(published,'/images/calendrier-conte-avent.jpg','/images/calendrier-conte-avent.png'),draft=replace(draft,'/images/calendrier-conte-avent.jpg','/images/calendrier-conte-avent.png'),version=version+1
WHERE instr(COALESCE(published,''),'/images/calendrier-conte-avent.jpg')>0 OR instr(COALESCE(draft,''),'/images/calendrier-conte-avent.jpg')>0;
--> statement-breakpoint
UPDATE site_settings SET body=replace(body,'/images/calendrier-conte-avent.jpg','/images/calendrier-conte-avent.png'),version=version+1 WHERE instr(body,'/images/calendrier-conte-avent.jpg')>0;
--> statement-breakpoint
UPDATE image_replacements SET original='/images/calendrier-conte-avent.png' WHERE original='/images/calendrier-conte-avent.jpg' AND NOT EXISTS(SELECT 1 FROM image_replacements WHERE original='/images/calendrier-conte-avent.png');
