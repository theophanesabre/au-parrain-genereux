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
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM products').get().n,15);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM products WHERE published=1').get().n,15);
 assert.equal((await call(env,'products')).status,200);
 assert.equal((await handleAdmin(req('/admin/api/products',{headers:{'oai-authenticated-user-id':'intruder'}}),env)).status,403);
 const rows=await (await call(env,'products')).json();assert.equal(rows.length,15);
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
 const env=bindings();const tabs=['products','recipes','highlights','pages','images','orders','audit'].map(tab=>{const b=new Element('button');b.dataset.tab=tab;return b;});
 const nodes=new Map(['stock-alerts','title','help','stats','add','reload','search','message','list','dialog','form','form-title','fields','form-error','save','close'].map(id=>['#'+id,new Element(id)]));
 const document={createElement:tag=>new Element(tag),querySelector:selector=>selector==='[data-tab]'?tabs[0]:nodes.get(selector),querySelectorAll:()=>tabs};
 const context=createContext({document,FormData,confirm:()=>false,fetch:async(path,options={})=>handleAdmin(req(path,{...options,headers:{...options.headers,'oai-authenticated-user-id':'owner',...(options.method&&options.method!=='GET'?{origin}:{})}}),env)});
 new Script(adminHTML('test').match(/<script[^>]*>([\s\S]*)<\/script>/)[1]).runInContext(context);
 const settle=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
 await settle();assert.equal(nodes.get('#stock-alerts').hidden,true);await call(env,'products','POST',{id:'coffret-alerte',name:'Coffret',description:'Maison',price_cents:1800,stock:0,image:'',published:true});await tabs.find(b=>b.dataset.tab==='products').onclick();await settle();assert.equal(nodes.get('#stock-alerts').hidden,false);assert.ok(nodes.get('#stock-alerts').children.some(node=>node.textContent.includes('rupture de stock')));tabs.find(b=>b.dataset.tab==='pages').onclick();await settle();
 let cards=nodes.get('#list').children.filter(n=>n.tag==='article');assert.equal(cards.length,4);
 for(const card of cards)assert.ok(card.children.some(node=>node.tag==='button'&&node.textContent==='Modifier'));
 await cards[0].children.find(node=>node.tag==='button'&&node.textContent==='Modifier').onclick();assert.equal(nodes.get('#dialog').open,true);
 assert.ok(nodes.get('#fields').children.some(label=>label.children.some(input=>input.name==='content_heroTitle'&&input.value.includes('Le chocolat artisanal'))));
 tabs.find(b=>b.dataset.tab==='images').onclick();await settle();cards=nodes.get('#list').children.filter(n=>n.tag==='article');assert.equal(cards.length,21);
 assert.ok(cards[0].children.some(node=>node.tag==='button'&&node.textContent==='Remplacer'));
 tabs.find(b=>b.dataset.tab==='highlights').onclick();await settle();cards=nodes.get('#list').children.filter(n=>n.tag==='article');assert.equal(cards.length,5);
 await cards[0].children.find(node=>node.tag==='button'&&node.textContent==='Modifier').onclick();
 assert.ok(nodes.get('#fields').children.some(label=>label.children.some(input=>input.name==='placement'&&input.tag==='select')));
 assert.ok(nodes.get('#fields').children.some(label=>label.children.some(input=>input.name==='image'&&input.tag==='select'&&input.children.length>20)));
 env.sqlite.close();
});

