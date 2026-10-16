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
    let actor;
    try {actor=authorize(request,env);} catch(error) {
      if(error.status===401 && path==='/admin' && request.method==='GET') return new Response(null,{status:302,headers:{...headers,Location:'/signin-with-chatgpt?return_to=%2Fadmin'}});
      throw error;
    }
    if(path==='/admin' && request.method==='GET') {
      const nonce=crypto.randomUUID();
      return new Response(adminHTML(nonce),{headers:{...headers,'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`}});
    }
    if(!path.startsWith('/admin/api/')) return json({error:'Introuvable'},404);
    if(!env.DB || !env.BUCKET) throw new HttpError(503,'Stockage non configuré');
    const db=env.DB;
    const match=path.match(/^\/admin\/api\/(products|pages|images|orders|audit)(?:\/([a-z0-9-]+))?$/);
    if(!match) return json({error:'Introuvable'},404);
    const [,resource,id]=match;
    if(request.method==='GET') {
      if(id) throw new HttpError(405,'Utiliser la liste');
      const result=await db.prepare(`SELECT * FROM ${resource} ORDER BY ${resource==='orders'||resource==='audit'?'created_at DESC':'id'} LIMIT 500`).all();
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
      await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
      try {await db.batch([db.prepare('INSERT INTO images (id,alt,type,size) VALUES (?,?,?,?)').bind(key,alt,type,file.size),log()]);}
      catch(error){await env.BUCKET.delete(key);throw error;}
      return json({id:key,url:`/media/${key}`},201);
    }
    if(resource==='images' && request.method==='DELETE' && id) {
      const used=await db.prepare('SELECT id FROM products WHERE image=? LIMIT 1').bind(`/media/${id}`).first();
      if(used) throw new HttpError(409,'Cette image est utilisée par un produit');
      await db.batch([db.prepare('DELETE FROM images WHERE id=?').bind(id),log()]); await env.BUCKET.delete(id); return json({ok:true});
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
      if(resource==='products') {fields=['name','description','price_cents','stock','image','published'];values=[text(b.name),text(b.description,4000),integer(b.price_cents),integer(b.stock,1000000),imagePath(b.image),published];}
      else {fields=['title','body','published'];values=[text(b.title),text(b.body,20000),published];}
      const sql=id?`UPDATE ${resource} SET ${fields.map(f=>f+'=?').join(',')},version=version+1 WHERE id=? AND version=?`:`INSERT INTO ${resource} (${fields.join(',')},id) VALUES (${fields.map(()=>'?').join(',')},?)`;
      const bindings=id?[...values,key,integer(b.version)]:[...values,key];
      const result=await db.batch([db.prepare(sql).bind(...bindings),log()]);
      if(id&&!result[0].meta.changes) throw new HttpError(409,'Données modifiées ailleurs : rechargez');
      return json({ok:true},id?200:201);
    }
    if(resource==='orders' && request.method==='POST' && !id) {
      if(!Array.isArray(b.items)||!b.items.length||b.items.length>50) throw new HttpError(400,'Articles requis (50 maximum)');
      const seen=new Set(),items=[];let total=0;
      for(const line of b.items){const productId=slug(line.id),qty=integer(line.quantity,1000);if(!qty||seen.has(productId))throw new HttpError(400,'Quantité ou doublon invalide');seen.add(productId);
        const p=await db.prepare('SELECT * FROM products WHERE id=?').bind(productId).first();if(!p)throw new HttpError(400,'Produit inconnu');items.push({id:p.id,name:p.name,price_cents:p.price_cents,quantity:qty});total+=p.price_cents*qty;}
      integer(total);const key=crypto.randomUUID();
      await db.batch([db.prepare('INSERT INTO orders (id,customer,contact,items,total_cents,status,created_at) VALUES (?,?,?,?,?,?,?)').bind(key,text(b.customer),text(b.contact),JSON.stringify(items),total,'draft',new Date().toISOString()),log()]);
      return json({id:key},201);
    }
    if(resource==='orders' && request.method==='PUT' && id) {
      const current=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();if(!current)throw new HttpError(404,'Commande introuvable');transition(current.status,b.status);
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
