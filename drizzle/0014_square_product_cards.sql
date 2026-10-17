-- Apply the owner-requested square product grid without changing products, prices or stock.
UPDATE site_settings SET body=json_set(body,'$.shop.presentation','square','$.shop.layout','grid','$.shop.mobileColumns',2),version=version+1
WHERE id='appearance' AND (json_extract(body,'$.shop.presentation') IS NOT 'square' OR json_extract(body,'$.shop.layout') IS NOT 'grid' OR json_extract(body,'$.shop.mobileColumns') IS NOT 2);
