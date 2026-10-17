-- Retire the former weight-based sale article without changing historical orders or stock.
UPDATE products SET published=0, version=version+1 WHERE id='bonbon' AND published<>0;
