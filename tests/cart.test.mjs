import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { normalizeCart, quoteCart } from '../commerce/cart.mjs';
import { handleCommerce } from '../commerce/handler.mjs';
const origin='https://maison.example';
const bonbon={id:'bonbon',name:'Bonbon',published:1,stock:1000,price_cents:10600};
test('cart restoration rejects invalid lines, merges repeats and stores quantities only',()=>{
 assert.deepEqual(normalizeCart([{id:'bonbon',quantity:250,price_cents:1},{id:'bonbon',quantity:250},{id:'bonbon-1',quantity:1},{id:'x',quantity:-2},{id:'x',quantity:1.5},null]),[{id:'bonbon',quantity:500}]);
 for(const bad of [null,{},'oops'])assert.deepEqual(normalizeCart(bad),[]);
 assert.equal(normalizeCart(Array.from({length:51},(_,i)=>({id:`p${i}`,quantity:1}))).length,50);
});
test('server quotes exact gram prices, piece prices, changed prices and availability',()=>{
 let result=quoteCart([{id:'bonbon',quantity:250},{id:'box',quantity:2}],[bonbon,{id:'box',name:'Coffret',published:1,stock:2,price_cents:900}]);
 assert.equal(result.total_cents,4450);assert.equal(result.valid,true);
 assert.equal(quoteCart([{id:'bonbon',quantity:1}],[bonbon]).total_cents,11);
 assert.equal(quoteCart([{id:'bonbon',quantity:250}],[{...bonbon,price_cents:12000}]).total_cents,3000);
 for(const product of [{...bonbon,published:0},{...bonbon,stock:249},{...bonbon,price_cents:0}])assert.equal(quoteCart([{id:'bonbon',quantity:250}],[product]).valid,false);
 assert.equal(quoteCart([{id:'deleted',quantity:1}],[]).valid,false);
 assert.equal(quoteCart([],[]).valid,false);
});
test('public quote endpoint reads live SQLite prices without reserving stock or creating orders',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE products(id TEXT,name TEXT,price_cents INTEGER,stock INTEGER,published INTEGER)');
 db.prepare('INSERT INTO products VALUES(?,?,?,?,?)').run('bonbon','Bonbon',10600,1000,1);
 function statement(sql,args=[]){return {bind(...values){return statement(sql,values);},async all(){return {results:db.prepare(sql).all(...args)};}};}
 const env={DB:{prepare:sql=>statement(sql)}};
 const request=items=>new Request(origin+'/api/panier',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({items})});
 const response=await handleCommerce(request([{id:'bonbon',quantity:250,price_cents:1}]),env);
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).total_cents,2650);
 assert.equal(db.prepare('SELECT stock FROM products').get().stock,1000);
 db.exec('UPDATE products SET stock=0');assert.equal((await (await handleCommerce(request([{id:'bonbon',quantity:250}]),env)).json()).valid,false);
 assert.equal((await handleCommerce(request([{id:'bonbon-1',quantity:1}]),env)).status,400);
 assert.equal((await handleCommerce(request([{id:'bonbon',quantity:0}]),env)).status,400);
 assert.equal((await handleCommerce(request([{id:'bonbon',quantity:250},{id:'bonbon',quantity:250}]),env)).status,400);
 db.close();
});
test('quote endpoint rejects foreign origins, malformed/oversized input and unsupported methods',async()=>{
 assert.equal(await handleCommerce(new Request(origin+'/'),{}),null);
 assert.equal((await handleCommerce(new Request(origin+'/api/panier'),{})).status,405);
 assert.equal((await handleCommerce(new Request(origin+'/api/panier',{method:'POST',body:'{}'}),{})).status,403);
 for(const [body,status] of [['{',400],[JSON.stringify({items:null}),400],[' '.repeat(12001),413]])assert.equal((await handleCommerce(new Request(origin+'/api/panier',{method:'POST',headers:{origin},body}),{})).status,status);
 assert.equal((await handleCommerce(new Request(origin+'/api/panier',{method:'POST',headers:{origin},body:JSON.stringify({items:[]})}),{})).status,503);
});
