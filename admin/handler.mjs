import { defaultAppearance, appearanceValues, validateAppearance } from './appearance.mjs';
import { appearanceHTML } from './appearance-ui.mjs';
import { defaultHighlights, isDefaultHighlight, mergeHighlights, validateHighlight } from './highlights.mjs';
import { builtinPages } from '../data/site-content.mjs';
import { builtinImages } from '../data/site-assets.mjs';
import { adminPage, pageDefinition, validatePageBody } from './content.mjs';
import { BONBON_ID, isSale, isRecipe, productProfile, lineTotal } from './products.mjs';
import { claimAdmin, setupHTML } from './setup.mjs';
import { authorize, checkOrigin, text, integer, slug, imagePath, transition, imageType, HttpError } from './core.mjs';
import { adminHTML } from './ui.mjs';
const headers = {'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin', 'X-Frame-Options':'DENY'};
const json = (data, status=200) => Response.json(data, {status, headers});
async function body(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'JSON requis');
  if (Number(request.headers.get('content-length')) > 65536) throw new HttpError(413, 'Requête trop volumineuse');
  const reader=request.body?.getReader(); let size=0; const chunks=[];
  if (!reader) throw new HttpError(400,'Corps requis');
  while (true) {const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>65536){await reader.cancel();throw new HttpError(413,'Requête trop volumineuse');} chunks.push(value);}
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
    let actor;
    try {
      try {actor=authorize(request,env);} catch(error) {
        const user=request.headers.get('oai-authenticated-user-id');
        const grant=user && env.DB ? await env.DB.prepare('SELECT user_id FROM admin_access WHERE slot=1 AND user_id=?').bind(user).first() : null;
        if(!grant)throw error;actor=user;
      }
    } catch(error) {
      if(error.status===401 && path==='/admin' && request.method==='GET') return new Response(null,{status:302,headers:{...headers,Location:'/signin-with-chatgpt?return_to=%2Fadmin'}});
      throw error;
    }
    if(path==='/admin/apparence' && request.method==='GET') {
      const nonce=crypto.randomUUID();return new Response(appearanceHTML(nonce),{headers:{...headers,'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; frame-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`}});
    }
    if(path==='/admin' && request.method==='GET') {
      const nonce=crypto.randomUUID();
      return new Response(adminHTML(nonce),{headers:{...headers,'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`}});
    }
    if(!path.startsWith('/admin/api/')) return json({error:'Introuvable'},404);
    if(!env.DB || !env.BUCKET) throw new HttpError(503,'Stockage non configuré');
    const db=env.DB;
    if(path==='/admin/api/appearance'){
      if(request.method==='GET'){const row=await db.prepare("SELECT body,version FROM site_settings WHERE id='appearance'").first();return json({settings:row?appearanceValues(row.body):defaultAppearance,defaults:defaultAppearance,version:row?.version??0});}
      if(request.method!=='PUT')throw new HttpError(405,'Méthode refusée');checkOrigin(request);const data=await body(request),settings=validateAppearance(data.settings),version=integer(data.version);
      const change=version===0?db.prepare("INSERT OR IGNORE INTO site_settings (id,body) VALUES ('appearance',?)").bind(JSON.stringify(settings)):db.prepare("UPDATE site_settings SET body=?,version=version+1 WHERE id='appearance' AND version=?").bind(JSON.stringify(settings),version);
      const [result]=await db.batch([change,db.prepare('INSERT INTO audit (id,actor,action,target,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,'UPDATE_APPEARANCE','appearance',new Date().toISOString())]);
      if(result.meta.changes!==1)throw new HttpError(409,'Les réglages ont changé dans une autre session. Rechargez la page avant de modifier à nouveau.');
      return json({settings,version:version+1});
    }
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
      const result=await db.prepare(`SELECT * FROM ${resource} ORDER BY ${resource==='orders'||resource==='audit'?'created_at DESC':'id'} LIMIT 500`).all();
      if(resource==='highlights')return json(mergeHighlights(result.results));
      if(resource==='pages') {
        const rows=result.results;
        return json([...builtinPages.map(page=>adminPage(page,rows.find(row=>row.id===page.id))),...rows.filter(row=>!pageDefinition(row.id))]);
      }
      if(resource==='images') {
        const mappings=(await db.prepare('SELECT original,image_id FROM image_replacements').all()).results;
        return json([...builtinImages.map(image=>{const mapping=mappings.find(row=>row.original===image.url);const upload=mapping && result.results.find(row=>row.id===mapping.image_id);return {...image,url:mapping?`/media/${mapping.image_id}`:image.url,original:image.url,replaced:Boolean(mapping),alt:upload?.alt||image.alt};}),...result.results]);
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
      const used=await db.prepare('SELECT id FROM products WHERE image=? LIMIT 1').bind(`/media/${id}`).first();
      if(used) throw new HttpError(409,'Cette image est utilisée par un produit');
      const replacement=await db.prepare('SELECT original FROM image_replacements WHERE image_id=? LIMIT 1').bind(id).first();
      if(replacement)throw new HttpError(409,'Cette image est actuellement utilisée sur le site ; restaurez ou remplacez-la avant suppression');
      const highlight=await db.prepare('SELECT id FROM highlights WHERE image=? LIMIT 1').bind(`/media/${id}`).first();
      if(highlight)throw new HttpError(409,'Cette image est utilisée par une mise à la une ou une nouveauté');
      await db.batch([db.prepare('DELETE FROM images WHERE id=?').bind(id),log()]); await env.BUCKET.delete(id); return json({ok:true});
    }
    if(resource==='highlights') {
      if(request.method==='DELETE'){
        if(!id)throw new HttpError(405,'Choisissez une nouveauté');const data=await body(request),version=integer(data.version);
        if(isDefaultHighlight(id)){
          if(version===0){
            const item=defaultHighlights.find(item=>item.id===id),fields=['id','placement','kicker','title','description','image','alt','image_fit','button_label','href','position'];
            await db.batch([db.prepare(`INSERT INTO highlights (${fields.join(',')},published) VALUES (${fields.map(()=>'?').join(',')},0)`).bind(...fields.map(field=>item[field])),log()]);
          }else{
            const result=await db.batch([db.prepare('UPDATE highlights SET published=0,version=version+1 WHERE id=? AND version=?').bind(id,version),log()]);
            if(!result[0].meta.changes)throw new HttpError(409,'Contenu modifié ailleurs : rechargez');
          }
        }else{
          const result=await db.batch([db.prepare('DELETE FROM highlights WHERE id=? AND version=?').bind(id,version),log()]);
          if(!result[0].meta.changes)throw new HttpError(409,'Contenu modifié ailleurs : rechargez');
        }
        return json({ok:true});
      }
      if((request.method==='PUT')!==Boolean(id))throw new HttpError(405,'Méthode refusée');
      const data=await body(request),item=validateHighlight(data),key=id||(data.id?slug(data.id):crypto.randomUUID());
      if(!id && isDefaultHighlight(key))throw new HttpError(409,'Modifiez le contenu existant');
      const fields=Object.keys(item),firstSave=id && isDefaultHighlight(id) && data.version===0,updating=id&&!firstSave;
      const sql=updating?`UPDATE highlights SET ${fields.map(field=>field+'=?').join(',')},version=version+1 WHERE id=? AND version=?`:`INSERT INTO highlights (${fields.join(',')},id) VALUES (${fields.map(()=>'?').join(',')},?)`;
      const values=updating?[...Object.values(item),key,integer(data.version)]:[...Object.values(item),key];
      const result=await db.batch([db.prepare(sql).bind(...values),log()]);
      if(updating&&!result[0].meta.changes)throw new HttpError(409,'Contenu modifié ailleurs : rechargez');
      return json({id:key},id?200:201);
    }
    if(request.method==='DELETE') {
      if(!id || !['products','pages'].includes(resource)) throw new HttpError(405,'Suppression refusée');
      const b=await body(request), version=integer(b.version);
      const result=await db.batch([db.prepare(`DELETE FROM ${resource} WHERE id=? AND version=?`).bind(id,version),log()]);
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
        }
      }
      else {fields=['title','body','published'];values=[text(b.title),validatePageBody(key,text(b.body,60000)),published];}
      const firstBuiltinPageSave=resource==='pages' && pageDefinition(key) && id && b.version===0;
      const updating=id && !firstBuiltinPageSave;
      const sql=updating?`UPDATE ${resource} SET ${fields.map(f=>f+'=?').join(',')},version=version+1 WHERE id=? AND version=?`:`INSERT INTO ${resource} (${fields.join(',')},id) VALUES (${fields.map(()=>'?').join(',')},?)`;
      const bindings=updating?[...values,key,integer(b.version)]:[...values,key];
      const result=await db.batch([db.prepare(sql).bind(...bindings),log()]);
      if(updating&&!result[0].meta.changes) throw new HttpError(409,'Données modifiées ailleurs : rechargez');
      return json({ok:true},id?200:201);
    }
    if(resource==='orders' && request.method==='POST' && !id) {
      if(!Array.isArray(b.items)||!b.items.length||b.items.length>50) throw new HttpError(400,'Articles requis (50 maximum)');
      const seen=new Set(),items=[];let total=0;
      for(const line of b.items){const productId=slug(line.id),qty=integer(line.quantity,1000);if(!qty||seen.has(productId))throw new HttpError(400,'Quantité ou doublon invalide');seen.add(productId);
        const p=await db.prepare('SELECT * FROM products WHERE id=?').bind(productId).first();if(!p)throw new HttpError(400,'Enregistrez d’abord le produit et son stock');if(!isSale(p.id))throw new HttpError(400,'Choisissez un article maison vendu à la pièce.');if(p.price_cents<=0)throw new HttpError(400,'Renseignez le prix du produit avant de créer une commande');items.push({id:p.id,name:p.name,price_cents:p.price_cents,quantity:qty,unit:'piece',line_total_cents:lineTotal(p,qty)});total+=lineTotal(p,qty);}
      integer(total);const key=crypto.randomUUID();
      await db.batch([db.prepare('INSERT INTO orders (id,customer,contact,items,total_cents,status,created_at) VALUES (?,?,?,?,?,?,?)').bind(key,text(b.customer),text(b.contact),JSON.stringify(items),total,'draft',new Date().toISOString()),log()]);
      return json({id:key},201);
    }
    if(resource==='orders' && request.method==='PUT' && id) {
      const current=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();if(!current)throw new HttpError(404,'Commande introuvable');transition(current.status,b.status);
      if(b.status==='confirmed' && JSON.parse(current.items).some(line=>!isSale(line.id)))throw new HttpError(409,'Recréez cette commande avec les articles maison actuels');
      const result=await db.batch([db.prepare('UPDATE orders SET status=?,version=version+1 WHERE id=? AND version=?').bind(b.status,id,integer(b.version)),log()]);
      if(!result[0].meta.changes)throw new HttpError(409,'Commande modifiée ailleurs : rechargez');return json({ok:true});
    }
    throw new HttpError(405,'Méthode refusée');
  } catch(error) {
    if(error instanceof HttpError) return json({error:error.message},error.status);
    if(/UNIQUE constraint/.test(String(error)))return json({error:'Identifiant déjà utilisé'},409);
    if(/stock|product unavailable/.test(String(error)))return json({error:'Stock insuffisant ou produit supprimé'},409);
    return json({error:'Opération impossible. Vérifiez la configuration et réessayez.'},500);
  }
}
