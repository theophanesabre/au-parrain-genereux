UPDATE site_settings SET body=json_set(body,'$.shop.imageFit','contain'),version=version+1 WHERE id='appearance' AND COALESCE(json_extract(body,'$.shop.imageFit'),'')<>'contain';
