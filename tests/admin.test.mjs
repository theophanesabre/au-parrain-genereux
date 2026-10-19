import test from 'node:test';
import {builtinImages} from '../data/site-assets.mjs';
import {defaultHighlights} from '../admin/highlights.mjs';
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
 assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/admin/puck');assert.match(response.headers.get('cache-control'),/no-store/);
});
function database(){const db=new DatabaseSync(':memory:');for(const p of JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8')).entries.map(entry=>entry.tag+'.sql'))db.exec(readFileSync(new URL('../drizzle/'+p,import.meta.url),'utf8'));return db;}
test('migrations reserve, prevent overselling, roll back failed confirmation, and release stock once',()=>{
 const db=database();db.exec("INSERT INTO products (id,name,description,price_cents,stock) VALUES ('p','Praliné','Maison',100,3)");
 const insert=db.prepare('INSERT INTO orders (id,customer,contact,items,total_cents,created_at) VALUES (?,?,?,?,?,?)');
 const items=JSON.stringify([{id:'p',quantity:2,name:'Praliné',price_cents:100}]);for(const id of ['a','b'])insert.run(id,'Client','contact',items,200,'2026-10-16');
 db.exec("UPDATE orders SET status='confirmed' WHERE id='a'");assert.equal(db.prepare("SELECT stock FROM products WHERE id='p'").get().stock,1);
 assert.throws(()=>db.exec("UPDATE orders SET status='confirmed' WHERE id='b'"),/stock/);assert.equal(db.prepare("SELECT status FROM orders WHERE id='b'").get().status,'draft');
 assert.throws(()=>db.exec("DELETE FROM products WHERE id='p'"),/reserved/);
 db.exec("UPDATE orders SET status='cancelled' WHERE id='a'");assert.equal(db.prepare("SELECT stock FROM products WHERE id='p'").get().stock,3);
 db.exec("UPDATE orders SET status='cancelled' WHERE id='a'");assert.equal(db.prepare("SELECT stock FROM products WHERE id='p'").get().stock,3);db.close();
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
 assert.equal((await call(env,'products/praline','DELETE',{version:1})).status,409);
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
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM products').get().n,17);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM products WHERE published=1').get().n,17);
 assert.equal((await call(env,'products')).status,200);
 assert.equal((await handleAdmin(req('/admin/api/products',{headers:{'oai-authenticated-user-id':'intruder'}}),env)).status,403);
 const rows=await (await call(env,'products')).json();assert.equal(rows.length,17);
 assert.equal((await call(env,'orders','POST',{customer:'Client',contact:'test',items:[{id:'bonbon-1',quantity:1}]})).status,400);
 env.sqlite.close();
});

test('each house article has its own price and stock; weight sales are retired without breaking historical orders',async()=>{
 const env=bindings();assert.equal((await (await call(env,'products')).json()).some(p=>p.id==='bonbon'),false);
 const box={id:'boite-maison',name:'Boîte maison',description:'Sélection préparée par la maison',price_cents:2600,stock:8,image:'',published:true};
 assert.equal((await call(env,'products','POST',box)).status,201);
 assert.equal((await call(env,'products/boite-maison','PUT',{...box,name:'Coffret signature',price_cents:2800,version:1})).status,200);
 const order={customer:'Client',contact:'contact',items:[{id:box.id,quantity:2}]};const created=await (await call(env,'orders','POST',order)).json();const stored=env.sqlite.prepare('SELECT * FROM orders WHERE id=?').get(created.id);assert.equal(stored.total_cents,5600);assert.equal(JSON.parse(stored.items)[0].unit,'piece');
 assert.equal((await call(env,'orders/'+created.id,'PUT',{status:'confirmed',version:1})).status,200);assert.equal(env.sqlite.prepare('SELECT stock FROM products WHERE id=?').get(box.id).stock,6);
 const recipe={id:'bonbon-decouverte',name:'Découverte',description:'Recette',image:'',published:true};assert.equal((await call(env,'products','POST',recipe)).status,201);assert.equal((await call(env,'orders','POST',{...order,items:[{id:recipe.id,quantity:1}]})).status,400);
 assert.equal((await call(env,'products','POST',{...box,id:'bonbon'})).status,400);
 env.sqlite.exec("INSERT INTO products (id,name,description,price_cents,stock,published) VALUES ('bonbon','Bonbon','Ancien article au poids',10600,1000,1)");
 env.sqlite.exec(readFileSync(new URL('../drizzle/0006_retire_weight_sales.sql',import.meta.url),'utf8'));assert.equal(env.sqlite.prepare("SELECT published FROM products WHERE id='bonbon'").get().published,0);
 assert.equal((await call(env,'orders','POST',{...order,items:[{id:'bonbon',quantity:250}]})).status,400);
 const oldItems=JSON.stringify([{id:'bonbon',name:'Bonbon',price_cents:10600,quantity:250,unit:'g',line_total_cents:2650}]);env.sqlite.prepare("INSERT INTO orders (id,customer,contact,items,total_cents,status,created_at) VALUES ('legacy','Client','contact',?,2650,'draft','2026-10-16')").run(oldItems);
 assert.equal((await call(env,'orders/legacy','PUT',{status:'confirmed',version:1})).status,409);
 env.sqlite.exec("UPDATE orders SET status='confirmed' WHERE id='legacy'");assert.equal((await call(env,'orders/legacy','PUT',{status:'cancelled',version:1})).status,200);assert.equal(env.sqlite.prepare("SELECT stock FROM products WHERE id='bonbon'").get().stock,1000);assert.equal(env.sqlite.prepare("SELECT total_cents FROM orders WHERE id='legacy'").get().total_cents,2650);
 const retired=(await (await call(env,'products')).json()).find(p=>p.id==='bonbon');assert.equal(retired.kind,'retired');assert.equal(retired.published,0);
 assert.equal((await call(env,'products/bonbon','DELETE',{version:retired.version})).status,200);env.sqlite.close();
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
 assert.equal(images.filter(image=>image.static).length,builtinImages.length);
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
  addEventListener(){}
  click(){return this.onclick?.();}
  showModal(){this.open=true;}
  close(){this.open=false;}
 }
 const env=bindings();const tabs=['products','recipes','highlights','pages','images','orders','audit'].map(tab=>{const b=new Element('button');b.dataset.tab=tab;return b;});
 const nodes=new Map(['stock-alerts','title','help','stats','add','reload','search','message','list','dialog','form','form-title','fields','form-error','save','close'].map(id=>['#'+id,new Element(id)]));
 const document={createElement:tag=>new Element(tag),querySelector:selector=>selector==='[data-tab]'?tabs[0]:nodes.get(selector),querySelectorAll:()=>tabs};
 const context=createContext({document,URLSearchParams,location:{search:"",origin},FormData,AbortController,setTimeout,clearTimeout,confirm:()=>false,fetch:async(path,options={})=>handleAdmin(req(path,{...options,headers:{...options.headers,'oai-authenticated-user-id':'owner',...(options.method&&options.method!=='GET'?{origin}:{})}}),env)});
 new Script(adminHTML('test').match(/<script[^>]*>([\s\S]*)<\/script>/)[1]).runInContext(context);
 const settle=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
 await settle();assert.equal(nodes.get('#stock-alerts').hidden,false);assert.ok(nodes.get('#stock-alerts').children.some(node=>node.textContent.includes('Le Conte de l’Avent')));await call(env,'products','POST',{id:'coffret-alerte',name:'Coffret',description:'Maison',price_cents:1800,stock:0,image:'',published:true});await tabs.find(b=>b.dataset.tab==='products').onclick();await settle();assert.equal(nodes.get('#stock-alerts').hidden,false);assert.ok(nodes.get('#stock-alerts').children.some(node=>node.textContent.includes('rupture de stock')));tabs.find(b=>b.dataset.tab==='pages').onclick();await settle();
 let cards=nodes.get('#list').children.filter(n=>n.tag==='article');assert.equal(cards.length,4);
 for(const card of cards)assert.ok(card.children.some(node=>node.tag==='button'&&node.textContent==='Modifier'));
 await cards[0].children.find(node=>node.tag==='button'&&node.textContent==='Modifier').onclick();assert.equal(nodes.get('#dialog').open,true);
 assert.ok(nodes.get('#fields').children.some(label=>label.children.some(input=>input.name==='content_heroTitle'&&input.value.includes('Le chocolat artisanal'))));
 tabs.find(b=>b.dataset.tab==='images').onclick();await settle();cards=nodes.get('#list').children.filter(n=>n.tag==='article');assert.equal(cards.length,builtinImages.length);
 assert.ok(cards[0].children.some(node=>node.tag==='button'&&node.textContent==='Remplacer'));
 tabs.find(b=>b.dataset.tab==='highlights').onclick();await settle();cards=nodes.get('#list').children.filter(n=>n.tag==='article');assert.equal(cards.length,defaultHighlights.length);
 await cards[0].children.find(node=>node.tag==='button'&&node.textContent==='Modifier').onclick();
 assert.ok(nodes.get('#fields').children.some(label=>label.children.some(input=>input.name==='placement'&&input.tag==='select')));
 assert.ok(nodes.get('#fields').children.some(label=>label.children.some(input=>input.name==='image'&&input.tag==='select'&&input.children.length>20)));
 env.sqlite.close();
});

test('highlights can be ordered, published and hidden permanently without modifying source defaults',async()=>{
 const {mergeHighlights,defaultHighlights}=await import('../admin/highlights.mjs');const env=bindings();
 const initial=await (await call(env,'highlights')).json();assert.equal(initial.length,defaultHighlights.length);assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM highlights').get().n,0);
 const hero=initial.find(item=>item.placement==='hero');
 assert.equal((await call(env,'highlights/'+hero.id,'DELETE',{version:0})).status,200);
 let all=await (await call(env,'highlights')).json();assert.ok(!all.some(item=>item.id===hero.id));
 let publicRows=mergeHighlights(env.sqlite.prepare('SELECT * FROM highlights').all()).filter(item=>item.published===1);
 assert.ok(!publicRows.some(item=>item.id===hero.id));assert.equal(defaultHighlights.find(item=>item.id===hero.id).published,1);
 const data={placement:'news',kicker:'La maison',title:'Notre collection',description:'Une découverte',image:'/images/bonbons-ia-basse-def/1.png',alt:'Chocolat',image_fit:'contain',button_label:'Découvrir',href:'/bonbons#bonbon-1',position:0,published:false};
 const created=await call(env,'highlights','POST',data);assert.equal(created.status,201);const {id}=await created.json();
 publicRows=mergeHighlights(env.sqlite.prepare('SELECT * FROM highlights').all()).filter(item=>item.published===1);assert.ok(!publicRows.some(item=>item.id===id));
 assert.equal((await call(env,'highlights/'+id,'PUT',{...data,published:true,version:1})).status,200);
 assert.equal((await call(env,'highlights/'+id,'PUT',{...data,version:1})).status,409);
 publicRows=mergeHighlights(env.sqlite.prepare('SELECT * FROM highlights').all()).filter(item=>item.published===1&&item.placement==='news');assert.equal(publicRows[0].id,id);
 assert.equal((await call(env,'highlights/'+id,'DELETE',{version:2})).status,200);
 assert.equal(env.sqlite.prepare('SELECT deleted FROM highlights WHERE id=?').get(id).deleted,1);env.sqlite.close();
});

test('highlights reject unsafe links, invalid fields and unauthorized modifications',async()=>{
 const env=bindings();const item={placement:'hero',kicker:'',title:'La maison',description:'',image:'/images/bonbons-ia-basse-def/1.png',alt:'Chocolat',image_fit:'cover',button_label:'Découvrir',href:'/maison',position:1,published:true};
 for(const href of ['https://evil.example','//evil.example','javascript:alert(1)','/\\evil.example','/admin','/signin-with-chatgpt','/callback','/bonbons\n'])assert.equal((await call(env,'highlights','POST',{...item,href})).status,400,href);
 for(const patch of [{placement:'unknown'},{image:'https://evil.example/a.png'},{image_fit:'unknown'},{position:-1},{position:1.5},{title:''},{alt:''},{published:'true'}])assert.equal((await call(env,'highlights','POST',{...item,...patch})).status,400);
 assert.equal((await handleAdmin(req('/admin/api/highlights',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(item)}),env)).status,401);
 assert.equal((await handleAdmin(req('/admin/api/highlights',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify(item)}),env)).status,403);env.sqlite.close();
});

test('uploaded images referenced by highlights are protected from deletion',async()=>{
 const env=bindings(),form=new FormData();form.set('alt','Chocolat');form.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'chocolat.png',{type:'image/png'}));
 const uploaded=await (await handleAdmin(req('/admin/api/images',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin},body:form}),env)).json();
 const highlight=await (await call(env,'highlights','POST',{placement:'hero',kicker:'',title:'La maison',description:'',image:uploaded.url,alt:'Chocolat',image_fit:'cover',button_label:'Découvrir',href:'/bonbons',position:1,published:false})).json();
 assert.equal((await call(env,'images/'+uploaded.id,'DELETE')).status,409);
 assert.equal((await call(env,'highlights/'+highlight.id,'DELETE',{version:1})).status,200);
 assert.equal((await call(env,'images/'+uploaded.id,'DELETE')).status,200);env.sqlite.close();
});

