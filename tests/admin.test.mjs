import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {authorize,checkOrigin,integer,imagePath,imageType,transition} from '../admin/core.mjs';
import {handleAdmin} from '../admin/handler.mjs';
const origin='https://maison.example';
const req=(path,options={})=>new Request(origin+path,options);
test('administration refuses anonymous users and signed-in non-admins, fails closed without allowlist',()=>{
 assert.throws(()=>authorize(req('/admin'),{ADMIN_USER_IDS:'owner'}),e=>e.status===401);
 assert.throws(()=>authorize(req('/admin',{headers:{'oai-authenticated-user-id':'visitor'}}),{ADMIN_USER_IDS:'owner'}),e=>e.status===403);
 assert.throws(()=>authorize(req('/admin',{headers:{'oai-authenticated-user-id':'owner'}}),{}),e=>e.status===403);
 assert.equal(authorize(req('/admin',{headers:{'oai-authenticated-user-id':'owner'}}),{ADMIN_USER_IDS:'owner'}),'owner');
});
test('cross-origin and missing-origin mutations rejected',()=>{
 for(const value of [null,'https://evil.example'])assert.throws(()=>checkOrigin(req('/admin/api/products',{method:'POST',headers:value?{origin:value}:{}})),e=>e.status===403);
 checkOrigin(req('/admin',{headers:{origin}}));
});
test('input validation rejects negative, fractional, unsafe price and unsafe paths',()=>{
 for(const x of [-1,1.2,NaN,2**53])assert.throws(()=>integer(x));
 for(const x of ['https://evil.example/a.png','/images/../a.png','/images/x.svg','javascript:alert(1)'])assert.throws(()=>imagePath(x));
 assert.equal(imagePath('/images/a.png'),'/images/a.png');assert.throws(()=>imageType(new TextEncoder().encode('<svg/>')));
 assert.throws(()=>transition('completed','draft'));transition('draft','confirmed');
});
test('HTTP boundary protects all admin routes, preserves public routes, returns no-store and CSP',async()=>{
 const env={ADMIN_USER_IDS:'owner'};
 assert.equal(await handleAdmin(req('/'),env),null);
 assert.equal((await handleAdmin(req('/admin'),env)).status,302);
 assert.equal((await handleAdmin(req('/admin/api/products'),env)).status,401);
 assert.equal((await handleAdmin(req('/admin/nested',{headers:{'oai-authenticated-user-id':'other'}}),env)).status,403);
 const response=await handleAdmin(req('/admin',{headers:{'oai-authenticated-user-id':'owner'}}),env);
 assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(response.headers.get('cache-control'),/no-store/);
});
function database(){const db=new DatabaseSync(':memory:');for(const p of JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8')).entries.map(entry=>entry.tag+'.sql'))db.exec(readFileSync(new URL('../drizzle/'+p,import.meta.url),'utf8'));return db;}
test('migrations reserve, prevent overselling, roll back failed confirmation, and release stock once',()=>{
 const db=database();db.exec("INSERT INTO products (id,name,description,price_cents,stock) VALUES ('p','Praliné','Maison',100,3)");
 const insert=db.prepare('INSERT INTO orders (id,customer,contact,items,total_cents,created_at) VALUES (?,?,?,?,?,?)');
 const items=JSON.stringify([{id:'p',quantity:2,name:'Praliné',price_cents:100}]);for(const id of ['a','b'])insert.run(id,'Client','contact',items,200,'2026-10-16');
 db.exec("UPDATE orders SET status='confirmed' WHERE id='a'");assert.equal(db.prepare("SELECT stock FROM products").get().stock,1);
 assert.throws(()=>db.exec("UPDATE orders SET status='confirmed' WHERE id='b'"),/stock/);assert.equal(db.prepare("SELECT status FROM orders WHERE id='b'").get().status,'draft');
 assert.throws(()=>db.exec("DELETE FROM products WHERE id='p'"),/reserved/);
 db.exec("UPDATE orders SET status='cancelled' WHERE id='a'");assert.equal(db.prepare('SELECT stock FROM products').get().stock,3);
 db.exec("UPDATE orders SET status='cancelled' WHERE id='a'");assert.equal(db.prepare('SELECT stock FROM products').get().stock,3);db.close();
});
test('optimistic version prevents silent overwrite after stock reservation',()=>{
 const db=database();db.exec("INSERT INTO products (id,name,description,price_cents,stock) VALUES ('p','Praliné','Maison',100,3)");
 db.exec("UPDATE products SET stock=2,version=version+1 WHERE id='p'");assert.equal(db.prepare("UPDATE products SET stock=100 WHERE id='p' AND version=1").run().changes,0);db.close();
});
function bindings(){
 const sqlite=database();
 function statement(sql,values=[]){return {bind(...args){return statement(sql,args);},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},execute(){const result=sqlite.prepare(sql).run(...values);return {meta:{changes:result.changes},success:true};}};}
 const DB={prepare:sql=>statement(sql),async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.execute());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 const files=new Map();const BUCKET={async put(key,bytes,options){files.set(key,{body:bytes,httpMetadata:options.httpMetadata});},async get(key){return files.get(key);},async delete(key){files.delete(key);}};
 return {DB,BUCKET,ADMIN_USER_IDS:'owner',sqlite};
}
async function call(env,path,method='GET',body){return handleAdmin(req('/admin/api/'+path,{method,headers:{'oai-authenticated-user-id':'owner',origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env);}
test('CRUD and complete order workflow through authenticated HTTP boundary',async()=>{
 const env=bindings();
 const p={id:'praline',name:'Praliné',description:'Maison',price_cents:750,stock:3,image:'',published:true};
 assert.equal((await call(env,'products','POST',p)).status,201);
 assert.equal((await call(env,'products','POST',p)).status,409);
 assert.equal((await call(env,'products/praline','PUT',{...p,version:1,stock:-1})).status,400);
 assert.equal((await call(env,'products/praline','PUT',{...p,version:0})).status,409);
 const order={customer:'Client',contact:'client@example.test',items:[{id:'praline',quantity:2}]};
 const response=await call(env,'orders','POST',order);assert.equal(response.status,201);const {id}=await response.json();
 assert.equal((await call(env,'orders/'+id,'PUT',{status:'confirmed',version:1})).status,200);
 assert.equal((await call(env,'products/praline','DELETE',{version:2})).status,409);
 assert.equal((await call(env,'products/praline','PUT',{...p,version:1})).status,409);
 assert.equal((await (await call(env,'products')).json()).find(p=>p.id==='praline').stock,1);
 assert.equal((await call(env,'orders/'+id,'PUT',{status:'completed',version:2})).status,409);
 assert.equal((await call(env,'orders/'+id,'PUT',{status:'cancelled',version:2})).status,200);
 assert.equal((await (await call(env,'products')).json()).find(p=>p.id==='praline').stock,3);
 assert.equal((await call(env,'pages','POST',{id:'livraison',title:'Livraison',body:'Informations',published:true})).status,201);
 assert.equal((await call(env,'pages/livraison','PUT',{title:'Retrait',body:'En boutique',published:false,version:1})).status,200);
 assert.equal((await call(env,'pages/livraison','DELETE',{version:2})).status,200);
 assert.ok((await (await call(env,'audit')).json()).length>0);env.sqlite.close();
});
test('uploads enforce format and image deletion protects referenced products',async()=>{
 const env=bindings();const form=new FormData();form.set('alt','Praliné');form.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'image.png',{type:'image/png'}));
 const upload=await handleAdmin(req('/admin/api/images',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin},body:form}),env);
 assert.equal(upload.status,201);const image=await upload.json();
 assert.equal((await handleAdmin(req(image.url),env)).headers.get('content-type'),'image/png');
 await call(env,'products','POST',{id:'p',name:'Produit',description:'Maison',price_cents:100,stock:1,image:image.url,published:false});
 assert.equal((await call(env,'images/'+image.id,'DELETE')).status,409);
 assert.equal((await call(env,'products/p','DELETE',{version:1})).status,200);
 assert.equal((await call(env,'images/'+image.id,'DELETE')).status,200);
 assert.equal((await handleAdmin(req(image.url),env)).status,404);env.sqlite.close();
});

