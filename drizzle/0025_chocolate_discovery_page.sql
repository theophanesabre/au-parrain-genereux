-- Add an editable menu entry without replacing the owner's existing destinations.
UPDATE site_settings SET body=json_set(body,'$.navigation.items',json((SELECT json_group_array(json(value)) FROM (
 SELECT value,CAST(key AS INTEGER)*2 AS position FROM json_each(site_settings.body,'$.navigation.items')
 UNION ALL SELECT '{"label":"Nos chocolats","href":"/chocolats","group":false}',1
 ORDER BY position
)))),version=version+1 WHERE id='appearance' AND json_type(body,'$.navigation.items')='array' AND json_array_length(body,'$.navigation.items')<20 AND NOT EXISTS(SELECT 1 FROM json_each(body,'$.navigation.items') WHERE json_extract(value,'$.href')='/chocolats');
--> statement-breakpoint
UPDATE site_settings SET body=json_set(body,'$.collectionHref','/chocolats'),version=version+1 WHERE id='appearance' AND json_extract(body,'$.collectionHref') IN ('/bonbons','/maison#nos-recettes');