test('highlights can be ordered, published and hidden permanently without modifying source defaults',async()=>{
 const {mergeHighlights,defaultHighlights}=await import('../admin/highlights.mjs');const env=bindings();
 const initial=await (await call(env,'highlights')).json();assert.equal(initial.length,5);assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM highlights').get().n,0);
 const hero=initial.find(item=>item.placement==='hero');
 assert.equal((await call(env,'highlights/'+hero.id,'DELETE',{version:0})).status,200);
 let all=await (await call(env,'highlights')).json();assert.equal(all.find(item=>item.id===hero.id).published,0);
 let publicRows=mergeHighlights(env.sqlite.prepare('SELECT * FROM highlights').all()).filter(item=>item.published===1);
 assert.ok(!publicRows.some(item=>item.id===hero.id));assert.equal(defaultHighlights.find(item=>item.id===hero.id).published,1);
 const data={placement:'news',kicker:'La maison',title:'Notre collection',description:'Une découverte',image:'/images/bonbons-ia-basse-def/1.png',alt:'Chocolat',image_fit:'contain',button_label:'Découvrir',href:'/bonbons#bonbon-1',position:0,published:false};
 const created=await call(env,'highlights','POST',data);assert.equal(created.status,201);const {id}=await created.json();
 publicRows=mergeHighlights(env.sqlite.prepare('SELECT * FROM highlights').all()).filter(item=>item.published===1);assert.ok(!publicRows.some(item=>item.id===id));
 assert.equal((await call(env,'highlights/'+id,'PUT',{...data,published:true,version:1})).status,200);
 assert.equal((await call(env,'highlights/'+id,'PUT',{...data,version:1})).status,409);
 publicRows=mergeHighlights(env.sqlite.prepare('SELECT * FROM highlights').all()).filter(item=>item.published===1&&item.placement==='news');assert.equal(publicRows[0].id,id);
 assert.equal((await call(env,'highlights/'+id,'DELETE',{version:2})).status,200);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM highlights WHERE id=?').get(id).n,0);env.sqlite.close();
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
 const initial=await (await call(env,'appearance')).json();assert.equal(initial.version,0);assert.deepEqual(initial.settings,defaultAppearance);
 const settings={...initial.settings,hero:'image-right',buttons:'outline',collectionLabel:'Tous les articles',collectionHref:'/boutique',sections:[...initial.settings.sections].reverse().map((section,index)=>({...section,visible:index!==0}))};
 let response=await call(env,'appearance','PUT',{settings,version:0});assert.equal(response.status,200);assert.equal((await response.json()).version,1);
 assert.equal((await (await call(env,'appearance')).json()).settings.sections[0].id,'collection');
 assert.equal((await call(env,'appearance','PUT',{settings,version:0})).status,409);
 for(const bad of [{...settings,background:'url(evil)'},{...settings,sections:settings.sections.map(s=>({...s,visible:false}))},{...settings,sections:[...settings.sections.slice(1),settings.sections[1]]},{...settings,historyHref:'https://evil.example'},{...settings,collectionHref:'/admin'}])assert.equal((await call(env,'appearance','PUT',{settings:bad,version:1})).status,400);
 assert.equal((await handleAdmin(req('/admin/api/appearance',{method:'PUT',headers:{'oai-authenticated-user-id':'owner',origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({settings,version:1})}),env)).status,403);
 assert.equal((await call(env,'appearance','PUT',{settings:defaultAppearance,version:1})).status,200);
 const restored=await (await call(env,'appearance')).json();assert.equal(restored.version,2);assert.deepEqual(restored.settings,defaultAppearance);
 const html=await (await handleAdmin(req('/admin/apparence',{headers:{'oai-authenticated-user-id':'owner'}}),env)).text();assert.match(html,/Sections de l’accueil/);assert.match(html,/Aperçu de la mise en page/);
 env.sqlite.close();
});

test('appearance rendering falls back safely and applies section order, visibility and button destinations',async()=>{
 const ts=await import('typescript');const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {defaultAppearance}=await import('../admin/appearance.mjs');
 let code=ts.transpileModule(readFileSync(new URL('../components/appearance.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
 for(const name of ['react/jsx-runtime','react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`).replaceAll(`from '${name}'`,`from ${JSON.stringify(import.meta.resolve(name))}`);
 code=code.replaceAll("'@/admin/appearance.mjs'",JSON.stringify(new URL('../admin/appearance.mjs',import.meta.url).href));
 code=code.replace("import { usePathname } from 'next/navigation';","const usePathname=()=>'/';");
 const styleCode=ts.transpileModule(readFileSync(new URL('../components/visual-style.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;code=code.replace("import { VisualRuntime } from './visual-runtime';","const VisualRuntime=()=>null;").replace("'./visual-style'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(styleCode).toString('base64')));
 const {AppearanceShell,HomeSections,HomeButton,PageButtons,PageSections}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 assert.match(renderToStaticMarkup(createElement(AppearanceShell,{initial:undefined},'Contenu')),/data-background="cream"/);
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
 for(const path of ['/','/maison','/savoir-faire','/bonbons','/boutique','/panier']){const response=await call(env,'puck?path='+encodeURIComponent(path));assert.equal(response.status,200);const page=await response.json();assert.equal(page.version,0);assert.equal(page.published,false);assert.deepEqual(validatePuckData(page.data),page.data);assert.ok(page.data.content.length);}
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM puck_pages').get().n,0);
 const doc=(await(await call(env,'puck?path=/maison')).json()).data;doc.content[0].props.title='Une maison';
 assert.equal((await call(env,'puck?path=/maison','PUT',{action:'draft',version:0,data:doc})).status,200);
 assert.equal(env.sqlite.prepare("SELECT published FROM puck_pages WHERE path='/maison'").get().published,null);
 assert.equal((await(await call(env,'puck?path=/maison')).json()).data.content[0].props.title,'Une maison');
 assert.equal((await call(env,'puck?path=/maison','PUT',{action:'publish',version:0,data:doc})).status,409);
 assert.equal((await call(env,'puck?path=/maison','PUT',{action:'publish',version:1,data:doc})).status,200);
 const published=env.sqlite.prepare("SELECT published FROM puck_pages WHERE path='/maison'").get().published;assert.equal(JSON.parse(published).content[0].props.title,'Une maison');
 doc.content[0].props.title='Brouillon suivant';assert.equal((await call(env,'puck?path=/maison','PUT',{action:'draft',version:2,data:doc})).status,200);
 assert.equal(env.sqlite.prepare("SELECT published FROM puck_pages WHERE path='/maison'").get().published,published);
 assert.equal((await(await call(env,'puck?path=/')).json()).version,0);
 assert.equal((await call(env,'puck?path=/maison','PUT',{action:'restore',version:3})).status,200);
 const restored=await(await call(env,'puck?path=/maison')).json();assert.equal(restored.published,false);assert.notEqual(restored.data.content[0].props.title,'Brouillon suivant');assert.equal(restored.version,4);
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
 const mocks='data:text/javascript;base64,'+Buffer.from('export const PuckImageField=()=>null;export const CartLink=()=>null;export const CartPage=()=>null;export const Catalog=()=>null;export const SpotlightCarousel=()=>null;export const NewsRail=()=>null;').toString('base64');
 let code=ts.transpileModule(readFileSync(new URL('../components/puck/config.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 code=code.replace(/from (['"])(react(?:\/jsx-runtime)?)\1/g,(_,quote,name)=>'from '+JSON.stringify(import.meta.resolve(name))).replace(/from (['"])@\/admin\/puck-model.mjs\1/g,'from '+JSON.stringify(new URL('../admin/puck-model.mjs',import.meta.url).href)).replace(/from (['"])(?:\.\/image-field|\.\.\/home-highlights|\.\.\/cart|\.\.\/catalog)\1/g,'from '+JSON.stringify(mocks));
 const {puckConfig}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const doc=validatePuckData({root:{props:{...puckRoot,showHeader:'non',showFooter:'non'}},content:[{type:'Colonnes',props:{...structuredClone(puckDefaults.Colonnes),id:'columns',children:[{type:'Texte',props:{...structuredClone(puckDefaults.Texte),id:'title',title:'<script>alert(1)</script>',body:'Maison'}},{type:'Bouton',props:{...structuredClone(puckDefaults.Bouton),id:'button',label:'Découvrir',href:'/boutique'}}]}}]});
 const html=renderToStaticMarkup(React.createElement(Render,{config:puckConfig(),data:doc}));assert.match(html,/data-puck-page="true"/);assert.match(html,/class="puck-columns"/);assert.match(html,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/href="\/boutique"/);assert.match(html,/Maison/);
});
