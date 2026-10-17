-- Move this calendar from news into the main banner, preserving slide edits and page content.
UPDATE highlights SET placement='hero', position=0, version=version+1 WHERE id='calendrier-conte-avent' AND placement<>'hero';
--> statement-breakpoint
WITH RECURSIVE
source(kind,body) AS (
 SELECT 'published',published FROM puck_pages WHERE path='/' AND published IS NOT NULL
 UNION ALL SELECT 'draft',draft FROM puck_pages WHERE path='/' AND draft IS NOT NULL
),
cleaned(kind,body,slide) AS (
 SELECT kind,body,COALESCE((SELECT value FROM json_tree(source.body) WHERE type='object' AND instr(fullkey,'.props.items[')>0 AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.image')='/images/calendrier-conte-avent.jpg' LIMIT 1),'{"title":"Le Conte de l’Avent","description":"24 bonbons en chocolat.","kicker":"Calendrier de l’Avent","image":"/images/calendrier-conte-avent.jpg","alt":"Le Conte de l’Avent du Parrain Généreux, calendrier et ses 24 cases de chocolats","href":"/boutique","button_label":"Voir la boutique en ligne","image_fit":"contain"}') FROM source
 UNION ALL
 SELECT kind,json_remove(body,(SELECT fullkey FROM json_tree(cleaned.body) WHERE (type='object' AND instr(fullkey,'.props.items[')>0 AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.image')='/images/calendrier-conte-avent.jpg') OR (type='object' AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.type')='Nouveautes' AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.props.id')='calendrier-avent-nouveautes' AND json_array_length(CASE WHEN type='object' THEN value ELSE '{}' END,'$.props.items')=0) LIMIT 1)),slide FROM cleaned
 WHERE EXISTS(SELECT 1 FROM json_tree(cleaned.body) WHERE (type='object' AND instr(fullkey,'.props.items[')>0 AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.image')='/images/calendrier-conte-avent.jpg') OR (type='object' AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.type')='Nouveautes' AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.props.id')='calendrier-avent-nouveautes' AND json_array_length(CASE WHEN type='object' THEN value ELSE '{}' END,'$.props.items')=0))
),
finished(kind,body) AS (
 SELECT kind,CASE WHEN (SELECT fullkey FROM json_tree(body) WHERE type='object' AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.type')='Bandeau' LIMIT 1) IS NOT NULL
 THEN json_insert(body,(SELECT fullkey FROM json_tree(body) WHERE type='object' AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.type')='Bandeau' LIMIT 1)||'.props.items[#]',json(slide))
 ELSE json_set(body,'$.content',json('['||json_set('{"type":"Bandeau","props":{"id":"calendrier-avent-bandeau","items":[{"title":"Le Conte de l’Avent","description":"24 bonbons en chocolat.","kicker":"Calendrier de l’Avent","image":"/images/calendrier-conte-avent.jpg","alt":"Le Conte de l’Avent du Parrain Généreux, calendrier et ses 24 cases de chocolats","href":"/boutique","button_label":"Voir la boutique en ligne","image_fit":"contain"}],"style":{"background":"","color":"","padding":0,"paddingX":0,"margin":0,"radius":0,"maxWidth":2000,"align":"left","font":"inherit","size":18,"gap":24,"width":100,"minHeight":0,"visualHeight":0,"visualBackground":""}}}','$.props.items',json_array(json(slide)))||CASE WHEN json_array_length(body,'$.content')>0 THEN ','||substr(json_extract(body,'$.content'),2) ELSE ']' END)) END
 FROM cleaned WHERE NOT EXISTS(SELECT 1 FROM json_tree(cleaned.body) WHERE (type='object' AND instr(fullkey,'.props.items[')>0 AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.image')='/images/calendrier-conte-avent.jpg') OR (type='object' AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.type')='Nouveautes' AND json_extract(CASE WHEN type='object' THEN value ELSE '{}' END,'$.props.id')='calendrier-avent-nouveautes' AND json_array_length(CASE WHEN type='object' THEN value ELSE '{}' END,'$.props.items')=0))
)
UPDATE puck_pages SET published=(SELECT body FROM finished WHERE kind='published'),draft=(SELECT body FROM finished WHERE kind='draft'),version=version+1
WHERE path='/' AND (published IS NOT (SELECT body FROM finished WHERE kind='published') OR draft IS NOT (SELECT body FROM finished WHERE kind='draft'));
