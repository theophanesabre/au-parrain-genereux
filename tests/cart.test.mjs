import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { normalizeCart, quoteCart } from '../commerce/cart.mjs';
import { handleCommerce } from '../commerce/handler.mjs';
const origin='https://maison.example';
const box={id:'boite-maison',name:'Boîte maison',published:1,stock:10,price_cents:2600};
test('cart restoration rejects invalid lines, merges repeats and stores quantities only',()=>{
 assert.deepEqual(normalizeCart([{id:'boite-maison',quantity:1,price_cents:1},{id:'boite-maison',quantity:2},{id:'bonbon',quantity:250},{id:'bonbon-1',quantity:1},{id:'x',quantity:-2},{id:'x',quantity:1.5},null]),[{id:'boite-maison',quantity:3}]);
 for(const bad of [null,{},'oops'])assert.deepEqual(normalizeCart(bad),[]);
 assert.equal(normalizeCart(Array.from({length:51},(_,i)=>({id:`p${i}`,quantity:1}))).length,50);
});
test('server quotes independent house article prices and rejects retired weight sales',()=>{
 const result=quoteCart([{id:box.id,quantity:2},{id:'coffret',quantity:1}],[box,{id:'coffret',name:'Coffret',published:1,stock:2,price_cents:4200}]);assert.equal(result.total_cents,9400);assert.equal(result.valid,true);
 assert.equal(quoteCart([{id:box.id,quantity:2}],[{...box,price_cents:2800}]).total_cents,5600);
 for(const product of [{...box,published:0},{...box,stock:1},{...box,price_cents:0}])assert.equal(quoteCart([{id:box.id,quantity:2}],[product]).valid,false);
 assert.deepEqual(normalizeCart([{id:'bonbon',quantity:250}]),[]);assert.equal(quoteCart([{id:'bonbon',quantity:250}],[{...box,id:'bonbon'}]).valid,false);
 assert.equal(quoteCart([{id:'deleted',quantity:1}],[]).valid,false);assert.equal(quoteCart([],[]).valid,false);
});
test('public quote endpoint reads live SQLite prices without reserving stock or creating orders',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE products(id TEXT,name TEXT,price_cents INTEGER,stock INTEGER,published INTEGER)');
 db.prepare('INSERT INTO products VALUES(?,?,?,?,?)').run('boite-maison','Boîte maison',2600,10,1);
 function statement(sql,args=[]){return {bind(...values){return statement(sql,values);},async all(){return {results:db.prepare(sql).all(...args)};}};}
 const env={DB:{prepare:sql=>statement(sql)}};
 const request=items=>new Request(origin+'/api/panier',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({items})});
 const response=await handleCommerce(request([{id:'boite-maison',quantity:2,price_cents:1}]),env);
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).total_cents,5200);
 assert.equal(db.prepare('SELECT stock FROM products').get().stock,10);
 db.exec('UPDATE products SET stock=0');assert.equal((await (await handleCommerce(request([{id:'boite-maison',quantity:2}]),env)).json()).valid,false);
 assert.equal((await handleCommerce(request([{id:'bonbon',quantity:250}]),env)).status,400);
 assert.equal((await handleCommerce(request([{id:'bonbon-1',quantity:1}]),env)).status,400);
 assert.equal((await handleCommerce(request([{id:'boite-maison',quantity:0}]),env)).status,400);
 assert.equal((await handleCommerce(request([{id:'boite-maison',quantity:2},{id:'boite-maison',quantity:2}]),env)).status,400);
 db.close();
});
test('quote endpoint rejects foreign origins, malformed/oversized input and unsupported methods',async()=>{
 assert.equal(await handleCommerce(new Request(origin+'/'),{}),null);
 assert.equal((await handleCommerce(new Request(origin+'/api/panier'),{})).status,405);
 assert.equal((await handleCommerce(new Request(origin+'/api/panier',{method:'POST',body:'{}'}),{})).status,403);
 for(const [body,status] of [['{',400],[JSON.stringify({items:null}),400],[' '.repeat(12001),413]])assert.equal((await handleCommerce(new Request(origin+'/api/panier',{method:'POST',headers:{origin},body}),{})).status,status);
 assert.equal((await handleCommerce(new Request(origin+'/api/panier',{method:'POST',headers:{origin},body:JSON.stringify({items:[]})}),{})).status,503);
});