test('one-time activation requires both signed-in identity and private expiring token, imports existing catalogue',async()=>{
 const env=bindings();delete env.ADMIN_USER_IDS;
 const token=crypto.randomUUID()+crypto.randomUUID();
 env.ADMIN_SETUP_TOKEN_HASH=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
 env.ADMIN_SETUP_EXPIRES_AT=new Date(Date.now()+60000).toISOString();
 const claim=(user,key=token,from=origin)=>handleAdmin(req('/admin/api/claim',{method:'POST',headers:{...(user?{'oai-authenticated-user-id':user}:{}),origin:from,'X-Admin-Setup-Token':key}}),env);
 assert.equal((await claim(null)).status,401);
 assert.equal((await claim('owner','wrong')).status,403);
 assert.equal((await claim('owner',token,'https://evil.example')).status,403);
 env.ADMIN_SETUP_EXPIRES_AT='2000-01-01';assert.equal((await claim('owner')).status,403);
 env.ADMIN_SETUP_EXPIRES_AT=new Date(Date.now()+60000).toISOString();
 assert.equal((await claim('owner')).status,200);
 assert.equal((await claim('intruder')).status,409);
 assert.equal((await claim('owner')).status,200);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM products').get().n,16);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM products WHERE published=1').get().n,15);
 assert.equal((await call(env,'products')).status,200);
 assert.equal((await handleAdmin(req('/admin/api/products',{headers:{'oai-authenticated-user-id':'intruder'}}),env)).status,403);
 const rows=await (await call(env,'products')).json();assert.equal(rows.length,16);
 assert.equal((await call(env,'orders','POST',{customer:'Client',contact:'test',items:[{id:'bonbon-1',quantity:1}]})).status,400);
 env.sqlite.close();
});

