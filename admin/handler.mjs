import {inventoryActor, inventoryAPI} from './inventory/service.mjs';
import {inventoryHTML} from './inventory/ui.mjs';
import { defaultShipping, readShipping, saveShipping } from '../commerce/shipping.mjs';
import { mediaInfo, mediaSnapshot, mediaUsages, deleteMedia, replaceMedia } from './media.mjs';
import { paymentConfig, safeConfig, configurePayments } from '../commerce/stripe.mjs';
import { reconcilePayments } from '../commerce/payments.mjs';
import { paymentsHTML } from './payments-ui.mjs';
import { loadMaisonDocument } from './maison.mjs';
import { puckPaths, validatePuckData, puckImages } from './puck-model.mjs';
import { puckContext, defaultPuckData } from './puck-defaults.mjs';
import { defaultAppearance, appearanceValues, validateAppearance } from './appearance.mjs';
import { isDefaultHighlight, mergeHighlights, validateHighlight, highlightChanges } from './highlights.mjs';
import { builtinPages } from '../data/site-content.mjs';
import { builtinImages } from '../data/site-assets.mjs';
import { adminPage, pageDefinition, contentValues, validatePageBody } from './content.mjs';
import { validatePhotoCrops, validateProductImages, BONBON_ID, isSale, isRecipe, productProfile } from './products.mjs';
import { claimAdmin, setupHTML } from './setup.mjs';
import { authorize, checkOrigin, text, integer, slug, imagePath, transition, imageType, HttpError } from './core.mjs';
import { adminHTML } from './ui.mjs';
const headers = {'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin', 'X-Frame-Options':'DENY'};
const json = (data, status=200) => Response.json(data, {status, headers});
async function body(request,limit=65536) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'JSON requis');
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, 'Requête trop volumineuse');
  const reader=request.body?.getReader(); let size=0; const chunks=[];
  if (!reader) throw new HttpError(400,'Corps requis');
  while (true) {const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>limit){await reader.cancel();throw new HttpError(413,'Requête trop volumineuse');} chunks.push(value);}
  try {return JSON.parse(new TextDecoder().decode(await new Blob(chunks).arrayBuffer()));} catch {throw new HttpError(400,'JSON invalide');}
}
export async function handleAdmin(request, env) {
  const url = new URL(request.url), path=url.pathname;
  if (!(path==='/admin' || path.startsWith('/admin/') || path.startsWith('/media/'))) return null;
  try {
    if (path.startsWith('/media/')) {
      if (request.method!=='GET') return json({error:'Méthode refusée'},405);
      const id=path.slice(7); if (!/^[a-f0-9-]{36}$/.test(id)) return new Response(null,{status:404});
      const object=await env.BUCKET?.get(id); if(!object) return new Response(null,{status:404});
      return new Response(object.body,{headers:{'Content-Type':object.httpMetadata.contentType,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=86400','Content-Security-Policy':"default-src 'none'"}});
    }
    if(path==='/admin/setup' && request.method==='GET') {
      const nonce=crypto.randomUUID();return new Response(setupHTML(nonce),{headers:{...headers,'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`}});
    }
    if(path==='/admin/api/claim') {
      if(request.method!=='POST')throw new HttpError(405,'Méthode refusée');
      return json(await claimAdmin(request,env));
    }
    if(path==='/admin/stocks'||path==='/admin/api/inventory'||path.startsWith('/admin/api/inventory/')) {
      let inventoryUser;
      try {inventoryUser=await inventoryActor(request,env);} catch(error) {
        if(error.status===401&&path==='/admin/stocks'&&request.method==='GET')return new Response(null,{status:302,headers:{...headers,Location:'/signin-with-chatgpt?return_to=%2Fadmin%2Fstocks'}});
        throw error;
      }
      if(path==='/admin/stocks'&&request.method==='GET'){
        const nonce=crypto.randomUUID();return new Response(inventoryHTML(nonce),{headers:{...headers,'X-Frame-Options':'SAMEORIGIN','Content-Type':'text/html;charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'`}});
      }
      return await inventoryAPI(request,env,inventoryUser,body);
    }
    let actor;
    try {
      try {actor=authorize(request,env);} catch(error) {
        const user=request.headers.get('oai-authenticated-user-id');
        const grant=user && env.DB ? await env.DB.prepare('SELECT user_id FROM admin_access WHERE slot=1 AND user_id=?').bind(user).first() : null;
        if(!grant)throw error;actor=user;
      }
    } catch(error) {
      if(error.status===403&&request.method==='GET'&&['/admin','/admin/puck'].includes(path)){
        try{await inventoryActor(request,env);return new Response(null,{status:302,headers:{...headers,Location:'/admin/stocks'}});}catch{/* Staff have no access to the other administration modules. */}
      }
      if(error.status===401 && ['/admin','/admin/apparence','/admin/editeur','/admin/puck','/admin/paiements'].includes(path) && request.method==='GET') return new Response(null,{status:302,headers:{...headers,Location:'/signin-with-chatgpt?return_to='+encodeURIComponent(path)}});
      throw error;
    }
    if(path==='/admin/paiements'&&request.method==='GET'){const nonce=crypto.randomUUID();return new Response(paymentsHTML(nonce),{headers:{...headers,'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`}});}
    if(path==='/admin/puck'&&request.method==='GET')return null;
    if(path==='/admin/editeur'&&request.method==='GET')return new Response(null,{status:302,headers:{...headers,Location:'/admin/puck'}});
    if(path==='/admin/apparence'&&request.method==='GET')return new Response(null,{status:302,headers:{...headers,Location:'/admin/puck?section=products'}});
    if(path==='/admin' && request.method==='GET') {
      const embedded=url.searchParams.get('workspace')==='1';
      if(!embedded)return new Response(null,{status:302,headers:{...headers,Location:'/admin/puck'}});
      const nonce=crypto.randomUUID();
      return new Response(adminHTML(nonce),{headers:{...headers,'X-Frame-Options':embedded?'SAMEORIGIN':'DENY','Content-Type':'text/html;charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self' blob:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors ${embedded?"'self'":"'none'"}`}});
    }
    if(!path.startsWith('/admin/api/')) return json({error:'Introuvable'},404);
    if(!env.DB || !env.BUCKET) throw new HttpError(503,'Stockage non configuré');
    const db=env.DB;
    if(path==='/admin/api/withdrawals'){
      if(request.method==='GET'){const result=await db.prepare('SELECT id,name,email,order_reference,products,created_at,status,version FROM consumer_requests ORDER BY created_at DESC LIMIT 200').all();return json({items:result.results});}
      if(request.method!=='PUT')throw new HttpError(405,'Méthode refusée');checkOrigin(request);const data=await body(request);if(typeof data.id!=='string'||!['pending','processed'].includes(data.status))throw new HttpError(400,'Demande invalide');const version=integer(data.version);const result=await db.batch([db.prepare('UPDATE consumer_requests SET status=?,version=version+1 WHERE id=? AND version=?').bind(data.status,data.id,version),db.prepare("INSERT INTO audit(id,actor,action,target,created_at) SELECT ?,?,'WITHDRAWAL_STATUS',?,? WHERE changes()=1").bind(crypto.randomUUID(),actor,data.id,new Date().toISOString())]);if(result[0].meta.changes!==1)throw new HttpError(409,'Demande modifiée ailleurs. Actualisez.');return json({status:data.status,version:version+1});
    }
    if(path==='/admin/api/shipping'){if(request.method==='GET'){const record=await readShipping(db);return json(record||{settings:defaultShipping,version:0});}if(request.method!=='PUT')throw new HttpError(405,'Méthode refusée');checkOrigin(request);return json(await saveShipping(db,await body(request),actor));}
    if(path==='/admin/api/stripe'){if(request.method==='GET'){const row=await db.prepare("SELECT enabled,mode,account_id,version,shipping_cents,countries FROM payment_settings WHERE id='stripe'").first();const pending=await db.prepare("SELECT COUNT(*) AS count FROM checkout_attempts WHERE status IN ('creating','open')").first();return json({...safeConfig(row),pending:pending.count});}if(request.method!=='PUT')throw new HttpError(405,'Méthode refusée');checkOrigin(request);return json(await configurePayments(await body(request),env,actor));}
    if(path==='/admin/api/stripe/reconcile'){if(request.method!=='POST')throw new HttpError(405,'Méthode refusée');checkOrigin(request);const config=await paymentConfig(env);if(!config)throw new HttpError(409,'Configurez Stripe avant de vérifier les paiements');return json(await reconcilePayments(env,config));}

    if(path==='/admin/api/puck'){
      const page=url.searchParams.get('path')||'/';if(!puckPaths.includes(page))throw new HttpError(400,'Page inconnue');
      if(request.method==='GET'){const [row,context]=await Promise.all([db.prepare('SELECT published,draft,version FROM puck_pages WHERE path=?').bind(page).first(),puckContext(db,page)]);const initial=page==='/maison'?await loadMaisonDocument(db,{defaults:true}):validatePuckData(defaultPuckData(page,context));return json({data:page==='/maison'?await loadMaisonDocument(db,{draft:true}):row?.draft?validatePuckData(JSON.parse(row.draft)):row?.published?validatePuckData(JSON.parse(row.published)):initial,defaultData:initial,version:row?.version??0,published:Boolean(row?.published),storefront:context.storefront});}
      if(request.method!=='PUT')throw new HttpError(405,'Méthode refusée');checkOrigin(request);const input=await body(request,262144),version=integer(input.version);if(!['draft','publish','restore'].includes(input.action))throw new HttpError(400,'Action inconnue');
      const data=input.action==='restore'?null:JSON.stringify(validatePuckData(input.data));
      const statement=version===0?db.prepare('INSERT OR IGNORE INTO puck_pages (path,published,draft) VALUES (?,?,?)').bind(page,input.action==='publish'?data:null,input.action==='restore'?null:data):input.action==='draft'?db.prepare('UPDATE puck_pages SET draft=?,version=version+1 WHERE path=? AND version=?').bind(data,page,version):db.prepare('UPDATE puck_pages SET published=?,draft=?,version=version+1 WHERE path=? AND version=?').bind(data,data,page,version);
      const [result]=await db.batch([statement,db.prepare('INSERT INTO audit (id,actor,action,target,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,'PUCK_'+input.action.toUpperCase(),page,new Date().toISOString())]);if(result.meta.changes!==1)throw new HttpError(409,'La page a été modifiée ailleurs. Rechargez avant de réessayer.');return json({version:version+1});
    }
    if(path==='/admin/api/appearance'){
      if(request.method==='GET'){const [row,page]=await Promise.all([db.prepare("SELECT body,version FROM site_settings WHERE id='appearance'").first(),db.prepare("SELECT body FROM pages WHERE id='accueil' AND published=1").first()]);const c=contentValues(pageDefinition('accueil'),page?.body);return json({settings:row?appearanceValues(row.body):defaultAppearance,defaults:defaultAppearance,version:row?.version??0,footerDefaults:{footerTitle:c.footerTitle,footerText:c.footerText,address:[c.address,c.city].filter(Boolean).join(' · '),hours:[c.days,c.hours].filter(Boolean).join(' · '),phone:c.phone,email:c.email}});}
      if(request.method!=='PUT')throw new HttpError(405,'Méthode refusée');checkOrigin(request);const data=await body(request),settings=validateAppearance(data.settings),version=integer(data.version);
      const change=version===0?db.prepare("INSERT OR IGNORE INTO site_settings (id,body) VALUES ('appearance',?)").bind(JSON.stringify(settings)):db.prepare("UPDATE site_settings SET body=?,version=version+1 WHERE id='appearance' AND version=?").bind(JSON.stringify(settings),version);
      const [result]=await db.batch([change,db.prepare('INSERT INTO audit (id,actor,action,target,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,'UPDATE_APPEARANCE','appearance',new Date().toISOString())]);
      if(result.meta.changes!==1)throw new HttpError(409,'Les réglages ont changé dans une autre session. Rechargez la page avant de modifier à nouveau.');
      return json({settings,version:version+1});
    }
    if(path==='/admin/api/media/usage'){if(request.method!=='GET')throw new HttpError(405,'Méthode refusée');const image=await mediaInfo(db,url.searchParams.get('id'));const snapshot=await mediaSnapshot(db),uses=[...mediaUsages(snapshot,image.url),...(image.static&&image.original!==image.url?mediaUsages(snapshot,image.original):[])];return json({...image,usages:[...new Map(uses.map(use=>[use.label+'|'+use.href,use])).values()]});}
    if(path==='/admin/api/media/delete'){if(request.method!=='POST')throw new HttpError(405,'Méthode refusée');checkOrigin(request);const data=await body(request);if(!Array.isArray(data.ids)||!data.ids.length||data.ids.length>100||data.ids.some(id=>typeof id!=='string'))throw new HttpError(400,'Sélectionnez entre 1 et 100 photos');const results=[];for(const id of new Set(data.ids)){try{results.push(await deleteMedia(env,id,actor));}catch(error){results.push({id,ok:false,error:error.status?error.message:'Suppression impossible. Réessayez.'});}}return json({results});}
    if(path==='/admin/api/media/replace'){if(request.method!=='POST')throw new HttpError(405,'Méthode refusée');checkOrigin(request);const data=await body(request);return json(await replaceMedia(env,data.id,data.replacement,actor));}
    const resetImage=path.match(/^\/admin\/api\/image-replacements\/(asset-[a-z0-9-]+)$/);
    if(resetImage){
      if(request.method!=='DELETE')throw new HttpError(405,'Méthode refusée');checkOrigin(request);
      const asset=builtinImages.find(image=>image.id===resetImage[1]);if(!asset)throw new HttpError(404,'Image inconnue');
      await db.batch([db.prepare('DELETE FROM image_replacements WHERE original=?').bind(asset.url),db.prepare('INSERT INTO audit (id,actor,action,target,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,'RESTORE_IMAGE',asset.id,new Date().toISOString())]);
      return json({ok:true});
    }
    const match=path.match(/^\/admin\/api\/(products|pages|images|orders|audit|highlights)(?:\/([a-z0-9-]+))?$/);
    if(!match) return json({error:'Introuvable'},404);
    const [,resource,id]=match;
    if(request.method==='GET') {
      if(id) throw new HttpError(405,'Utiliser la liste');
      if(resource==='orders'){const result=await db.prepare('SELECT orders.*, order_numbers.number AS order_number FROM orders JOIN order_numbers ON order_numbers.order_id=orders.id ORDER BY orders.created_at DESC, orders.id DESC LIMIT 500').all();return json(result.results);}
      const result=await db.prepare(`SELECT * FROM ${resource}${resource==='products'?' WHERE archived=0':''} ORDER BY ${resource==='orders'||resource==='audit'?'created_at DESC':'id'} LIMIT 500`).all();
      if(resource==='highlights')return json(mergeHighlights(result.results));
      if(resource==='pages') {
        const rows=result.results;
        return json([...builtinPages.map(page=>adminPage(page,rows.find(row=>row.id===page.id))),...rows.filter(row=>!pageDefinition(row.id))]);
      }
      if(resource==='images') {
        const mappings=(await db.prepare('SELECT original,image_id FROM image_replacements').all()).results;const hidden=new Set((await db.prepare('SELECT id FROM media_library_hidden').all()).results.map(row=>row.id));
        return json([...builtinImages.filter(image=>!hidden.has(image.id)).map(image=>{const mapping=mappings.find(row=>row.original===image.url);const upload=mapping && result.results.find(row=>row.id===mapping.image_id);return {...image,url:mapping?`/media/${mapping.image_id}`:image.url,original:image.url,replaced:Boolean(mapping),alt:upload?.alt||image.alt};}),...result.results]);
      }
      if(resource==='products') {
        const rows=result.results;
        return json(rows.map(productProfile));
      }
      return json(result.results);
    }
    if(!['POST','PUT','DELETE'].includes(request.method)) throw new HttpError(405,'Méthode refusée');
    checkOrigin(request);
    const log=()=>db.prepare('INSERT INTO audit (id,actor,action,target,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,request.method,`${resource}/${id||'new'}`,new Date().toISOString());
    if(resource==='audit') throw new HttpError(405,'Journal en lecture seule');
    if(resource==='images' && request.method==='POST' && !id) {
      if(!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new HttpError(415,'Formulaire requis');
      // Stream limit before parsing multipart data (including chunked requests).
      const reader=request.body?.getReader(); if(!reader) throw new HttpError(400,'Fichier requis');
      const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024+16384){await reader.cancel();throw new HttpError(413,'Image limitée à 5 Mo');}chunks.push(value);}
      const data=await new Blob(chunks).arrayBuffer();
      const form=await new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')},body:data}).formData();
      const file=form.get('file'); if(!(file instanceof File) || file.size>5*1024*1024 || !file.size) throw new HttpError(400,'Fichier invalide');
      const bytes=new Uint8Array(await file.arrayBuffer()), type=imageType(bytes), key=crypto.randomUUID(), alt=text(form.get('alt'));
      const replacement=form.get('replace');const asset=replacement?builtinImages.find(image=>image.id===replacement):null;
      if(replacement && !asset)throw new HttpError(400,'Image du site inconnue');
      await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
      try {
        const statements=[db.prepare('INSERT INTO images (id,alt,type,size) VALUES (?,?,?,?)').bind(key,alt,type,file.size)];
        if(asset)statements.push(db.prepare('INSERT INTO image_replacements (original,image_id) VALUES (?,?) ON CONFLICT(original) DO UPDATE SET image_id=excluded.image_id').bind(asset.url,key));
        statements.push(log());await db.batch(statements);
      }
      catch(error){await env.BUCKET.delete(key);throw error;}
      return json({id:key,url:`/media/${key}`},201);
    }
    if(resource==='images' && request.method==='DELETE' && id) {
      const result=await deleteMedia(env,id,actor);if(!result.ok)return json({error:result.error,usages:result.usages},409);return json({ok:true});
    }
    if(resource==='highlights') {
      const data=await body(request),state=await db.prepare('SELECT version FROM highlights_state WHERE id=1').first();
      const rows=(await db.prepare('SELECT * FROM highlights ORDER BY position,id LIMIT 500').all()).results;
      const current=id?mergeHighlights(rows).find(item=>item.id===id):null;
      if(id&&(!current||integer(data.version)!==current.version))throw new HttpError(409,'Nouveauté modifiée ailleurs : actualisez puis réessayez');
      if((request.method==='PUT'||request.method==='DELETE')!==Boolean(id))throw new HttpError(405,'Méthode refusée');
      const key=id||(data.id?slug(data.id):crypto.randomUUID());
      if(!id&&(isDefaultHighlight(key)||rows.some(row=>row.id===key)))throw new HttpError(409,'Référence déjà utilisée');
      const item=request.method==='DELETE'?null:validateHighlight(data),changes=highlightChanges(rows,key,item);
      const statements=changes.map(row=>{const fields=Object.keys(row);return db.prepare(`INSERT INTO highlights (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${fields.filter(field=>field!=='id').map(field=>field+'=excluded.'+field).join(',')}`).bind(...Object.values(row));});
      await db.batch([db.prepare('UPDATE highlights_state SET version=? WHERE id=1').bind(state.version+1),...statements,log()]);
      return json({ok:true,id:key},id?200:201);
    }
    if(request.method==='DELETE') {
      if(!id || !['products','pages'].includes(resource)) throw new HttpError(405,'Suppression refusée');
      const b=await body(request), version=integer(b.version);
      if(resource==='products'){
        const reserved=`EXISTS(SELECT 1 FROM orders,json_each(orders.items) line WHERE orders.status IN ('confirmed','preparing','ready') AND json_extract(line.value,'$.id')=products.id) OR EXISTS(SELECT 1 FROM checkout_attempts,json_each(checkout_attempts.items) line WHERE checkout_attempts.status IN ('creating','open') AND json_extract(line.value,'$.id')=products.id)`;
        const results=await db.batch([db.prepare(`UPDATE products SET archived=1,published=0,version=version+1 WHERE id=? AND version=? AND archived=0 AND (${reserved})`).bind(id,version),db.prepare('DELETE FROM products WHERE id=? AND version=? AND archived=0').bind(id,version),log()]);
        if(!results[0].meta.changes&&!results[1].meta.changes)throw new HttpError(409,'Article modifié ailleurs : actualisez puis réessayez');
        return json({ok:true,archived:Boolean(results[0].meta.changes)});
      }
      const result=await db.batch([db.prepare('DELETE FROM pages WHERE id=? AND version=?').bind(id,version),log()]);
      if(!result[0].meta.changes) throw new HttpError(409,'Données modifiées ailleurs : rechargez');
      return json({ok:true});
    }
    const b=await body(request);
    if(['products','pages'].includes(resource)) {
      if((request.method==='PUT')!==Boolean(id)) throw new HttpError(405,'Méthode refusée');
      const key=id||slug(b.id), published=b.published===true?1:0;
      let fields,values;
      if(resource==='products') {
        if(isRecipe(key)) {
          if(b.price_cents!==undefined || b.stock!==undefined)throw new HttpError(400,'Les recettes de découverte ne possèdent pas de prix ni de stock individuels');
          fields=['name','description','image','published'];values=[text(b.name),text(b.description,4000),imagePath(b.image),published];
          if(!id){fields.push('price_cents');values.push(0);}
        } else {
          if(key===BONBON_ID)throw new HttpError(400,'La vente au kilo est retirée. Créez un article maison avec une nouvelle référence.');
          fields=['name','description','price_cents','stock','image','published'];values=[text(b.name),text(b.description,4000),integer(b.price_cents),integer(b.stock,1000000),imagePath(b.image),published];
          if(b.photo_crops!==undefined){fields.push('photo_crops');values.push(JSON.stringify(validatePhotoCrops(b.photo_crops)));}
          if(b.images!==undefined){const images=validateProductImages(b.images);values[fields.indexOf('image')]=images[0]||'';fields.push('images');values.push(JSON.stringify(images));}
          for(const field of ['weight','conservation','ingredients','allergens','food_name','nutrition']){if(b[field]!==undefined){fields.push(field);values.push(b[field]===''?'':text(b[field],field==='weight'?100:8000));}}
        }
      }
      else {fields=['title','body','published'];values=[text(b.title),validatePageBody(key,text(b.body,60000)),published];}
      const firstBuiltinPageSave=resource==='pages' && pageDefinition(key) && id && b.version===0;
      const updating=id && !firstBuiltinPageSave;
      const sql=updating?`UPDATE ${resource} SET ${fields.map(f=>f+'=?').join(',')},version=version+1 WHERE id=? AND version=?${resource==='products'?' AND archived=0':''}`:`INSERT INTO ${resource} (${fields.join(',')},id) VALUES (${fields.map(()=>'?').join(',')},?)`;
      const bindings=updating?[...values,key,integer(b.version)]:[...values,key];
      const result=await db.batch([db.prepare(sql).bind(...bindings),log()]);
      if(updating&&!result[0].meta.changes) throw new HttpError(409,'Données modifiées ailleurs : rechargez');
      return json({ok:true},id?200:201);
    }
    if(resource==='orders' && request.method==='POST' && !id) {
      throw new HttpError(405,'La création manuelle de commandes est désactivée. Les commandes en ligne sont enregistrées après paiement.');
    }
    if(resource==='orders' && request.method==='PUT' && id) {
      const current=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();if(!current)throw new HttpError(404,'Commande introuvable');transition(current.status,b.status);
      if(current.payment_status==='paid'&&b.status==='cancelled')throw new HttpError(409,'Remboursez d’abord le paiement dans Stripe. Une annulation de préparation ne rembourse pas le client.');
      if(b.status==='confirmed' && JSON.parse(current.items).some(line=>!isSale(line.id)))throw new HttpError(409,'Recréez cette commande avec les articles maison actuels');
      const result=await db.batch([db.prepare('UPDATE orders SET status=?,version=version+1 WHERE id=? AND version=?').bind(b.status,id,integer(b.version)),log()]);
      if(!result[0].meta.changes)throw new HttpError(409,'Commande modifiée ailleurs : rechargez');return json({ok:true});
    }
    throw new HttpError(405,'Méthode refusée');
  } catch(error) {
    if(error instanceof HttpError) return json({error:error.message},error.status);
    if(/highlight version conflict/.test(String(error)))return json({error:'Les nouveautés ont changé. Actualisez puis réessayez.'},409);
    if(/UNIQUE constraint/.test(String(error)))return json({error:'Identifiant déjà utilisé'},409);
    if(/sp fixed reference/.test(String(error)))return json({error:'La catégorie et l’unité sont verrouillées après le premier mouvement. Archivez la référence et créez-en une autre.'},409);
    if(/stock|product unavailable/.test(String(error)))return json({error:'Stock insuffisant ou produit supprimé'},409);
    return json({error:'Opération impossible. Vérifiez la configuration et réessayez.'},500);
  }
}
