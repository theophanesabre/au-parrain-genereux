-- Use the requested closed calendar with three interior boxes for the product only.
UPDATE products SET image='/images/calendrier-conte-avent-miniature.png',version=version+1
WHERE id='calendrier-conte-avent' AND image<>'/images/calendrier-conte-avent-miniature.png';