test('one shared Bonbon price, discovery recipes excluded from orders and gram stock reserved atomically',async()=>{
 const env=bindings();
 let rows=await (await call(env,'products')).json();const common=rows.find(p=>p.id==='bonbon');
 assert.equal(common.name,'Bonbon');assert.equal(common.price_cents,10600);assert.equal(common.unit,'kg');
 assert.equal(env.sqlite.prepare("SELECT COUNT(*) AS n FROM products WHERE id='bonbon'").get().n,0);
 const product={id:'bonbon',name:'Bonbon',description:'Assortiment maison',price_cents:10600,stock:1000,image:'',published:false,version:0};
 assert.equal((await call(env,'products/bonbon','PUT',product)).status,200);
 assert.equal((await call(env,'products/bonbon','PUT',product)).status,409);
 const recipe={id:'bonbon-decouverte',name:'Découverte',description:'Notre recette',image:'',published:true};
 assert.equal((await call(env,'products','POST',recipe)).status,201);
 assert.equal((await call(env,'products/bonbon-decouverte','PUT',{...recipe,price_cents:100,version:1})).status,400);
 rows=await (await call(env,'products')).json();const discovery=rows.find(p=>p.id===recipe.id);
 assert.equal(discovery.kind,'recipe');assert.equal(discovery.price_cents,undefined);assert.equal(discovery.stock,undefined);
 const order={customer:'Client',contact:'contact',items:[{id:'bonbon',quantity:250}]};
 assert.equal((await call(env,'orders','POST',{...order,items:[{id:recipe.id,quantity:1}]})).status,400);
 const created=await call(env,'orders','POST',order);assert.equal(created.status,201);const {id}=await created.json();
 const stored=env.sqlite.prepare('SELECT * FROM orders WHERE id=?').get(id);
 assert.equal(stored.total_cents,2650);assert.equal(JSON.parse(stored.items)[0].unit,'g');assert.equal(JSON.parse(stored.items)[0].line_total_cents,2650);
 assert.equal((await call(env,'orders/'+id,'PUT',{status:'confirmed',version:1})).status,200);
 assert.equal(env.sqlite.prepare("SELECT stock FROM products WHERE id='bonbon'").get().stock,750);
 assert.equal((await call(env,'orders/'+id,'PUT',{status:'cancelled',version:2})).status,200);
 assert.equal(env.sqlite.prepare("SELECT stock FROM products WHERE id='bonbon'").get().stock,1000);
 const tooMuch=await (await call(env,'orders','POST',{...order,items:[{id:'bonbon',quantity:1001}]})).json();
 assert.equal((await call(env,'orders/'+tooMuch.id,'PUT',{status:'confirmed',version:1})).status,409);
 assert.equal(env.sqlite.prepare("SELECT stock FROM products WHERE id='bonbon'").get().stock,1000);
 const kilo=await (await call(env,'orders','POST',{...order,items:[{id:'bonbon',quantity:1000}]})).json();
 assert.equal(env.sqlite.prepare('SELECT total_cents FROM orders WHERE id=?').get(kilo.id).total_cents,10600);
 const gram=await (await call(env,'orders','POST',{...order,items:[{id:'bonbon',quantity:1}]})).json();
 assert.equal(env.sqlite.prepare('SELECT total_cents FROM orders WHERE id=?').get(gram.id).total_cents,11);
 assert.equal((await call(env,'orders','POST',{...order,items:[{id:'bonbon',quantity:0.25}]})).status,400);
 assert.equal((await call(env,'products/bonbon','DELETE',{version:3})).status,400);
 env.sqlite.close();
});

