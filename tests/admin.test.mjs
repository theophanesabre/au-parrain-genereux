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
function database(){const db=new DatabaseSync(':memory:');for(const p of ['0000_flippant_saracen.sql','0001_order_stock.sql'])db.exec(readFileSync(new URL('../drizzle/'+p,import.meta.url),'utf8'));return db;}
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
 assert.equal((await (await call(env,'products')).json())[0].stock,1);
 assert.equal((await call(env,'orders/'+id,'PUT',{status:'completed',version:2})).status,409);
 assert.equal((await call(env,'orders/'+id,'PUT',{status:'cancelled',version:2})).status,200);
 assert.equal((await (await call(env,'products')).json())[0].stock,3);
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