test('carousel server rendering keeps accessible controls, inert hidden slides and a usable card rail',async()=>{
 const ts=await import('typescript');const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {defaultHighlights}=await import('../admin/highlights.mjs');
 const input=readFileSync(new URL('../components/home-highlights.tsx',import.meta.url),'utf8');
 let code=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 code=code.replace(/from (['"])(react(?:\/jsx-runtime)?)\1/g,(_,quote,name)=>'from '+JSON.stringify(import.meta.resolve(name)));
 const imageModule='data:text/javascript;base64,'+Buffer.from('import {createElement} from '+JSON.stringify(import.meta.resolve('react'))+';export default function Image({src,alt}){return createElement("img",{src,alt,loading:"lazy"});}').toString('base64');
 code=code.replace(/from (['"])next\/image\1/g,'from '+JSON.stringify(imageModule));
 const {SpotlightCarousel,NewsRail}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const heroes=defaultHighlights.filter(item=>item.placement==='hero');const hero=renderToStaticMarkup(createElement(SpotlightCarousel,{items:heroes}));
 assert.match(hero,/aria-roledescription="carrousel"/);assert.doesNotMatch(hero,/Diapositive suivante|Diapositive précédente|défilement automatique/);assert.match(hero,/hidden=""/);assert.match(hero,/inert=""/);assert.match(hero,/aria-current="true"/);
 const single=renderToStaticMarkup(createElement(SpotlightCarousel,{items:heroes.slice(0,1)}));assert.doesNotMatch(single,/Diapositive suivante/);
 assert.equal(renderToStaticMarkup(createElement(SpotlightCarousel,{items:[]})),'');
 const rail=renderToStaticMarkup(createElement(NewsRail,{items:defaultHighlights.filter(item=>item.placement==='news'),title:'Nouveautés',intro:'Les recettes de la maison',kicker:'À découvrir'}));
 assert.match(rail,/apg-news__rail/);assert.match(rail,/\/bonbons#bonbon-1/);assert.doesNotMatch(rail,/Faire défiler les nouveautés vers la droite|Faire défiler les nouveautés vers la gauche/);assert.match(rail,/tabindex="0"/);
 const escaped=renderToStaticMarkup(createElement(SpotlightCarousel,{items:[{...heroes[0],title:'<script>alert(1)</script>'}]}));assert.ok(!escaped.includes('<script>'));assert.match(escaped,/&lt;script&gt;/);
});

test('stock alerts include house articles at five pieces, exclude discovery and retired weight sales',async()=>{const {stockAlerts}=await import('../admin/stock.mjs');assert.deepEqual(stockAlerts([{id:'bonbon',stock:0},{id:'box',name:'Coffret',stock:5},{id:'bonbon-1',stock:0},{id:'full',stock:6}]).map(p=>p.id),['box']);assert.equal(stockAlerts([{id:'box',stock:0}])[0].empty,true);assert.equal(stockAlerts([{id:'box',stock:6}]).length,0);});

test('appearance is protected, versioned, validates layout and restores defaults without deleting content',async()=>{
 const {defaultAppearance}=await import('../admin/appearance.mjs');const env=bindings();
 assert.equal((await handleAdmin(req('/admin/apparence'),env)).status,302);
 assert.equal((await handleAdmin(req('/admin/api/appearance'),env)).status,401);
 const initial=await (await call(env,'appearance')).json();assert.equal(typeof initial.footerDefaults.footerTitle,'string');assert.equal(initial.version,0);assert.deepEqual(initial.settings,defaultAppearance);
 const settings={...initial.settings,navigation:{groupLabel:'Notre maison',items:[{label:'Recettes maison',href:'/bonbons',group:true},{label:'Boutique en ligne',href:'/boutique',group:false}]},hero:'image-right',buttons:'outline',collectionLabel:'Tous les articles',collectionHref:'/boutique',sections:[...initial.settings.sections].reverse().map((section,index)=>({...section,visible:index!==0}))};
 let response=await call(env,'appearance','PUT',{settings,version:0});assert.equal(response.status,200);assert.equal((await response.json()).version,1);
 const stored=(await (await call(env,'appearance')).json()).settings;assert.equal(stored.sections[0].id,'collection');assert.deepEqual(stored.navigation,{...settings.navigation,items:settings.navigation.items.map(item=>({...item,href:item.href==='/bonbons'?'/maison#nos-recettes':item.href}))});
 assert.equal((await call(env,'appearance','PUT',{settings,version:0})).status,409);
 for(const bad of [{...settings,background:'url(evil)'},{...settings,sections:settings.sections.map(s=>({...s,visible:false}))},{...settings,sections:[...settings.sections.slice(1),settings.sections[1]]},{...settings,historyHref:'https://evil.example'},{...settings,collectionHref:'/admin'}])assert.equal((await call(env,'appearance','PUT',{settings:bad,version:1})).status,400);
 assert.equal((await handleAdmin(req('/admin/api/appearance',{method:'PUT',headers:{'oai-authenticated-user-id':'owner',origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({settings,version:1})}),env)).status,403);
 assert.equal((await call(env,'appearance','PUT',{settings:defaultAppearance,version:1})).status,200);
 const restored=await (await call(env,'appearance')).json();assert.equal(restored.version,2);assert.deepEqual(restored.settings,defaultAppearance);
 const redirected=await handleAdmin(req('/admin/apparence',{headers:{'oai-authenticated-user-id':'owner'}}),env);assert.equal(redirected.status,302);assert.equal(redirected.headers.get('location'),'/admin/puck?section=theme');
 env.sqlite.close();
});

test('appearance rendering falls back safely and applies section order, visibility and button destinations',async()=>{
 const ts=await import('typescript');const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {defaultAppearance}=await import('../admin/appearance.mjs');
 let code=ts.transpileModule(readFileSync(new URL('../components/appearance.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
 for(const name of ['react/jsx-runtime','react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`).replaceAll(`from '${name}'`,`from ${JSON.stringify(import.meta.resolve(name))}`);
 code=code.replaceAll("'@/admin/appearance.mjs'",JSON.stringify(new URL('../admin/appearance.mjs',import.meta.url).href));
 code=code.replace("import { usePathname } from 'next/navigation';","const usePathname=()=>'/';");
 const styleCode=ts.transpileModule(readFileSync(new URL('../components/visual-style.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;code=code.replace("import { CartLink } from './cart';","const CartLink=()=>null;");code=code.replace("import { VisualRuntime } from './visual-runtime';","const VisualRuntime=()=>null;").replace("'./visual-style'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(styleCode).toString('base64')));
 const appearanceModuleUrl='data:text/javascript;base64,'+Buffer.from(code).toString('base64');const {AppearanceShell,HomeSections,HomeButton,PageButtons,PageSections,StoreHeader,StoreFooter,ContactCard}=await import(appearanceModuleUrl);
 const contactHtml=renderToStaticMarkup(createElement(ContactCard,{address:"123 rue Maréchal Joffre · 76600 Le Havre",hours:"Mardi — Samedi · 9h–12h · 14h–19h",phone:"02 35 42 32 75",email:"genereuxparrain@gmail.com"}));assert.match(contactHtml,/Nous rendre visite —/);assert.match(contactHtml,/Horaires —/);assert.match(contactHtml,/Nous contacter —/);assert.match(contactHtml,/href="tel:0235423275"/);assert.match(contactHtml,/href="mailto:genereuxparrain@gmail.com"/);
 assert.match(renderToStaticMarkup(createElement(AppearanceShell,{initial:undefined},'Contenu')),/data-background="cream"/);
 const chrome={...defaultAppearance.chrome,headerBackground:'#112233',headerColor:'#ffffff',logoWidth:140,menuGap:40,logoPosition:'center',footerColumns:2,overrideContent:true,footerTitle:'La maison havraise',footerText:'<script>texte</script>',address:'Le Havre',hours:'Du mardi au samedi',phone:'0235000000',email:'boutique@example.fr',legal:'Maison depuis 1890'};
 const chromeHtml=renderToStaticMarkup(createElement(AppearanceShell,{initial:{...defaultAppearance,chrome}},createElement(StoreHeader),createElement(StoreFooter,{title:'Ancien titre',text:'Ancien texte',address:'',hours:'',phone:'',email:''})));

 const loadCode=(path)=>{let source=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;for(const name of ['react/jsx-runtime','react'])source=source.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`).replaceAll(`from '${name}'`,`from ${JSON.stringify(import.meta.resolve(name))}`);return source;};
 const galleryUrl='data:text/javascript;base64,'+Buffer.from(loadCode('../components/product-gallery.tsx')).toString('base64');
 const cartCode=loadCode('../components/cart.tsx').replace("'./product-gallery'",JSON.stringify(galleryUrl)).replace("'@/commerce/cart.mjs'",JSON.stringify(new URL('../commerce/cart.mjs',import.meta.url).href));const cartUrl='data:text/javascript;base64,'+Buffer.from(cartCode.replace("'@/commerce/shipping.mjs'",JSON.stringify(new URL('../commerce/shipping.mjs',import.meta.url).href))).toString('base64');const {CartProvider}=await import(cartUrl);const {ProductGallery}=await import(galleryUrl);const galleryHtml=renderToStaticMarkup(createElement(ProductGallery,{name:'Boîte',crops:{'/images/boite-decouverte-maison.jpg':{zoom:175,x:8,y:-12}},images:['/images/boite-decouverte-maison.jpg','/images/boite-decouverte-maison-vues.jpg'],href:'/boutique/box',detail:true}));assert.match(galleryHtml,/translate\(8%, -12%\) scale\(1.75\)/);assert.match(galleryHtml,/object-fit:contain/);assert.match(galleryHtml,/carrousel/);assert.match(galleryHtml,/Photo suivante/);assert.match(galleryHtml,/apg-product-gallery-thumbnails/);assert.match(galleryHtml,/vue 2 sur 2/);
 const catalogCode=loadCode('../components/catalog.tsx').replace("'./appearance'",JSON.stringify(appearanceModuleUrl)).replace("'./cart'",JSON.stringify(cartUrl));const {Catalog}=await import('data:text/javascript;base64,'+Buffer.from(catalogCode).toString('base64'));
 const shop={...defaultAppearance.shop,layout:'list',columns:4,mobileColumns:2,imageHeight:220,imageFit:'cover',gap:18,titleSize:24};
 const catalogHtml=renderToStaticMarkup(createElement(AppearanceShell,{initial:{...defaultAppearance,shop,stripedEverywhere:true,visual:{...defaultAppearance.visual,pattern:'plain'}}},createElement(CartProvider,null,createElement(Catalog,{products:[{id:'box',name:'Boîte maison',description:'Notre sélection',price_cents:4000,stock:5,image:'/images/boutique-historique.jpeg'}],preview:true}))));
 assert.match(catalogHtml,/data-presentation="square"/);assert.match(catalogHtml,/apg-product-square/);assert.match(catalogHtml,/apg-product-add/);assert.match(catalogHtml,/<span>Ajouter<\/span><span>/);assert.match(catalogHtml,/Notre sélection/);assert.doesNotMatch(catalogHtml,/Quantité en pièces/);
 const liveHtml=renderToStaticMarkup(createElement(AppearanceShell,{initial:defaultAppearance},createElement(CartProvider,null,createElement(Catalog,{products:[{id:'box',name:'Boîte maison',description:'Notre sélection',price_cents:4000,stock:5,image:''}]}))));assert.match(liveHtml,/href="\/boutique\/box"/);assert.match(liveHtml,/Découvrir cet article/);
 const detailCode=loadCode('../components/product-details.tsx').replace("'./product-gallery'",JSON.stringify(galleryUrl)).replace("'./cart'",JSON.stringify(cartUrl)).replace("'@/commerce/cart.mjs'",JSON.stringify(new URL('../commerce/cart.mjs',import.meta.url).href));const {ProductDetails}=await import('data:text/javascript;base64,'+Buffer.from(detailCode).toString('base64'));
 const detailHtml=renderToStaticMarkup(createElement(CartProvider,null,createElement(ProductDetails,{product:{id:'box',name:'Boîte maison',description:'Une sélection à découvrir.',price_cents:1500,stock:5,image:'',weight:'150 g',conservation:'Au frais',ingredients:'<script>composition</script>',allergens:'Fruits à coque'}})));assert.match(detailHtml,/role="tablist"/);assert.match(detailHtml,/aria-controls="panel-ingredients"/);assert.match(detailHtml,/150 g/);assert.match(detailHtml,/Une sélection à découvrir/);assert.match(detailHtml,/&lt;script&gt;composition/);assert.doesNotMatch(detailHtml,/<script>composition/);assert.match(detailHtml,/Fruits à coque/);assert.match(detailHtml,/Ajouter au panier/);
 const detailedHtml=renderToStaticMarkup(createElement(AppearanceShell,{initial:{...defaultAppearance,shop:{...shop,presentation:'detailed'}}},createElement(CartProvider,null,createElement(Catalog,{products:[{id:'box',name:'Boîte maison',description:'Notre sélection',price_cents:4000,stock:5,image:'/images/boutique-historique.jpeg'}],preview:true}))));assert.match(detailedHtml,/Quantité en pièces/);assert.doesNotMatch(detailedHtml,/apg-product-square/);
 assert.match(catalogHtml,/data-layout="list"/);assert.match(catalogHtml,/--shop-columns:4/);assert.match(catalogHtml,/--shop-mobile-columns:2/);assert.match(catalogHtml,/--shop-image-height:220px/);assert.match(catalogHtml,/--shop-image-fit:cover/);assert.match(catalogHtml,/Boîte maison/);assert.match(catalogHtml,/data-striped-everywhere="true"/);assert.match(catalogHtml,/data-pattern="inherit"/);
 assert.match(chromeHtml,/class="apg-store-header"/);assert.match(chromeHtml,/data-logo-position="center"/);assert.match(chromeHtml,/--menu-gap:40px/);assert.match(chromeHtml,/width:140px/);assert.match(chromeHtml,/La maison havraise/);assert.match(chromeHtml,/&lt;script&gt;texte/);assert.doesNotMatch(chromeHtml,/Ancien titre|<script>texte/);assert.match(chromeHtml,/--footer-columns:2/);assert.match(chromeHtml,/href="\/maison"/);assert.match(chromeHtml,/Boutique en ligne/);

 const custom={id:'custom-one',label:'Choisir mes chocolats',href:'/boutique',page:'/',location:'history',position:'before',align:'right',style:'outline',size:'large',visible:true};
 const settings={...defaultAppearance,customButtons:[custom,{...custom,id:'custom-two',label:'Ne pas afficher',location:'news'},{...custom,id:'custom-three',label:'Bouton masqué',visible:false},{...custom,id:'custom-four',label:'En haut',location:'page-top'}],background:'white',collectionLabel:'Acheter',collectionHref:'/boutique',sections:[...defaultAppearance.sections].reverse().map(section=>({...section,visible:section.id!=='news'}))};
 const html=renderToStaticMarkup(createElement(AppearanceShell,{initial:settings},createElement(HomeSections,{sections:defaultAppearance.sections.map(section=>({id:section.id,content:section.id}))}),createElement(HomeButton,{kind:'collection'}),createElement(PageButtons,{location:'page-top'})));
 assert.match(html,/data-background="white"/);assert.ok(html.indexOf('data-home-section="collection"')<html.indexOf('data-home-section="spotlight"'));assert.doesNotMatch(html,/data-home-section="news"/);assert.match(html,/href="\/boutique">Acheter/);assert.ok(html.indexOf('Choisir mes chocolats')<html.indexOf('>history<'));assert.match(html,/data-align="right"/);assert.match(html,/data-style="outline"/);assert.match(html,/En haut/);assert.doesNotMatch(html,/Ne pas afficher|Bouton masqué/);
 const added={id:'added-text',page:'/maison',anchor:'signature',position:'before',kind:'text',visible:true,title:'<script>intrus</script>',body:'Texte de la maison',image:'',alt:'',label:'',href:'',style:{paddingTop:40}};
 const visual={...defaultAppearance.visual,layouts:{...defaultAppearance.visual.layouts,'/maison':[{id:'signature',visible:true},{id:'intro',visible:false}]},blocks:[added]};
 const page=renderToStaticMarkup(createElement(AppearanceShell,{initial:{...defaultAppearance,visual}},createElement(PageSections,{page:'/maison',items:[{id:'intro',content:'INTRO-MASQUÉ'},{id:'signature',content:'SIGNATURE-VISIBLE'}]})));
 assert.match(page,/data-ve-new="added-text"/);assert.match(page,/&lt;script&gt;intrus/);assert.doesNotMatch(page,/<script>intrus|INTRO-MASQUÉ/);assert.ok(page.indexOf('Texte de la maison')<page.indexOf('SIGNATURE-VISIBLE'));

});


test('custom buttons persist with placement and reject unsafe links, invalid pages, duplicates and excessive counts',async()=>{
 const {defaultAppearance,validateAppearance}=await import('../admin/appearance.mjs');const env=bindings();
 const button={id:'button-1',label:'Voir les articles',href:'/boutique',page:'/',location:'collection',position:'after',align:'center',style:'filled',size:'regular',visible:true};
 const settings={...defaultAppearance,customButtons:[button]};
 assert.equal((await call(env,'appearance','PUT',{settings,version:0})).status,200);
 assert.deepEqual((await (await call(env,'appearance')).json()).settings.customButtons,[button]);
 for(const change of [{href:'javascript:alert(1)'},{href:'//evil.example'},{href:'/admin'},{page:'/admin'},{page:'/boutique',location:'collection'},{align:'position:absolute'},{style:'<script>'},{visible:'true'}])assert.equal((await call(env,'appearance','PUT',{settings:{...settings,customButtons:[{...button,...change}]},version:1})).status,400);
 assert.throws(()=>validateAppearance({...settings,customButtons:[button,button]}));assert.throws(()=>validateAppearance({...settings,customButtons:Array.from({length:31},(_,i)=>({...button,id:'b-'+i}))}));
 const old={...defaultAppearance};delete old.customButtons;assert.deepEqual(validateAppearance(old).customButtons,[]);
 assert.equal((await call(env,'appearance','PUT',{settings:{...settings,customButtons:[]},version:1})).status,200);assert.deepEqual((await (await call(env,'appearance')).json()).settings.customButtons,[]);env.sqlite.close();
});

test('visual editor validates themes, styles, links, layouts and content before persisting',async()=>{
 const {defaultAppearance}=await import('../admin/appearance.mjs');const {defaultVisual,validateVisual,validateVisualStyle,visualHref}=await import('../admin/visual.mjs');const env=bindings();
 const block={id:'visual-one',page:'/maison',anchor:'signature',position:'before',kind:'text',visible:true,title:'Notre maison',body:'Un texte personnel',image:'',alt:'',label:'',href:'',style:{backgroundColor:'#fff0da',paddingTop:40,textAlign:'center'}};
 const visual={...structuredClone(defaultVisual),accent:'#e25a13',blocks:[block],overrides:[{page:'/',id:'history/section:1/div:1/h2:1',text:'Une nouvelle histoire',style:{fontSize:48,color:'#30271f'}}]};const settings={...defaultAppearance,visual};
 assert.equal((await call(env,'appearance','PUT',{settings,version:0})).status,200);const saved=await (await call(env,'appearance')).json();assert.deepEqual(saved.settings.visual,visual);
 for(const style of [{position:'fixed'},{backgroundColor:'url(https://evil.example)'},{fontSize:999},{paddingLeft:-1},{columns:1.5},{layout:'<script>'},JSON.parse('{"__proto__":{"polluted":true}}')])assert.throws(()=>validateVisualStyle(style));
 for(const href of ['javascript:alert(1)','data:text/html,<script>','//evil.example','/admin','https://name:password@example.org'])assert.throws(()=>visualHref(href));
 assert.equal(visualHref('https://example.org/'), 'https://example.org/');assert.equal(visualHref('mailto:contact@example.org'),'mailto:contact@example.org');
 for(const bad of [{...visual,blocks:[{...block,image:'https://evil.example/x.jpg',kind:'image',alt:'Image'}]},{...visual,blocks:[block,block]},{...visual,overrides:[{page:'/',id:'body<script>',style:{}}]},{...visual,layouts:{...visual.layouts,'/maison':[{id:'intro',visible:false},{id:'signature',visible:false}]}},{...visual,blocks:Array.from({length:61},(_,i)=>({...block,id:'b-'+i}))}])assert.throws(()=>validateVisual(bad));
 const anonymous=await handleAdmin(req('/admin/editeur'),env);assert.equal(anonymous.status,302);const response=await handleAdmin(req('/admin/editeur',{headers:{'oai-authenticated-user-id':'owner'}}),env);assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/admin/puck');assert.equal(await handleAdmin(req('/admin/puck',{headers:{'oai-authenticated-user-id':'owner'}}),env),null);env.sqlite.close();
});

test('visual editor client keeps changes in preview until save, supports undo and selection edits',async()=>{
 const {visualEditorClient}=await import('../admin/visual-editor-client.mjs');const {visualPages,defaultVisual}=await import('../admin/visual.mjs');const {Script,createContext}=await import('node:vm');
 class Node{constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.textContent='';this.type='';this.value='';}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}setAttribute(key,value){this[key]=value;}click(){return this.onclick?.();}get valueAsNumber(){return this.value===''?NaN:Number(this.value);}}
 const ids=['canvas','notice','save','undo','redo','state','mode','page','desktop','mobile','reload','layers','properties','theme','insert'];const nodes=new Map(ids.map(id=>['#'+id,new Node('div')]));const messages=[];nodes.get('#canvas').contentWindow={postMessage:data=>messages.push(structuredClone(data))};const panels=['properties','layers','theme','insert'].map(id=>{const button=new Node('button');button.dataset.panel=id;return button;});const inserts=['text','image','button','spacer'].map(kind=>{const button=new Node('button');button.dataset.add=kind;return button;});const events={};const env=bindings();
 const document={createElement:tag=>new Node(tag),createTextNode:value=>Object.assign(new Node('text'),{textContent:value}),querySelector:selector=>selector==='[data-panel=properties]'?panels[0]:nodes.get(selector),querySelectorAll:selector=>selector==='[data-add]'?inserts:selector==='[data-panel]'?panels:selector==='.editor-panel'?['properties','layers','theme','insert'].map(id=>Object.assign(nodes.get('#'+id),{id})):[]};
 const context=createContext({document,location:{origin},crypto,structuredClone,confirm:()=>false,window:{addEventListener:(type,fn)=>events[type]=fn},fetch:async(path,options={})=>handleAdmin(req(path,{...options,headers:{...options.headers,origin,'oai-authenticated-user-id':'owner'}}),env)});
 new Script('('+visualEditorClient.toString()+')('+JSON.stringify(visualPages)+','+JSON.stringify(defaultVisual)+')').runInContext(context);const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};await settle();
 inserts[0].click();assert.equal(messages.at(-1).settings.visual.blocks.length,1);assert.equal((await (await call(env,'appearance')).json()).version,0);nodes.get('#undo').click();assert.equal(messages.at(-1).settings.visual.blocks.length,0);nodes.get('#redo').click();assert.equal(messages.at(-1).settings.visual.blocks.length,1);
 events.message({origin:'https://evil.example',source:nodes.get('#canvas').contentWindow,data:{type:'apg-visual-selection',selection:{id:'evil'}}});
 events.message({origin,source:nodes.get('#canvas').contentWindow,data:{type:'apg-visual-selection',selection:{id:'history/section:1/h2:1',page:'/',tag:'h2',text:'Titre initial',canText:true,native:'history',computed:{}}}});
 const find=(node,predicate)=>predicate(node)?node:node.children.map(child=>find(child,predicate)).find(Boolean);const label=find(nodes.get('#properties'),node=>node.tagName==='LABEL'&&node.textContent==='Texte');const input=label.children[0];input.value='Titre choisi dans l’aperçu';input.oninput();assert.equal(messages.at(-1).settings.visual.overrides[0].text,'Titre choisi dans l’aperçu');
 await nodes.get('#save').click();const result=await (await call(env,'appearance')).json();assert.equal(result.version,1);assert.equal(result.settings.visual.blocks.length,1);assert.equal(result.settings.visual.overrides[0].text,'Titre choisi dans l’aperçu');
 events.message({origin,source:nodes.get('#canvas').contentWindow,data:{type:'apg-visual-selection',selection:{id:result.settings.visual.blocks[0].id+'/block',newBlock:result.settings.visual.blocks[0].id}}});
 for(const title of ['Titre après enregistrement','Titre corrigé à nouveau']){const label=find(nodes.get('#properties'),node=>node.tagName==='LABEL'&&node.textContent==='Titre');label.children[0].value=title;label.children[0].oninput();await nodes.get('#save').click();assert.equal((await (await call(env,'appearance')).json()).settings.visual.blocks[0].title,title);}
 env.sqlite.close();
});


test('images referenced by visual blocks cannot be deleted until the block is removed',async()=>{
 const {defaultAppearance}=await import('../admin/appearance.mjs');const env=bindings();const upload=new FormData();upload.set('alt','Photo de la maison');upload.set('file',new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0])],{type:'image/png'}),'photo.png');const response=await handleAdmin(req('/admin/api/images',{method:'POST',headers:{origin,'oai-authenticated-user-id':'owner'},body:upload}),env);assert.equal(response.status,201);const image=await response.json();
 const visual={...structuredClone(defaultAppearance.visual),blocks:[{id:'photo-maison',page:'/',anchor:'history',position:'after',kind:'image',visible:true,title:'',body:'',image:image.url,alt:'Maison',label:'',href:'',style:{}}]};assert.equal((await call(env,'appearance','PUT',{settings:{...defaultAppearance,visual},version:0})).status,200);assert.equal((await call(env,'images/'+image.id,'DELETE')).status,409);assert.equal((await call(env,'appearance','PUT',{settings:defaultAppearance,version:1})).status,200);assert.equal((await call(env,'images/'+image.id,'DELETE')).status,200);env.sqlite.close();
});

test('Puck converts every existing page without writing and isolates drafts, publications and concurrent edits',async()=>{
 const env=bindings();const {validatePuckData}=await import('../admin/puck-model.mjs');
 for(const path of ['/','/maison','/savoir-faire','/bonbons','/chocolats','/boutique','/panier']){const response=await call(env,'puck?path='+encodeURIComponent(path));assert.equal(response.status,200);const page=await response.json();assert.equal(page.version,0);assert.equal(page.published,false);assert.deepEqual(validatePuckData(page.data),page.data);assert.ok(page.data.content.length);}
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM puck_pages').get().n,0);
 const doc=(await(await call(env,'puck?path=/maison')).json()).data;doc.content[0].props.children[0].props.title='Une maison';
 assert.equal((await call(env,'puck?path=/maison','PUT',{action:'draft',version:0,data:doc})).status,200);
 assert.equal(env.sqlite.prepare("SELECT published FROM puck_pages WHERE path='/maison'").get().published,null);
 assert.equal((await(await call(env,'puck?path=/maison')).json()).data.content[0].props.children[0].props.title,'Une maison');
 assert.equal((await call(env,'puck?path=/maison','PUT',{action:'publish',version:0,data:doc})).status,409);
 assert.equal((await call(env,'puck?path=/maison','PUT',{action:'publish',version:1,data:doc})).status,200);
 const published=env.sqlite.prepare("SELECT published FROM puck_pages WHERE path='/maison'").get().published;assert.equal(JSON.parse(published).content[0].props.children[0].props.title,'Une maison');
 doc.content[0].props.children[0].props.title='Brouillon suivant';assert.equal((await call(env,'puck?path=/maison','PUT',{action:'draft',version:2,data:doc})).status,200);
 assert.equal(env.sqlite.prepare("SELECT published FROM puck_pages WHERE path='/maison'").get().published,published);
 assert.equal((await(await call(env,'puck?path=/')).json()).version,0);
 assert.equal((await call(env,'puck?path=/maison','PUT',{action:'restore',version:3})).status,200);
 const restored=await(await call(env,'puck?path=/maison')).json();assert.equal(restored.published,false);assert.notEqual(restored.data.content[0].props.children[0].props.title,'Brouillon suivant');assert.equal(restored.version,4);
 assert.ok(env.sqlite.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='PUCK_PUBLISH'").get().n);env.sqlite.close();
});
test('Puck validates nested slots, links, styles and image references at the authenticated boundary',async()=>{
 const env=bindings();const {puckDefaults,validatePuckData,puckImages}=await import('../admin/puck-model.mjs');
 assert.equal((await handleAdmin(req('/admin/api/puck'),env)).status,401);assert.equal((await handleAdmin(req('/admin/puck'),env)).status,302);
 const doc=(await(await call(env,'puck?path=/')).json()).data;
 const block={type:'Bouton',props:{...structuredClone(puckDefaults.Bouton),id:'safe-button'}};doc.content=[{type:'Colonnes',props:{...structuredClone(puckDefaults.Colonnes),id:'columns',children:[block]}}];
 assert.equal(validatePuckData(doc).content[0].props.children[0].type,'Bouton');
 for(const href of ['javascript:alert(1)','//evil.test','data:text/html,x']){const bad=structuredClone(doc);bad.content[0].props.children[0].props.href=href;assert.equal((await call(env,'puck','PUT',{action:'publish',version:0,data:bad})).status,400);}
 const unknown=structuredClone(doc);unknown.content[0].props.onClick='alert(1)';assert.throws(()=>validatePuckData(unknown));
 const css=structuredClone(doc);css.content[0].props.style.background='url(https://evil.test)';assert.throws(()=>validatePuckData(css));
 const duplicate=structuredClone(doc);duplicate.content.push(duplicate.content[0]);assert.throws(()=>validatePuckData(duplicate));
 assert.equal((await call(env,'puck?path=/admin','PUT',{action:'publish',version:0,data:doc})).status,400);
 assert.equal((await handleAdmin(req('/admin/api/puck',{method:'PUT',headers:{'oai-authenticated-user-id':'owner',origin:'https://evil.example'},body:JSON.stringify({action:'publish',version:0,data:doc})}),env)).status,403);
 const form=new FormData();form.set('alt','Image de Puck');form.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'puck.png',{type:'image/png'}));
 const image=await(await handleAdmin(req('/admin/api/images',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin},body:form}),env)).json();
 doc.content[0].props.children.push({type:'Image',props:{...structuredClone(puckDefaults.Image),id:'photo',src:image.url}});assert.ok(puckImages(doc).includes(image.url));
 assert.equal((await call(env,'puck','PUT',{action:'draft',version:0,data:doc})).status,200);assert.equal((await call(env,'images/'+image.id,'DELETE')).status,409);
 await call(env,'puck','PUT',{action:'publish',version:1,data:doc});const cleared=structuredClone(doc);cleared.content=[];await call(env,'puck','PUT',{action:'draft',version:2,data:cleared});assert.equal((await call(env,'images/'+image.id,'DELETE')).status,409);
 await call(env,'puck','PUT',{action:'restore',version:3});assert.equal((await call(env,'images/'+image.id,'DELETE')).status,200);env.sqlite.close();
});

test('published Puck renderer preserves nested column layout and safely renders owner content',async()=>{
 const ts=await import('typescript');const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {Render}=await import('@puckeditor/core/rsc');const {puckDefaults,puckRoot,validatePuckData}=await import('../admin/puck-model.mjs');
 const mocks='data:text/javascript;base64,'+Buffer.from('export const StoreHeader=()=>null;export const StoreFooter=()=>null;export const ContactCard=()=>null;export const MenuLinks=()=>null;export const PuckImageField=()=>null;export const CartLink=()=>null;export const CartPage=()=>null;export const Catalog=()=>null;export const SpotlightCarousel=()=>null;export const NewsRail=()=>null;export const FreeCanvas=()=>null;export const EditableFreeCanvas=()=>null;export const CompactStyle=()=>null;export const EditableBlockFrame=({children})=>children;').toString('base64');
 let code=ts.transpileModule(readFileSync(new URL('../components/puck/config.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 code=code.replace(/from (['"])(react(?:\/jsx-runtime)?)\1/g,(_,quote,name)=>'from '+JSON.stringify(import.meta.resolve(name))).replace(/from (['"])@\/admin\/puck-model.mjs\1/g,'from '+JSON.stringify(new URL('../admin/puck-model.mjs',import.meta.url).href)).replace(/from (['"])(?:\.\/block-frame|\.\/free-canvas|\.\/image-field|\.\.\/home-highlights|\.\.\/cart|\.\.\/catalog|\.\.\/appearance)\1/g,'from '+JSON.stringify(mocks));
 const {puckConfig}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const doc=validatePuckData({root:{props:{...puckRoot,showHeader:'non',showFooter:'non'}},content:[{type:'Colonnes',props:{...structuredClone(puckDefaults.Colonnes),id:'columns',children:[{type:'Texte',props:{...structuredClone(puckDefaults.Texte),id:'title',title:'<script>alert(1)</script>',body:'Maison'}},{type:'Bouton',props:{...structuredClone(puckDefaults.Bouton),id:'button',label:'Découvrir',href:'/boutique'}}]}}]});
 const html=renderToStaticMarkup(React.createElement(Render,{config:puckConfig(),data:doc}));assert.match(html,/data-puck-page="true"/);assert.match(html,/class="puck-columns"/);assert.match(html,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/href="\/boutique"/);assert.match(html,/Maison/);
});

test('design controls persist stripes and block dimensions and accept older Puck documents',async()=>{
 const {puckRoot,puckDefaults,validatePuckData}=await import('../admin/puck-model.mjs');
 const doc={root:{props:{...puckRoot,pattern:'stripes',stripeColor:'#FF6A00',stripeWidth:24,stripeAngle:45}},content:[{type:'Bandeau',props:{...structuredClone(puckDefaults.Bandeau),id:'banner'}}]};
 Object.assign(doc.content[0].props.style,{width:75,minHeight:280,visualHeight:240,background:'#112233',visualBackground:'#abcdef'});
 const saved=validatePuckData(JSON.parse(JSON.stringify(doc)));assert.equal(saved.root.props.pattern,'stripes');assert.equal(saved.root.props.stripeWidth,24);assert.equal(saved.content[0].props.style.visualHeight,240);assert.equal(saved.content[0].props.style.width,75);assert.equal(saved.content[0].props.style.background,'#112233');
 const old=structuredClone(doc);for(const key of ['pattern','stripeColor','stripeWidth','stripeAngle'])delete old.root.props[key];for(const key of ['width','minHeight','visualHeight','visualBackground'])delete old.content[0].props.style[key];
 const migrated=validatePuckData(old);assert.equal(migrated.root.props.pattern,'inherit');assert.equal(migrated.content[0].props.style.width,100);assert.equal(migrated.content[0].props.style.visualHeight,0);
 for(const value of [-1,2001,NaN]){const invalid=structuredClone(doc);invalid.content[0].props.style.visualHeight=value;assert.throws(()=>validatePuckData(invalid));}
 const invalid=structuredClone(doc);invalid.root.props.stripeColor='url(https://example.com)';assert.throws(()=>validatePuckData(invalid));
});

test('shared navigation persists editable grouping and destinations while old settings receive the new menu',async()=>{
 const {defaultAppearance,validateAppearance}=await import('../admin/appearance.mjs');
 const previous=structuredClone(defaultAppearance);delete previous.navigation;
 const upgraded=validateAppearance(previous);assert.equal(upgraded.navigation.items.filter(item=>item.href==='/maison').length,1);assert.equal(upgraded.navigation.items.some(item=>item.group),false);assert.equal(upgraded.navigation.items.find(item=>item.href==='/boutique').label,'Boutique en ligne');
 const edited=structuredClone(upgraded);edited.navigation.groupLabel='Découvrir';edited.navigation.items=[{label:'Mes créations',href:'/boutique',group:false},{label:'Les recettes',href:'/bonbons',group:true}];assert.deepEqual(validateAppearance(JSON.parse(JSON.stringify(edited))).navigation,{...edited.navigation,items:edited.navigation.items.map(item=>({...item,href:item.href==='/bonbons'?'/maison#nos-recettes':item.href}))});
 for(const href of ['javascript:alert(1)','//evil.test','/admin']){const invalid=structuredClone(edited);invalid.navigation.items[0].href=href;assert.throws(()=>validateAppearance(invalid));}
 const invalid=structuredClone(edited);invalid.navigation.items[0].group='oui';assert.throws(()=>validateAppearance(invalid));
});

test('header and footer configuration persists safely, preserves old content and protects the selected logo',async()=>{
 const {defaultAppearance,validateAppearance}=await import('../admin/appearance.mjs');const env=bindings();
 const old=structuredClone(defaultAppearance);delete old.chrome;assert.deepEqual(validateAppearance(old).chrome,defaultAppearance.chrome);
 const form=new FormData();form.set('alt','Logo de la maison');form.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'logo.png',{type:'image/png'}));
 const upload=await handleAdmin(req('/admin/api/images',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin},body:form}),env);assert.equal(upload.status,201);const image=await upload.json();
 const settings=structuredClone(defaultAppearance);settings.chrome={...settings.chrome,logo:image.url,logoWidth:130,menuSize:16,menuGap:28,headerPadding:20,footerColumns:2,overrideContent:true,footerTitle:'La maison',footerText:'Notre histoire',address:'Le Havre',hours:'10 h – 19 h',legal:'Depuis 1890'};
 assert.equal((await call(env,'appearance','PUT',{settings,version:0})).status,200);assert.deepEqual((await (await call(env,'appearance')).json()).settings.chrome,settings.chrome);assert.equal((await call(env,'images/'+image.id,'DELETE')).status,409);
 for(const change of [{headerBackground:'url(evil)'},{logo:'https://evil.example/logo.png'},{logoWidth:1000},{footerColumns:1.5},{sticky:'oui'},{footerText:42}])assert.throws(()=>validateAppearance({...settings,chrome:{...settings.chrome,...change}}));
 assert.throws(()=>validateAppearance({...settings,chrome:[]}));
 const clear=structuredClone(settings);clear.chrome.logo='';assert.equal((await call(env,'appearance','PUT',{settings:clear,version:1})).status,200);assert.equal((await call(env,'images/'+image.id,'DELETE')).status,200);env.sqlite.close();
});

test('Puck restores global stripes for earlier solid defaults and preserves explicit page backgrounds after save',async()=>{
 const {puckRoot,validatePuckData}=await import('../admin/puck-model.mjs');
 const old={root:{props:{...puckRoot,pattern:'plain'}},content:[]};delete old.root.props.themeVersion;
 assert.equal(validatePuckData(old).root.props.pattern,'inherit');
 const current={root:{props:{...puckRoot,pattern:'plain'}},content:[]};assert.equal(validatePuckData(current).root.props.pattern,'plain');current.root.props.pattern='stripes';assert.equal(validatePuckData(current).root.props.pattern,'stripes');
});

test('one Maison page combines existing publications, keeps drafts private and publishes without duplicating sections',async()=>{
 const {puckRoot,puckDefaults}=await import('../admin/puck-model.mjs');const {loadMaisonDocument}=await import('../admin/maison.mjs');const env=bindings();
 const document=(title)=>({root:{props:{...puckRoot}},content:[{type:'Texte',props:{...structuredClone(puckDefaults.Texte),id:'same-id',title,body:'Contenu conservé',level:'h1'}}]});
 for(const [path,title] of [['/maison','Notre histoire personnalisée'],['/savoir-faire','Nos gestes personnalisés'],['/bonbons','Nos recettes personnalisées']])assert.equal((await call(env,'puck?path='+path,'PUT',{action:'publish',version:0,data:document(title)})).status,200);
 const draft=document('Gestes non publiés');assert.equal((await call(env,'puck?path=/savoir-faire','PUT',{action:'draft',version:1,data:draft})).status,200);
 const combined=await loadMaisonDocument(env.DB);assert.equal(combined.root.props.maisonCombined,true);assert.deepEqual(combined.content.map(item=>item.props.id),['la-maison','savoir-faire','nos-recettes']);assert.deepEqual(combined.content.map(item=>item.props.children[0].props.title),['Notre histoire personnalisée','Nos gestes personnalisés','Nos recettes personnalisées']);assert.equal(combined.content[1].props.children[0].props.level,'h2');assert.equal(new Set(combined.content.map(item=>item.props.children[0].props.id)).size,3);
 const editor=await(await call(env,'puck?path=/maison')).json();assert.deepEqual(editor.data,combined);const before=env.sqlite.prepare("SELECT published,draft FROM puck_pages WHERE path='/savoir-faire'").get();
 editor.data.content[1].props.children[0].props.title='Savoir-faire de la page unique';assert.equal((await call(env,'puck?path=/maison','PUT',{action:'draft',version:1,data:editor.data})).status,200);assert.equal((await loadMaisonDocument(env.DB)).content[1].props.children[0].props.title,'Nos gestes personnalisés');
 assert.equal((await call(env,'puck?path=/maison','PUT',{action:'publish',version:2,data:editor.data})).status,200);const published=await loadMaisonDocument(env.DB);assert.equal(published.content.length,3);assert.equal(published.content[1].props.children[0].props.title,'Savoir-faire de la page unique');assert.deepEqual(env.sqlite.prepare("SELECT published,draft FROM puck_pages WHERE path='/savoir-faire'").get(),before);env.sqlite.close();
});

test('the former three-link house menu becomes a single direct Maison link',async()=>{
 const {defaultAppearance,validateAppearance}=await import('../admin/appearance.mjs');
 const legacy={...structuredClone(defaultAppearance),navigation:{groupLabel:'La maison',items:[{label:'Maison',href:'/maison',group:true},{label:'Savoir-faire',href:'/savoir-faire',group:true},{label:'Nos recettes',href:'/bonbons',group:true},{label:'Boutique en ligne',href:'/boutique',group:false}]}};
 assert.deepEqual(validateAppearance(legacy).navigation.items,[{label:'La maison',href:'/maison',group:false},{label:'Boutique en ligne',href:'/boutique',group:false}]);
 const updated=validateAppearance(legacy);updated.navigation.items[0].label='Découvrir notre maison';assert.equal(validateAppearance(updated).navigation.items[0].label,'Découvrir notre maison');
});

test('shop layout and common striped background save independently of products and accept older settings',async()=>{
 const {defaultAppearance,validateAppearance}=await import('../admin/appearance.mjs');const env=bindings();
 const old=structuredClone(defaultAppearance);delete old.shop;delete old.stripedEverywhere;assert.deepEqual(validateAppearance(old).shop,defaultAppearance.shop);assert.equal(validateAppearance(old).stripedEverywhere,true);
 const settings=structuredClone(defaultAppearance);Object.assign(settings.shop,{layout:'list',columns:4,tabletColumns:2,mobileColumns:2,imageHeight:240,gap:18,cardPadding:16,maxWidth:1280,titleSize:24,textSize:15,imageFit:'cover',radius:12});
 const before=env.sqlite.prepare('SELECT * FROM products ORDER BY id').all();assert.equal((await call(env,'appearance','PUT',{settings,version:0})).status,200);const saved=(await(await call(env,'appearance')).json()).settings;assert.deepEqual(saved.shop,settings.shop);assert.equal(saved.stripedEverywhere,true);assert.deepEqual(env.sqlite.prepare('SELECT * FROM products ORDER BY id').all(),before);
 for(const change of [{columns:1.5},{mobileColumns:4},{imageHeight:50},{gap:-1},{imageFit:'url(evil)'},{cardBackground:'url(evil)'},{layout:'absolute'}])assert.throws(()=>validateAppearance({...settings,shop:{...settings.shop,...change}}));
 assert.throws(()=>validateAppearance({...settings,stripedEverywhere:'oui'}));const local={...settings,stripedEverywhere:false};assert.equal(validateAppearance(local).stripedEverywhere,false);env.sqlite.close();
});

test('original calendar addition preserves existing Puck home content and remains idempotent',async()=>{
 const {defaultHighlights}=await import('../admin/highlights.mjs');const {puckDefaults,puckRoot,validatePuckData}=await import('../admin/puck-model.mjs');const {builtinImages}=await import('../data/site-assets.mjs');
 const calendar={...defaultHighlights.find(item=>item.id==='calendrier-conte-avent'),image:'/images/calendrier-conte-avent.jpg'};assert.equal(calendar.placement,'hero');assert.equal(calendar.description,'24 bonbons en chocolat.');assert.equal(calendar.image_fit,'contain');assert.ok(builtinImages.some(item=>item.id==='asset-calendrier-avent'));assert.ok(readFileSync(new URL('../public'+calendar.image,import.meta.url)).length>0);
 const slide=Object.fromEntries(['title','description','kicker','image','alt','href','button_label','image_fit'].map(key=>[key,calendar[key]]));
 const existing={...slide,title:'Nouveauté conservée',image:'/images/boutique-historique.jpeg'};
 const published=validatePuckData({root:{props:{...puckRoot}},content:[{type:'Section',props:{...structuredClone(puckDefaults.Section),id:'section-personnalisee',children:[{type:'Nouveautes',props:{...structuredClone(puckDefaults.Nouveautes),id:'rail-personnalise',title:'Mes nouveautés',items:[existing]}}]}}]});
 const draft=validatePuckData({root:{props:{...puckRoot}},content:[{type:'Texte',props:{...structuredClone(puckDefaults.Texte),id:'texte-brouillon',title:'Brouillon conservé'}}]});
 const db=database();db.prepare('INSERT INTO puck_pages(path,published,draft,version) VALUES (?,?,?,?)').run('/',JSON.stringify(published),JSON.stringify(draft),7);db.prepare('INSERT INTO puck_pages(path,published,draft,version) VALUES (?,?,?,?)').run('/boutique',JSON.stringify(draft),null,3);
 const migration=readFileSync(new URL('../drizzle/0010_calendrier_avent.sql',import.meta.url),'utf8');db.exec(migration);const row=db.prepare("SELECT * FROM puck_pages WHERE path='/'").get();const updated=validatePuckData(JSON.parse(row.published)),updatedDraft=validatePuckData(JSON.parse(row.draft));
 assert.equal(updated.content[0].props.children[0].props.title,'Mes nouveautés');assert.deepEqual(updated.content[0].props.children[0].props.items,[existing,slide]);assert.equal(updatedDraft.content[0].props.title,'Brouillon conservé');assert.equal(updatedDraft.content[1].type,'Nouveautes');assert.deepEqual(updatedDraft.content[1].props.items,[slide]);assert.equal(row.version,8);assert.equal(db.prepare("SELECT version FROM puck_pages WHERE path='/boutique'").get().version,3);
 db.exec(migration);assert.deepEqual(db.prepare("SELECT * FROM puck_pages WHERE path='/'").get(),row);db.close();
});

test('calendar moves into the first banner, leaves other news intact and preserves the owner’s slide changes',async()=>{
 const {puckDefaults,puckRoot,validatePuckData}=await import('../admin/puck-model.mjs');const calendar={...defaultHighlights.find(item=>item.id==='calendrier-conte-avent'),image:'/images/calendrier-conte-avent.jpg'};
 const slide=Object.fromEntries(['title','description','kicker','image','alt','href','button_label','image_fit'].map(key=>[key,calendar[key]]));slide.description='24 bonbons en chocolat. Texte personnalisé.';
 const heritage={...slide,title:'Le chocolat en héritage.',image:'/images/boutique-historique.jpeg'},news={...heritage,title:'Une autre nouveauté'};
 const published=validatePuckData({root:{props:{...puckRoot}},content:[{type:'Bandeau',props:{...structuredClone(puckDefaults.Bandeau),id:'bandeau-existant',items:[heritage]}},{type:'Section',props:{...structuredClone(puckDefaults.Section),id:'section-existante',children:[{type:'Nouveautes',props:{...structuredClone(puckDefaults.Nouveautes),id:'actualites',items:[news,slide]}}]}}]});
 const draft=validatePuckData({root:{props:{...puckRoot}},content:[{type:'Texte',props:{...structuredClone(puckDefaults.Texte),id:'texte',title:'Texte conservé'}},{type:'Nouveautes',props:{...structuredClone(puckDefaults.Nouveautes),id:'calendrier-avent-nouveautes',items:[slide]}}]});
 const db=database();db.prepare('INSERT INTO puck_pages(path,published,draft,version) VALUES (?,?,?,?)').run('/',JSON.stringify(published),JSON.stringify(draft),7);
 const migration=readFileSync(new URL('../drizzle/0011_calendar_main_banner.sql',import.meta.url),'utf8');db.exec(migration);const row=db.prepare("SELECT * FROM puck_pages WHERE path='/'").get();const updated=validatePuckData(JSON.parse(row.published)),updatedDraft=validatePuckData(JSON.parse(row.draft));
 assert.deepEqual(updated.content[0].props.items,[heritage,slide]);assert.deepEqual(updated.content[1].props.children[0].props.items,[news]);assert.equal(updatedDraft.content[0].type,'Bandeau');assert.deepEqual(updatedDraft.content[0].props.items,[slide]);assert.equal(updatedDraft.content[1].props.title,'Texte conservé');assert.equal(updatedDraft.content.length,2);assert.equal(row.version,8);
 db.exec(migration);assert.deepEqual(db.prepare("SELECT * FROM puck_pages WHERE path='/'").get(),row);db.close();
});

test('calendar transparency migration replaces stored URLs while preserving edits and null publications',async()=>{
 const {puckRoot,puckDefaults}=await import('../admin/puck-model.mjs');const calendar={...defaultHighlights.find(item=>item.id==='calendrier-conte-avent'),image:'/images/calendrier-conte-avent.png'};
 const bytes=readFileSync(new URL('../public/images/calendrier-conte-avent.png',import.meta.url));assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes[25],6);
 const document={root:{props:{...puckRoot}},content:[{type:'Bandeau',props:{...structuredClone(puckDefaults.Bandeau),id:'banner',items:[{title:'Mon titre conservé',description:'24 bonbons en chocolat.',kicker:'Avent',image:'/images/calendrier-conte-avent.jpg',alt:'Calendrier',href:'/boutique',button_label:'Découvrir',image_fit:'contain'}]}}]};
 const db=database();db.prepare('INSERT INTO puck_pages(path,published,draft,version) VALUES (?,?,?,?)').run('/',null,JSON.stringify(document),5);const migration=readFileSync(new URL('../drizzle/0012_calendar_transparency.sql',import.meta.url),'utf8');db.exec(migration);const row=db.prepare("SELECT * FROM puck_pages WHERE path='/'").get();assert.equal(row.published,null);assert.equal(row.version,6);const item=JSON.parse(row.draft).content[0].props.items[0];assert.equal(item.title,'Mon titre conservé');assert.equal(item.image,calendar.image);db.exec(migration);assert.deepEqual(db.prepare("SELECT * FROM puck_pages WHERE path='/'").get(),row);db.close();
});

test('calendar is published at the supplied price and stock and keeps later owner edits',async()=>{
 const {quoteCart}=await import('../commerce/cart.mjs');const env=bindings();const product=(await(await call(env,'products')).json()).find(item=>item.id==='calendrier-conte-avent');
 assert.equal(product.kind,'sale');assert.equal(product.name,'Le Conte de l’Avent');assert.equal(product.description,'Un calendrier de l’Avent pour découvrir, jour après jour, 24 bonbons en chocolat.');assert.equal(product.image,'/images/calendrier-conte-avent-photo.jpg');assert.equal(product.published,1);assert.equal(product.stock,5);assert.equal(product.price_cents,1800);const quote=quoteCart([{id:product.id,quantity:1}],[product]);assert.equal(quote.valid,true);assert.equal(quote.total_cents,1800);
 const edited={...product,name:'Mon calendrier personnalisé',price_cents:4200,stock:12,published:false};assert.equal((await call(env,'products/'+product.id,'PUT',edited)).status,200);const saved=env.sqlite.prepare('SELECT * FROM products WHERE id=?').get(product.id);env.sqlite.exec(readFileSync(new URL('../drizzle/0013_calendar_product.sql',import.meta.url),'utf8'));assert.deepEqual(env.sqlite.prepare('SELECT * FROM products WHERE id=?').get(product.id),saved);env.sqlite.close();
});

test('square product layout applies two mobile columns while preserving prices, stock and other appearance settings',async()=>{
 const {defaultAppearance,validateAppearance}=await import('../admin/appearance.mjs');assert.equal(defaultAppearance.shop.presentation,'square');assert.equal(defaultAppearance.shop.mobileColumns,2);
 const db=database();const settings=structuredClone(defaultAppearance);Object.assign(settings.shop,{presentation:'detailed',layout:'list',mobileColumns:1,imageFit:'cover',gap:34});settings.visual.stripeColor='#eeeeee';
 db.prepare("INSERT INTO site_settings(id,body,version) VALUES ('appearance',?,?)").run(JSON.stringify(settings),4);const products=db.prepare('SELECT * FROM products ORDER BY id').all();const migration=readFileSync(new URL('../drizzle/0014_square_product_cards.sql',import.meta.url),'utf8');db.exec(migration);const row=db.prepare("SELECT * FROM site_settings WHERE id='appearance'").get();const updated=validateAppearance(JSON.parse(row.body));assert.equal(updated.shop.presentation,'square');assert.equal(updated.shop.layout,'grid');assert.equal(updated.shop.mobileColumns,2);assert.equal(updated.shop.imageFit,'cover');assert.equal(updated.shop.gap,34);assert.equal(updated.visual.stripeColor,'#eeeeee');assert.equal(row.version,5);assert.deepEqual(db.prepare('SELECT * FROM products ORDER BY id').all(),products);db.exec(migration);assert.deepEqual(db.prepare("SELECT * FROM site_settings WHERE id='appearance'").get(),row);db.close();
});

test('calendar thumbnail changes the product image only and preserves current price, stock and banner',async()=>{
 const db=database();const calendar={...defaultHighlights.find(item=>item.id==='calendrier-conte-avent'),image:'/images/calendrier-conte-avent.png'};
 const image='/images/calendrier-conte-avent-miniature.png';assert.ok(builtinImages.some(item=>item.url===image));const bytes=readFileSync(new URL('../public'+image,import.meta.url));assert.equal(bytes[25],6);assert.equal(bytes.readUInt32BE(16),bytes.readUInt32BE(20));
 db.prepare("UPDATE products SET image=?,price_cents=1900,stock=3,version=7 WHERE id='calendrier-conte-avent'").run(calendar.image);const migration=readFileSync(new URL('../drizzle/0015_calendar_product_thumbnail.sql',import.meta.url),'utf8');db.exec(migration);const product=db.prepare("SELECT * FROM products WHERE id='calendrier-conte-avent'").get();assert.equal(product.image,image);assert.equal(product.price_cents,1900);assert.equal(product.stock,3);assert.equal(product.published,1);assert.equal(product.version,8);db.exec(migration);assert.deepEqual(db.prepare("SELECT * FROM products WHERE id='calendrier-conte-avent'").get(),product);db.close();
});

test('discovery box is published with the supplied assortment, weight, price, stock and photograph',async()=>{
 const {quoteCart}=await import('../commerce/cart.mjs');const env=bindings();const p=(await(await call(env,'products')).json()).find(item=>item.id==='boite-decouverte-maison');assert.equal(p.name,'Boîte Découverte de la Maison');assert.equal(p.price_cents,1500);assert.equal(p.stock,15);assert.equal(p.published,1);assert.equal(p.image,'/images/boite-decouverte-maison.jpg');for(const text of ['4 chocolats pralinés','4 pâtes de fruits','4 pommes calvados','2 calissons','pâte d’amande au calvados','raisin sec macéré au calvados','150 g'])assert.ok(p.description.includes(text));assert.equal(quoteCart([{id:p.id,quantity:1}],[p]).total_cents,1500);assert.equal(quoteCart([{id:p.id,quantity:16}],[p]).valid,false);assert.ok(builtinImages.some(item=>item.url===p.image));assert.ok(readFileSync(new URL('../public'+p.image,import.meta.url)).length>0);
 const edited={...p,stock:9,price_cents:1600,published:false};assert.equal((await call(env,'products/'+p.id,'PUT',edited)).status,200);const saved=env.sqlite.prepare('SELECT * FROM products WHERE id=?').get(p.id);env.sqlite.exec(readFileSync(new URL('../drizzle/0016_boite_decouverte.sql',import.meta.url),'utf8'));assert.deepEqual(env.sqlite.prepare('SELECT * FROM products WHERE id=?').get(p.id),saved);env.sqlite.close();
});

 test('supplied calendar photograph updates stored banners without changing price, stock or editorial copy',()=>{
 const db=database();const image='/images/calendrier-conte-avent-photo.jpg';assert.equal(defaultHighlights.find(p=>p.id==='calendrier-conte-avent').image,image);assert.ok(builtinImages.some(p=>p.url===image));
 db.prepare("UPDATE products SET image=?,stock=3,price_cents=1900 WHERE id='calendrier-conte-avent'").run('/images/calendrier-conte-avent-miniature.png');
 const draft=JSON.stringify({title:'Texte personnalisé',image:'/images/calendrier-conte-avent.png'});db.prepare('INSERT INTO puck_pages(path,draft,published,version) VALUES (?,?,?,?)').run('/',draft,null,7);
 const migration=readFileSync(new URL('../drizzle/0017_calendar_supplied_photo.sql',import.meta.url),'utf8');db.exec(migration);const p=db.prepare("SELECT * FROM products WHERE id='calendrier-conte-avent'").get();assert.equal(p.image,image);assert.equal(p.stock,3);assert.equal(p.price_cents,1900);
 const row=db.prepare("SELECT * FROM puck_pages WHERE path='/'").get();assert.equal(row.published,null);assert.equal(row.version,8);assert.deepEqual(JSON.parse(row.draft),{title:'Texte personnalisé',image});db.exec(migration);assert.deepEqual(db.prepare("SELECT * FROM puck_pages WHERE path='/'").get(),row);db.close();
 });

 test('product detail fields persist through admin edits and public lookup excludes hidden products and recipes',async()=>{
 const {getStoreProduct}=await import('../admin/products.mjs');const env=bindings();const p={id:'detail-box',name:'Boîte maison',description:'Un assortiment de confiseries.',price_cents:1500,stock:4,image:'',published:true,weight:'150 g',conservation:'Conseils validés par la maison',ingredients:'Composition validée',allergens:'Allergènes validés'};
 assert.equal((await call(env,'products','POST',p)).status,201);const detail=await getStoreProduct(env.DB,p.id);for(const key of ['description','weight','conservation','ingredients','allergens'])assert.equal(detail[key],p[key]);assert.equal(detail.stock,4);
 assert.equal((await call(env,'products/'+p.id,'PUT',{...p,ingredients:'x'.repeat(8001),version:1})).status,400);
 assert.equal((await call(env,'products/'+p.id,'PUT',{...p,allergens:'Actualisés',version:1})).status,200);assert.equal((await call(env,'products/'+p.id,'PUT',{...p,version:1})).status,409);
 const {weight,conservation,ingredients,allergens,...oldClient}=p;assert.equal((await call(env,'products/'+p.id,'PUT',{...oldClient,version:2})).status,200);assert.equal((await getStoreProduct(env.DB,p.id)).allergens,'Actualisés');
 assert.equal((await call(env,'products/'+p.id,'PUT',{...p,published:false,version:3})).status,200);assert.equal(await getStoreProduct(env.DB,p.id),null);assert.equal(await getStoreProduct(env.DB,'bonbon-1'),null);assert.equal(await getStoreProduct(env.DB,'missing'),null);assert.equal(await getStoreProduct(env.DB,"' OR 1=1 --"),null);assert.equal((await getStoreProduct(env.DB,'boite-decouverte-maison')).weight,'150 g');env.sqlite.close();
 });

test('restoring the previous layout removes the editorial introduction without changing articles or drafts',()=>{
 const db=database();const document={root:{props:{}},content:[{type:'Texte',props:{id:'editorial-introduction',title:'Au Parrain Généreux'}},{type:'Texte',props:{id:'Texte-initial-6',title:'Mon titre',level:'h2'}},{type:'Image',props:{id:'my-photo',src:'/images/boutique-historique.jpeg'}}]};db.prepare('INSERT INTO puck_pages(path,published,draft,version) VALUES (?,?,?,?)').run('/',JSON.stringify(document),null,8);db.prepare("INSERT INTO site_settings(id,body,version) VALUES ('appearance',?,4)").run(JSON.stringify({design:'editorial',shop:{presentation:'editorial',layout:'list',mobileColumns:1},chrome:{logoWidth:130}}));const products=db.prepare('SELECT * FROM products ORDER BY id').all();const sql=readFileSync(new URL('../drizzle/0020_restore_previous_layout.sql',import.meta.url),'utf8');db.exec(sql);const row=db.prepare("SELECT * FROM puck_pages WHERE path='/'").get();assert.equal(row.draft,null);const content=JSON.parse(row.published).content;assert.equal(content.length,2);assert.equal(content[0].props.level,'h1');assert.equal(content[0].props.title,'Mon titre');assert.equal(content[1].props.src,'/images/boutique-historique.jpeg');const settings=JSON.parse(db.prepare("SELECT body FROM site_settings WHERE id='appearance'").get().body);assert.equal(settings.shop.presentation,'square');assert.equal(settings.shop.mobileColumns,2);assert.equal(settings.chrome.logoWidth,130);assert.deepEqual(db.prepare('SELECT * FROM products ORDER BY id').all(),products);db.exec(sql);assert.deepEqual(db.prepare("SELECT * FROM puck_pages WHERE path='/'").get(),row);db.close();
});

test('reserved products can leave the catalogue while their order and stock release remain intact',async()=>{
 const {getStoreProduct}=await import('../admin/products.mjs');const env=bindings();const product={id:'reserved-box',name:'Coffret',description:'Maison',price_cents:4000,stock:3,image:'',published:true};await call(env,'products','POST',product);const response=await call(env,'orders','POST',{customer:'Client',contact:'contact',items:[{id:product.id,quantity:1}]});const order=await response.json();assert.equal((await call(env,'orders/'+order.id,'PUT',{status:'confirmed',version:1})).status,200);
 const before=env.sqlite.prepare('SELECT * FROM orders WHERE id=?').get(order.id);const result=await call(env,'products/'+product.id,'DELETE',{version:2});assert.equal(result.status,200);assert.equal((await result.json()).archived,true);assert.equal((await(await call(env,'products')).json()).some(p=>p.id===product.id),false);assert.equal(await getStoreProduct(env.DB,product.id),null);assert.deepEqual(env.sqlite.prepare('SELECT * FROM orders WHERE id=?').get(order.id),before);assert.equal(env.sqlite.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock,2);
 assert.equal((await call(env,'products/'+product.id,'PUT',{...product,version:3})).status,409);assert.equal((await call(env,'orders','POST',{customer:'Client',contact:'contact',items:[{id:product.id,quantity:1}]})).status,400);
 assert.equal((await call(env,'orders/'+order.id,'PUT',{status:'cancelled',version:2})).status,200);assert.equal(env.sqlite.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock,3);env.sqlite.close();
});
test('photo galleries validate paths, persist order, protect secondary uploads and support older single-photo edits',async()=>{
 const {getStoreProduct,productGallery}=await import('../admin/products.mjs');const env=bindings();const form=new FormData();form.set('alt','Vue secondaire');form.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'photo.png',{type:'image/png'}));const upload=await handleAdmin(req('/admin/api/images',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin},body:form}),env);const uploaded=await upload.json();const images=['/images/boite-decouverte-maison.jpg',uploaded.url];const p={id:'gallery-box',name:'Boîte',description:'Maison',price_cents:1500,stock:4,image:'',images,published:true};
 assert.equal((await call(env,'products','POST',p)).status,201);let saved=(await(await call(env,'products')).json()).find(p=>p.id==='gallery-box');assert.equal(saved.image,images[0]);assert.deepEqual(saved.images,images);assert.deepEqual(productGallery(await getStoreProduct(env.DB,p.id)),images);assert.equal((await call(env,'images/'+uploaded.id,'DELETE')).status,409);
 for(const bad of [['https://evil.example/image.png'],Array(13).fill(images[0]),['/images/../secret.png'],['']])assert.equal((await call(env,'products/'+p.id,'PUT',{...p,images:bad,version:1})).status,400);
 assert.equal((await call(env,'products/'+p.id,'PUT',{...p,images:[...images].reverse(),version:1})).status,200);saved=(await(await call(env,'products')).json()).find(item=>item.id==='gallery-box');assert.equal(saved.image,uploaded.url);assert.deepEqual(saved.images,[...images].reverse());
 const {images:ignored,...legacy}=p;assert.equal((await call(env,'products/'+p.id,'PUT',{...legacy,image:uploaded.url,version:2})).status,200);assert.deepEqual(productGallery(await getStoreProduct(env.DB,p.id)),[...images].reverse());assert.equal((await call(env,'products/'+p.id,'PUT',{...p,images:[],version:3})).status,200);assert.deepEqual(productGallery(await getStoreProduct(env.DB,p.id)),[]);assert.equal((await call(env,'images/'+uploaded.id,'DELETE')).status,200);env.sqlite.close();
});

test('removing a product with a Stripe checkout keeps its reservation until expiry',async()=>{
 const env=bindings();const p={id:'stripe-box',name:'Boîte',description:'Maison',price_cents:1500,stock:3,image:'',published:true};await call(env,'products','POST',p);env.sqlite.exec("INSERT INTO payment_settings(id,secret,webhook_secret,account_id,endpoint_id,mode,enabled) VALUES ('stripe','test-fixture','test-fixture','test-account','test-endpoint','test',1)");env.sqlite.prepare('INSERT INTO checkout_attempts(id,fingerprint,items,total_cents,shipping_cents,delivery,mode,created_at,expires_at,params,requester) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('attempt','key',JSON.stringify([{id:p.id,quantity:1,price_cents:1500}]),1500,0,'pickup','test',1,9999999999,'{}','test-visitor');assert.equal(env.sqlite.prepare('SELECT stock FROM products WHERE id=?').get(p.id).stock,2);const result=await call(env,'products/'+p.id,'DELETE',{version:2});assert.equal(result.status,200);assert.equal((await result.json()).archived,true);assert.equal(env.sqlite.prepare("SELECT status FROM checkout_attempts WHERE id='attempt'").get().status,'creating');env.sqlite.exec("UPDATE checkout_attempts SET status='expired' WHERE id='attempt'");assert.equal(env.sqlite.prepare('SELECT stock FROM products WHERE id=?').get(p.id).stock,3);assert.equal((await(await call(env,'products')).json()).some(item=>item.id===p.id),false);env.sqlite.close();
});

test('per-photo crop settings persist across reorder and legacy edits and reject unsafe values',async()=>{
 const {productPhotoCrops,getStoreProduct}=await import('../admin/products.mjs');const env=bindings();const a='/images/boite-decouverte-maison.jpg',b='/images/boite-decouverte-maison-vues.jpg';const p={id:'crop-box',name:'Boîte',description:'Maison',price_cents:1500,stock:4,image:a,images:[a,b],photo_crops:{[a]:{zoom:175,x:8,y:-12},[b]:{zoom:80,x:0,y:10}},published:true};assert.equal((await call(env,'products','POST',p)).status,201);let saved=(await(await call(env,'products')).json()).find(item=>item.id===p.id);assert.deepEqual(saved.photo_crops,p.photo_crops);assert.deepEqual(productPhotoCrops(await getStoreProduct(env.DB,p.id),src=>src===a?'/media/replaced':src),{'/media/replaced':p.photo_crops[a],[b]:p.photo_crops[b]});
 for(const photo_crops of [{[a]:{zoom:400,x:0,y:0}},{[a]:{zoom:100,x:51,y:0}},{[a]:{zoom:'100',x:0,y:0}},{[a]:{zoom:100,x:0,y:0,css:'evil'}},{'https://evil.example/a.jpg':{zoom:100,x:0,y:0}}])assert.equal((await call(env,'products/'+p.id,'PUT',{...p,photo_crops,version:1})).status,400);
 assert.equal((await call(env,'products/'+p.id,'PUT',{...p,images:[b,a],version:1})).status,200);saved=(await(await call(env,'products')).json()).find(item=>item.id===p.id);assert.deepEqual(saved.photo_crops,p.photo_crops);const {photo_crops:ignored,...legacy}=p;assert.equal((await call(env,'products/'+p.id,'PUT',{...legacy,version:2})).status,200);assert.deepEqual(productPhotoCrops(await getStoreProduct(env.DB,p.id)),p.photo_crops);assert.equal((await call(env,'products/'+p.id,'PUT',{...p,photo_crops:{},version:3})).status,200);assert.deepEqual(productPhotoCrops(await getStoreProduct(env.DB,p.id)),{});env.sqlite.close();
});
test('photo preparation keeps small originals and reduces large or unsupported images before upload',async()=>{
 const {preparePhoto}=await import('../admin/photo-upload.mjs');const small=new File(['photo'],'image.jpg',{type:'image/jpeg'});assert.equal(await preparePhoto(small),small);await assert.rejects(()=>preparePhoto(new File([],'empty.jpg')),/non vide/);await assert.rejects(()=>preparePhoto(new File([new Uint8Array(31*1024*1024)],'huge.jpg',{type:'image/jpeg'})),/30 Mo/);
 const oldBitmap=globalThis.createImageBitmap,oldDocument=globalThis.document;let closed=false;const canvas={width:0,height:0,getContext:()=>({drawImage:()=>{}}),toBlob:fn=>fn(new Blob(['RIFF0000WEBP'],{type:'image/webp'}))};globalThis.createImageBitmap=async()=>({width:4000,height:3000,close:()=>{closed=true;}});globalThis.document={createElement:()=>canvas};
 try{const converted=await preparePhoto(new File(['heic-data'],'photo.heic',{type:'image/heic'}));assert.equal(converted.type,'image/webp');assert.equal(converted.name,'photo.webp');assert.equal(canvas.width,2048);assert.equal(canvas.height,1536);assert.equal(closed,true);assert.ok(converted.size<5*1024*1024);}finally{if(oldBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=oldBitmap;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});

test('chocolate discovery is editable in Puck and uses the current published recipes',async()=>{
 const env=bindings();for(const id of ['bonbon-1','bonbon-2'])await call(env,'products','POST',{id,name:'Recette de la maison',description:'Présentation de la recette',image:'',published:true});const result=await call(env,'puck?path=/chocolats');assert.equal(result.status,200);const page=await result.json();assert.equal(page.data.content[0].props.title,'Nos chocolats');assert.ok(page.data.content.some(block=>block.type==='Recettes'));assert.ok(page.storefront.recipes.some(recipe=>recipe.id==='bonbon-1'));env.sqlite.exec("UPDATE products SET published=0 WHERE id='bonbon-1'");const updated=await(await call(env,'puck?path=/chocolats')).json();assert.equal(updated.storefront.recipes.some(recipe=>recipe.id==='bonbon-1'),false);page.data.content[0].props.title='Notre collection';assert.equal((await call(env,'puck?path=/chocolats','PUT',{action:'publish',version:0,data:page.data})).status,200);assert.equal((await(await call(env,'puck?path=/chocolats')).json()).data.content[0].props.title,'Notre collection');env.sqlite.close();
});
test('chocolate menu migration preserves custom links and does not duplicate the new page',async()=>{
 const {defaultAppearance,validateAppearance}=await import('../admin/appearance.mjs');const db=database();const settings={...structuredClone(defaultAppearance),collectionHref:'/bonbons',navigation:{groupLabel:'La maison',items:[{label:'Notre maison',href:'/maison',group:false},{label:'Nous écrire',href:'/contenu/contact',group:false}]}};db.prepare("INSERT INTO site_settings(id,body,version) VALUES ('appearance',?,3)").run(JSON.stringify(settings));const sql=readFileSync(new URL('../drizzle/0025_chocolate_discovery_page.sql',import.meta.url),'utf8');const products=db.prepare('SELECT * FROM products ORDER BY id').all();db.exec(sql);const row=db.prepare("SELECT * FROM site_settings WHERE id='appearance'").get();const saved=validateAppearance(JSON.parse(row.body));assert.equal(saved.navigation.items.filter(item=>item.href==='/chocolats').length,1);assert.ok(saved.navigation.items.some(item=>item.label==='Nous écrire'&&item.href==='/contenu/contact'));assert.equal(saved.collectionHref,'/chocolats');assert.deepEqual(db.prepare('SELECT * FROM products ORDER BY id').all(),products);db.exec(sql);assert.deepEqual(db.prepare("SELECT * FROM site_settings WHERE id='appearance'").get(),row);db.close();
});

test('highlight insertion shifts siblings, moves compact both groups and deletion stays deleted',async()=>{
 const env=bindings();
 const list=async()=> (await (await call(env,'highlights')).json());
 const move=async(id,position,placement)=>{const row=(await list()).find(item=>item.id===id);const response=await call(env,'highlights/'+id,'PUT',{...row,position,placement:placement||row.placement,published:Boolean(row.published)});assert.equal(response.status,200);};
 const initial=await list(),news=initial.filter(item=>item.placement==='news').map(item=>item.id),hero=initial.filter(item=>item.placement==='hero').map(item=>item.id);
 await move(news[0],2);assert.deepEqual((await list()).filter(item=>item.placement==='news').map(item=>item.id),[news[1],news[0],news[2]]);
 await move(news[2],1);assert.deepEqual((await list()).filter(item=>item.placement==='news').map(item=>item.id),[news[2],news[1],news[0]]);
 await move(news[1],2,'hero');let all=await list();assert.deepEqual(all.filter(item=>item.placement==='hero').map(item=>item.id),[hero[0],news[1],...hero.slice(1)]);
 assert.deepEqual(all.filter(item=>item.placement==='news').map(item=>item.position),[1,2]);
 const row=all.find(item=>item.id===news[1]);assert.equal((await call(env,'highlights/'+row.id,'DELETE',{version:row.version})).status,200);
 all=await list();assert.deepEqual(all.filter(item=>item.placement==='hero').map(item=>item.id),hero);assert.deepEqual(all.filter(item=>item.placement==='hero').map(item=>item.position),[1,2,3]);assert.ok(!(await list()).some(item=>item.id===row.id));
 assert.equal((await call(env,'highlights/'+row.id,'PUT',{...row,published:true})).status,409);env.sqlite.close();
});

test('concurrent highlight writes roll back atomically and embedded management stays authenticated and same-origin',async()=>{
 const env=bindings();
 await env.DB.batch([env.DB.prepare('UPDATE highlights_state SET version=1 WHERE id=1')]);
 await assert.rejects(()=>env.DB.batch([env.DB.prepare('UPDATE highlights_state SET version=1 WHERE id=1'),env.DB.prepare("UPDATE products SET stock=99")]),/highlight version conflict/);
 assert.equal(env.sqlite.prepare('SELECT version FROM highlights_state').get().version,1);assert.ok(!env.sqlite.prepare('SELECT 1 FROM products WHERE stock=99').get());
 assert.equal((await handleAdmin(req('/admin?workspace=1'),env)).status,302);
 const response=await handleAdmin(req('/admin?workspace=1',{headers:{'oai-authenticated-user-id':'owner'}}),env);assert.equal(response.status,200);assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN');assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'self'/);
 env.sqlite.close();
});

test('homepage migration links banners to managed highlights and preserves original slides and styles',()=>{
 const db=new DatabaseSync(':memory:');const entries=JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8')).entries;
 for(const entry of entries.filter(item=>item.idx<26))db.exec(readFileSync(new URL('../drizzle/'+entry.tag+'.sql',import.meta.url),'utf8'));
 const data={content:[{type:'Bandeau',props:{id:'banner',items:[{title:'Texte conservé'}],style:{padding:42}}},{type:'Nouveautes',props:{id:'news',items:[],title:'Notre collection'}},{type:'Texte',props:{id:'text',text:'Maison'}}],root:{props:{}}};
 db.prepare('INSERT INTO puck_pages(path,draft,published,version) VALUES (?,?,?,?)').run('/',JSON.stringify(data),JSON.stringify(data),3);
 db.exec(readFileSync(new URL('../drizzle/0026_highlight_management.sql',import.meta.url),'utf8'));const row=db.prepare("SELECT * FROM puck_pages WHERE path='/'").get();
 for(const field of ['draft','published']){const updated=JSON.parse(row[field]);assert.equal(updated.content[0].props.source,'managed');assert.equal(updated.content[1].props.source,'managed');assert.deepEqual(updated.content[0].props.items,data.content[0].props.items);assert.deepEqual(updated.content[0].props.style,data.content[0].props.style);assert.deepEqual(updated.content[2],data.content[2]);}assert.equal(row.version,4);db.close();
});

test('free compositions save positions, resizing, text, images and layers without unsafe content',async()=>{
 const env=bindings();const {puckDefaults,puckImages}=await import('../admin/puck-model.mjs');const doc=(await(await call(env,'puck?path=/')).json()).data;
 const item={id:'text-one',kind:'text',text:'Les créations de la maison',image:'',alt:'',href:'/boutique',x:12,y:18,width:55,height:32,size:48,color:'#30271f',background:'',align:'left'};
 doc.content=[{type:'CompositionLibre',props:{...structuredClone(puckDefaults.CompositionLibre),id:'free-one',items:[item,{...item,id:'photo-one',kind:'image',image:'/images/boutique-historique.jpeg',x:70,width:20}]}}];
 assert.equal((await call(env,'puck?path=/','PUT',{action:'publish',version:0,data:doc})).status,200);const stored=(await(await call(env,'puck?path=/')).json()).data;assert.deepEqual(stored.content[0].props.items,doc.content[0].props.items);assert.ok(puckImages(stored).includes('/images/boutique-historique.jpeg'));
 for(const patch of [{x:99},{width:100},{height:-1},{size:500},{href:'javascript:alert(1)'},{image:'https://evil.test/photo.png'},{color:'url(evil)'}]){const bad=structuredClone(doc);Object.assign(bad.content[0].props.items[0],patch);assert.equal((await call(env,'puck?path=/','PUT',{action:'publish',version:1,data:bad})).status,400);}
 const duplicate=structuredClone(doc);duplicate.content[0].props.items.push({...item});assert.equal((await call(env,'puck?path=/','PUT',{action:'draft',version:1,data:duplicate})).status,400);assert.equal((await(await call(env,'puck?path=/')).json()).version,1);env.sqlite.close();
});

test('public free composition renders saved geometry and escaped text without editor controls',async()=>{
 const ts=await import('typescript'),React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
 let code=ts.transpileModule(readFileSync(new URL('../components/puck/free-canvas.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 code=code.replace(/from (['"])(react(?:\/jsx-runtime)?|@puckeditor\/core)\1/g,(_,quote,name)=>'from '+JSON.stringify(import.meta.resolve(name)));
 const {FreeCanvas}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const item={id:'text',kind:'text',text:'<script>Maison</script>',image:'',alt:'',href:'/boutique',x:12,y:18,width:55,height:32,size:48,color:'#30271f',background:'',align:'left'};
 const html=renderToStaticMarkup(React.createElement(FreeCanvas,{height:560,items:[item,{...item,id:'link',kind:'button',text:'Découvrir'}]}));assert.match(html,/left:12%/);assert.match(html,/top:18%/);assert.match(html,/width:55%/);assert.match(html,/aspect-ratio:1000 \/ 560/);assert.match(html,/&lt;script&gt;Maison/);assert.match(html,/href="\/boutique"/);assert.doesNotMatch(html,/<script>|contenteditable|apg-free-resize|apg-free-tools/);
});

test('media library identifies exact uses, replaces across drafts and articles, then deletes safely in bulk',async()=>{
 const env=bindings();async function upload(name){const form=new FormData();form.set('alt',name);form.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10])],name+'.png',{type:'image/png'}));return (await handleAdmin(req('/admin/api/images',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin},body:form}),env)).json();}
 const source=await upload('Première'),target=await upload('Nouvelle'),unused=await upload('Inutilisée');
 const product={id:'coffret-media',name:'Coffret de dégustation',description:'Maison',price_cents:1500,stock:15,image:source.url,images:[source.url,target.url],photo_crops:{[source.url]:{zoom:120,x:5,y:0}},published:true};assert.equal((await call(env,'products','POST',product)).status,201);
 const {puckDefaults}=await import('../admin/puck-model.mjs');const page=(await(await call(env,'puck?path=/')).json()).data;page.content=[{type:'Galerie',props:{...structuredClone(puckDefaults.Galerie),id:'gallery-exact',images:[{image:source.url,alt:'Coffret'}]}}];assert.equal((await call(env,'puck?path=/','PUT',{action:'draft',version:0,data:page})).status,200);
 const appearance=await(await call(env,'appearance')).json();appearance.settings.chrome.logo=source.url;await call(env,'appearance','PUT',{settings:appearance.settings,version:0});
 const usage=await(await call(env,'media/usage?id='+source.id)).json();assert.ok(usage.usages.some(use=>use.label.includes('Coffret de dégustation')&&use.href.includes('item=coffret-media')));assert.ok(usage.usages.some(use=>use.label.includes('gallery-exact')&&use.label.includes('brouillon')));assert.ok(usage.usages.some(use=>use.label.includes('Réglages du site')));
 const partial=await(await call(env,'media/delete','POST',{ids:[source.id,unused.id]})).json();assert.equal(partial.results[0].ok,false);assert.ok(partial.results[0].usages.length);assert.equal(partial.results[1].ok,true);assert.equal(await env.BUCKET.get(unused.id),undefined);assert.ok(await env.BUCKET.get(source.id));
 assert.equal((await call(env,'media/replace','POST',{id:source.id,replacement:target.url})).status,200);
 const saved=env.sqlite.prepare("SELECT * FROM products WHERE id='coffret-media'").get();assert.equal(saved.image,target.url);assert.equal(saved.stock,15);assert.equal(saved.price_cents,1500);assert.deepEqual(JSON.parse(saved.photo_crops),{[target.url]:{zoom:120,x:5,y:0}});
 const draft=env.sqlite.prepare("SELECT * FROM puck_pages WHERE path='/'").get();assert.equal(draft.published,null);assert.equal(JSON.parse(draft.draft).content[0].props.images[0].image,target.url);assert.equal((await(await call(env,'appearance')).json()).settings.chrome.logo,target.url);
 const removed=await(await call(env,'media/delete','POST',{ids:[source.id]})).json();assert.equal(removed.results[0].ok,true);assert.equal(await env.BUCKET.get(source.id),undefined);assert.equal((await call(env,'images/'+target.id,'DELETE')).status,409);env.sqlite.close();
});

test('media replacement is atomic when an article changes and API access remains protected',async()=>{
 const env=bindings();const source='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';for(const id of [source,target])env.sqlite.prepare('INSERT INTO images(id,alt,type,size) VALUES(?,?,?,?)').run(id,id,'image/png',8);
 const product={id:'concurrent-media',name:'Boîte',description:'Maison',price_cents:1800,stock:5,image:'/media/'+source,published:true};await call(env,'products','POST',product);
 assert.equal((await handleAdmin(req('/admin/api/media/usage?id='+source),env)).status,401);assert.equal((await handleAdmin(req('/admin/api/media/delete',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({ids:[source]})}),env)).status,403);
 const originalBatch=env.DB.batch;env.DB.batch=async statements=>{env.sqlite.prepare("UPDATE products SET stock=4,version=version+1 WHERE id='concurrent-media'").run();env.DB.batch=originalBatch;return originalBatch(statements);};
 assert.equal((await call(env,'media/replace','POST',{id:source,replacement:'/media/'+target})).status,409);const row=env.sqlite.prepare("SELECT * FROM products WHERE id='concurrent-media'").get();assert.equal(row.image,'/media/'+source);assert.equal(row.stock,4);assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM admin_mutation_guards').get().n,0);assert.equal(env.sqlite.prepare("SELECT COUNT(*) n FROM audit WHERE action='REPLACE_MEDIA'").get().n,0);
 assert.equal((await call(env,'media/replace','POST',{id:source,replacement:'https://evil.test/photo.png'})).status,400);assert.equal((await call(env,'media/delete','POST',{ids:[]})).status,400);env.sqlite.close();
});

test('media deletion reports page content and theme mappings and can replace default theme images',async()=>{
 const env=bindings();const id='33333333-3333-4333-8333-333333333333',next='44444444-4444-4444-8444-444444444444';for(const key of [id,next])env.sqlite.prepare('INSERT INTO images(id,alt,type,size) VALUES(?,?,?,?)').run(key,key,'image/png',8);
 await call(env,'pages','POST',{id:'collection-media',title:'Notre collection',body:JSON.stringify({image:'/media/'+id}),published:true});const usage=await(await call(env,'media/usage?id='+id)).json();assert.ok(usage.usages.some(use=>use.label==='Page : Notre collection'));assert.equal((await call(env,'images/'+id,'DELETE')).status,409);
 assert.equal((await call(env,'media/replace','POST',{id,replacement:'/media/'+next})).status,200);assert.equal(JSON.parse(env.sqlite.prepare("SELECT body FROM pages WHERE id='collection-media'").get().body).image,'/media/'+next);
 assert.equal((await call(env,'media/replace','POST',{id:'asset-logo',replacement:'/media/'+next})).status,200);const uses=await(await call(env,'media/usage?id='+next)).json();assert.ok(uses.usages.some(use=>use.label.startsWith('Visuel du thème :')));assert.equal((await call(env,'images/'+next,'DELETE')).status,409);env.sqlite.close();
});

test('ordinary blocks and galleries persist independent mobile dimensions without changing desktop layout',async()=>{
 const env=bindings();const {puckDefaults}=await import('../admin/puck-model.mjs');const doc=(await(await call(env,'puck?path=/')).json()).data;
 const style={...structuredClone(puckDefaults.Image.style),width:70,minHeight:350,mobile:{width:100,minHeight:180,size:16,paddingX:12,imageHeight:180,align:'center'}};doc.content=[{type:'Image',props:{...structuredClone(puckDefaults.Image),id:'responsive-image',style}},{type:'Galerie',props:{...structuredClone(puckDefaults.Galerie),id:'gallery',columns:4,mobileColumns:2,images:[{image:'/images/boutique-historique.jpeg',alt:'La maison'}]}}];
 assert.equal((await call(env,'puck?path=/','PUT',{action:'publish',version:0,data:doc})).status,200);const saved=(await(await call(env,'puck?path=/')).json()).data;assert.equal(saved.content[0].props.style.width,70);assert.equal(saved.content[0].props.style.mobile.width,100);assert.equal(saved.content[1].props.columns,4);assert.equal(saved.content[1].props.mobileColumns,2);
 for(const mobile of [{width:200},{color:'url(evil)'},{position:'fixed'},{imageHeight:-2}]){const bad=structuredClone(doc);bad.content[0].props.style.mobile=mobile;assert.equal((await call(env,'puck?path=/','PUT',{action:'publish',version:1,data:bad})).status,400);}const bad=structuredClone(doc);bad.content[1].props.images[0].image='https://evil.test/x.png';assert.equal((await call(env,'puck?path=/','PUT',{action:'draft',version:1,data:bad})).status,400);env.sqlite.close();
});

test('theme images can leave the library after replacement while the active replacement stays protected',async()=>{
 const env=bindings(),id='55555555-5555-4555-8555-555555555555';env.sqlite.prepare('INSERT INTO images(id,alt,type,size) VALUES(?,?,?,?)').run(id,'Nouveau logo','image/png',8);
 let result=await(await call(env,'media/delete','POST',{ids:['asset-logo']})).json();assert.equal(result.results[0].ok,false);assert.ok(result.results[0].usages.some(use=>use.label.includes('thème')));
 await call(env,'media/replace','POST',{id:'asset-logo',replacement:'/media/'+id});result=await(await call(env,'media/delete','POST',{ids:['asset-logo']})).json();assert.equal(result.results[0].ok,true);assert.equal(result.results[0].retired,true);const library=await(await call(env,'images')).json();assert.ok(!library.some(image=>image.id==='asset-logo'));assert.ok(library.some(image=>image.id===id));assert.ok(env.sqlite.prepare('SELECT original FROM image_replacements WHERE image_id=?').get(id));assert.equal((await call(env,'images/'+id,'DELETE')).status,409);env.sqlite.close();
});

test('a photo becoming used during deletion is retained atomically',async()=>{
 const env=bindings(),id='66666666-6666-4666-8666-666666666666';env.sqlite.prepare('INSERT INTO images(id,alt,type,size) VALUES(?,?,?,?)').run(id,'Photo','image/png',8);await env.BUCKET.put(id,new Uint8Array([1]),{httpMetadata:{contentType:'image/png'}});
 const original=env.DB.batch;env.DB.batch=async statements=>{env.sqlite.prepare('INSERT INTO products(id,name,description,price_cents,stock,image) VALUES(?,?,?,?,?,?)').run('late-photo','Boîte','Maison',1800,5,'/media/'+id);env.DB.batch=original;return original(statements);};const result=await(await call(env,'media/delete','POST',{ids:[id]})).json();assert.equal(result.results[0].ok,false);assert.ok(env.sqlite.prepare('SELECT id FROM images WHERE id=?').get(id));assert.ok(await env.BUCKET.get(id));assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM admin_mutation_guards').get().n,0);env.sqlite.close();
});

test('successive replacements of a theme slot update persisted uses and keep highlight ordering versioned',async()=>{
 const env=bindings(),first='77777777-7777-4777-8777-777777777777',second='88888888-8888-4888-8888-888888888888';for(const id of [first,second])env.sqlite.prepare('INSERT INTO images(id,alt,type,size) VALUES(?,?,?,?)').run(id,id,'image/png',8);
 const asset=builtinImages.find(item=>item.id==='asset-logo');await call(env,'products','POST',{id:'theme-photo-product',name:'Coffret',description:'Maison',price_cents:1500,stock:4,image:asset.url,published:true});
 assert.equal((await call(env,'media/replace','POST',{id:asset.id,replacement:'/media/'+first})).status,200);assert.equal(env.sqlite.prepare("SELECT image FROM products WHERE id='theme-photo-product'").get().image,'/media/'+first);
 const highlight={placement:'news',kicker:'Maison',title:'Nouvelle boîte',description:'À découvrir',image:'/media/'+first,alt:'Coffret',image_fit:'contain',button_label:'Découvrir',href:'/boutique',position:1,published:true};const created=await(await call(env,'highlights','POST',highlight)).json();const revision=env.sqlite.prepare('SELECT version FROM highlights_state').get().version;
 assert.equal((await call(env,'media/replace','POST',{id:asset.id,replacement:'/media/'+second})).status,200);assert.equal(env.sqlite.prepare("SELECT image FROM products WHERE id='theme-photo-product'").get().image,'/media/'+second);assert.equal(env.sqlite.prepare('SELECT image FROM highlights WHERE id=?').get(created.id).image,'/media/'+second);assert.equal(env.sqlite.prepare('SELECT version FROM highlights_state').get().version,revision+1);
 assert.equal((await call(env,'highlights/'+created.id,'PUT',{...highlight,version:1})).status,409);const info=await(await call(env,'media/usage?id='+asset.id)).json();assert.equal(info.url,'/media/'+second);assert.ok(info.usages.some(use=>use.label.includes('Coffret')));assert.equal((await call(env,'images/'+first,'DELETE')).status,200);env.sqlite.close();
});

test('transparent calendar banner migration preserves product photos and unrelated highlights',()=>{
 const db=new DatabaseSync(':memory:'),entries=JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8')).entries;for(const entry of entries.filter(entry=>entry.idx<28))db.exec(readFileSync(new URL('../drizzle/'+entry.tag+'.sql',import.meta.url),'utf8'));
 db.prepare('INSERT INTO highlights(id,placement,title,image,alt,button_label,href,version) VALUES(?,?,?,?,?,?,?,?)').run('calendrier-conte-avent','hero','Le Conte de l’Avent','/images/calendrier-conte-avent-photo.jpg','Calendrier','Découvrir','/boutique',7);
 const before=db.prepare("SELECT image,stock,price_cents FROM products WHERE id='calendrier-conte-avent'").get();const revision=db.prepare('SELECT version FROM highlights_state').get().version;
 db.exec(readFileSync(new URL('../drizzle/0028_transparent_calendar_banner.sql',import.meta.url),'utf8'));const row=db.prepare("SELECT image,version FROM highlights WHERE id='calendrier-conte-avent'").get();assert.equal(row.image,'/images/calendrier-conte-avent-detoure.png');assert.equal(row.version,8);assert.equal(db.prepare('SELECT version FROM highlights_state').get().version,revision+1);assert.deepEqual(db.prepare("SELECT image,stock,price_cents FROM products WHERE id='calendrier-conte-avent'").get(),before);db.close();
});


test('contact paragraphs upgrade into an editable address card without altering other blocks',async()=>{
 const {puckRoot,puckDefaults,validatePuckData}=await import('../admin/puck-model.mjs');
 const root={...puckRoot,address:'123 rue Maréchal Joffre · 76600 Le Havre',hours:'Mardi — Samedi · 9h–12h · 14h–19h',phone:'02 35 42 32 75',email:'genereuxparrain@gmail.com'};
 const text={type:'Texte',props:{...structuredClone(puckDefaults.Texte),id:'contact',body:[root.address,root.hours,root.phone,root.email].join('\n')}};
 const unrelated={type:'Texte',props:{...structuredClone(puckDefaults.Texte),id:'story',body:'Notre savoir-faire au Havre.'}};
 const result=validatePuckData({root:{props:root},content:[text,unrelated]});assert.equal(result.content[0].type,'Coordonnees');assert.equal(result.content[0].props.phone,root.phone);assert.equal(result.content[0].props.address,root.address);assert.equal(result.content[0].props.id,'contact');assert.equal(result.content[1].type,'Texte');assert.equal(result.content[1].props.body,unrelated.props.body);assert.deepEqual(validatePuckData(result),result);
 result.content[0].props.phone='02 35 00 00 00';assert.equal(validatePuckData(result).content[0].props.phone,'02 35 00 00 00');
});