test('existing pages are listed on an empty database and edited without replacing their layout',async()=>{
 const env=bindings();
 const pages=await (await call(env,'pages')).json();
 assert.deepEqual(pages.map(p=>p.id),['accueil','maison','savoir-faire','bonbons']);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM pages').get().n,0);
 const home=pages.find(p=>p.id==='accueil');assert.equal(home.builtin,true);assert.equal(home.version,0);
 assert.equal(home.fields.find(f=>f.key==='heroTitle').value,'Le chocolat artisanal,\nau cœur du Havre.');
 const fields=Object.fromEntries(home.fields.map(f=>[f.key,f.value]));fields.heroTitle='Nouveau titre';fields.phone='02 35 00 00 00';
 const payload={title:home.title,body:JSON.stringify({format:'site-fields-v1',fields}),published:true,version:0};
 assert.equal((await call(env,'pages/accueil','PUT',payload)).status,200);
 assert.equal((await call(env,'pages/accueil','PUT',payload)).status,409);
 let updated=(await (await call(env,'pages')).json()).find(p=>p.id==='accueil');
 assert.equal(updated.fields.find(f=>f.key==='heroTitle').value,'Nouveau titre');
 assert.equal(updated.fields.find(f=>f.key==='shopTitle').value,'Venez nous rencontrer');
 assert.equal((await call(env,'pages/accueil','PUT',{...payload,body:JSON.stringify({format:'site-fields-v1',fields:{email:'invalide'}}),version:1})).status,400);
 assert.equal((await call(env,'pages/accueil','PUT',{...payload,body:'null',version:1})).status,400);
 assert.equal((await call(env,'pages/accueil','PUT',{...payload,body:JSON.stringify({format:'site-fields-v1',fields:{unknown:'Champ inventé'}}),version:1})).status,400);
 assert.equal((await call(env,'pages/accueil','DELETE',{version:1})).status,200);
 updated=(await (await call(env,'pages')).json()).find(p=>p.id==='accueil');assert.equal(updated.version,0);assert.equal(updated.fields.find(f=>f.key==='heroTitle').value,'Le chocolat artisanal,\nau cœur du Havre.');
 env.sqlite.close();
});

test('existing images are visible, replacement is reversible and used uploads cannot be deleted',async()=>{
 const env=bindings();let images=await (await call(env,'images')).json();
 assert.equal(images.filter(image=>image.static).length,21);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM images').get().n,0);
 const asset=images.find(image=>image.id==='asset-logo');assert.equal(asset.url,'/images/logo-boutique-neon.webp');
 const form=new FormData();form.set('alt','Nouvelle enseigne');form.set('replace',asset.id);form.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'enseigne.png',{type:'image/png'}));
 const upload=await handleAdmin(req('/admin/api/images',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin},body:form}),env);
 assert.equal(upload.status,201);const uploaded=await upload.json();
 images=await (await call(env,'images')).json();const replaced=images.find(image=>image.id===asset.id);
 assert.equal(replaced.url,uploaded.url);assert.equal(replaced.replaced,true);assert.equal(replaced.alt,'Nouvelle enseigne');
 assert.equal((await call(env,'images/'+uploaded.id,'DELETE')).status,409);
 assert.equal((await call(env,'image-replacements/'+asset.id,'DELETE')).status,200);
 images=await (await call(env,'images')).json();assert.equal(images.find(image=>image.id===asset.id).url,asset.url);
 assert.equal((await call(env,'images/'+uploaded.id,'DELETE')).status,200);
 assert.equal((await call(env,'image-replacements/asset-unknown','DELETE')).status,404);
 env.sqlite.close();
});

test('admin interface exposes edit controls for the four existing pages and replace controls for site images',async()=>{
 const {Script,createContext}=await import('node:vm');const {adminHTML}=await import('../admin/ui.mjs');
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.value='';this.checked=false;this.textContent='';}
  append(child){this.children.push(child);}
  replaceChildren(...children){this.children=children;}
  setAttribute(key,value){this[key]=value;}
  click(){return this.onclick?.();}
  showModal(){this.open=true;}
  close(){this.open=false;}
 }
 const env=bindings();const tabs=['products','recipes','pages','images','orders','audit'].map(tab=>{const b=new Element('button');b.dataset.tab=tab;return b;});
 const nodes=new Map(['title','help','stats','add','reload','search','message','list','dialog','form','form-title','fields','form-error','save','close'].map(id=>['#'+id,new Element(id)]));
 const document={createElement:tag=>new Element(tag),querySelector:selector=>selector==='[data-tab]'?tabs[0]:nodes.get(selector),querySelectorAll:()=>tabs};
 const context=createContext({document,FormData,confirm:()=>false,fetch:async(path,options={})=>handleAdmin(req(path,{...options,headers:{...options.headers,'oai-authenticated-user-id':'owner',...(options.method&&options.method!=='GET'?{origin}:{})}}),env)});
 new Script(adminHTML('test').match(/<script[^>]*>([\s\S]*)<\/script>/)[1]).runInContext(context);
 const settle=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
 await settle();tabs.find(b=>b.dataset.tab==='pages').onclick();await settle();
 let cards=nodes.get('#list').children.filter(n=>n.tag==='article');assert.equal(cards.length,4);
 for(const card of cards)assert.ok(card.children.some(node=>node.tag==='button'&&node.textContent==='Modifier'));
 await cards[0].children.find(node=>node.tag==='button'&&node.textContent==='Modifier').onclick();assert.equal(nodes.get('#dialog').open,true);
 assert.ok(nodes.get('#fields').children.some(label=>label.children.some(input=>input.name==='content_heroTitle'&&input.value.includes('Le chocolat artisanal'))));
 tabs.find(b=>b.dataset.tab==='images').onclick();await settle();cards=nodes.get('#list').children.filter(n=>n.tag==='article');assert.equal(cards.length,21);
 assert.ok(cards[0].children.some(node=>node.tag==='button'&&node.textContent==='Remplacer'));
 env.sqlite.close();
});
