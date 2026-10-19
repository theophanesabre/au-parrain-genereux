import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Worker} from 'node:worker_threads';
import {handleAdmin} from '../admin/handler.mjs';
import {quantity} from '../admin/inventory/service.mjs';
import {inventoryHTML} from '../admin/inventory/ui.mjs';
const origin='https://apg.example';
function setup(path=':memory:'){
 const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA foreign_keys=ON');
 for(const entry of JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url))).entries)sqlite.exec(readFileSync(new URL('../drizzle/'+entry.tag+'.sql',import.meta.url),'utf8'));
 function statement(sql,values=[]){return {bind(...args){return statement(sql,args);},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},execute(){const result=sqlite.prepare(sql).run(...values);return {meta:{changes:result.changes},success:true};}};}
 const DB={prepare:sql=>statement(sql),async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.execute());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 return {DB,sqlite,ADMIN_USER_IDS:'owner',BUCKET:{}};
}
async function call(env,path,method='GET',body,actor='owner',from=origin){return handleAdmin(new Request(origin+'/admin/api/inventory'+path,{method,headers:{...(actor?{'oai-authenticated-user-id':actor}:{}),origin:from,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);}
async function good(response,status=200){const r=await response,data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
const create=(env,name='Noisettes',category='raw',unit='kg')=>good(call(env,'/references','POST',{name,category,unit,threshold:'1'}),201);
const move=(ref,kind,amount,extra={})=>({request_key:crypto.randomUUID(),reference_id:ref.id,kind,quantity:amount,occurred_on:'2026-10-19',...extra});
test('exact decimal validation rejects zero, negatives, invalid and non-integral packages',()=>{
 assert.equal(quantity('10','kg'),10000);assert.equal(quantity('0,125','kg'),125);assert.equal(quantity('1.001','g'),1001);
 for(const x of ['0','-1','NaN','Infinity','1e3','1.0001','1 000','','0x10'])assert.throws(()=>quantity(x,'kg'));
 assert.throws(()=>quantity(5,'kg'));assert.throws(()=>quantity('0.5','sac'));assert.equal(quantity('0','kg',{zero:true}),0);
});
test('four declared operations are independent of recipes, sales and e-commerce inventory',async()=>{
 const env=setup(),before=env.sqlite.prepare('SELECT * FROM products ORDER BY id').all();const raw=await create(env),finished=await create(env,'Pralinés','finished');
 const receipt=await good(call(env,'/movements','POST',move(raw,'raw_in','10',{lot_code:'N-01',supplier:'Fournisseur'})),201);assert.equal(receipt.movement.after_quantity,'10');
 assert.equal((await good(call(env,'/movements','POST',move(raw,'raw_out','10',{lot_code:'N-01'})),201)).movement.after_quantity,'0');
 await good(call(env,'/movements','POST',move(finished,'production_in','5',{lot_code:'F-01'})),201);
 assert.equal((await good(call(env,'/movements','POST',move(finished,'production_out','5',{lot_code:'F-01'})),201)).movement.after_quantity,'0');
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM sp_movements').get().n,4);
 assert.equal((await good(call(env,'/lots?reference='+raw.id))).items[0].supplier,'Fournisseur');
 assert.equal((await good(call(env,'/lots?reference='+raw.id))).items[0].declared_quantity,'0');
 assert.deepEqual(env.sqlite.prepare('SELECT * FROM products ORDER BY id').all(),before);assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
 const prod=await good(call(env,'/production'));assert.equal(prod.items[0].produced,'5');assert.equal(prod.items[0].taken,'5');assert.equal(prod.items[0].quantity,'0');env.sqlite.close();
});
test('overdraw, wrong category, zero and unknown outbound lot fail without partial writes',async()=>{
 const env=setup(),ref=await create(env);await good(call(env,'/movements','POST',move(ref,'raw_in','2')),201);
 for(const [data,status]of [[move(ref,'raw_out','3'),409],[move(ref,'raw_in','0'),400],[move(ref,'production_in','5'),400],[move(ref,'raw_out','1',{lot_code:'unknown'}),400]])assert.equal((await call(env,'/movements','POST',data)).status,status);
 const failed=await call(env,'/movements','POST',move(ref,'raw_in','1000000000',{lot_code:'must-rollback'}));assert.equal(failed.status,409);assert.equal(env.sqlite.prepare("SELECT COUNT(*) n FROM sp_lots WHERE code='must-rollback'").get().n,0);assert.equal(env.sqlite.prepare('SELECT quantity FROM sp_balances WHERE reference_id=?').get(ref.id).quantity,2000);env.sqlite.close();
});
test('double validation is idempotent, changed payload or actor cannot reuse a key',async()=>{
 const env=setup(),ref=await create(env),payload=move(ref,'raw_in','10');const a=await good(call(env,'/movements','POST',payload),201),b=await good(call(env,'/movements','POST',payload),201);assert.equal(a.movement.id,b.movement.id);assert.equal(b.replayed,true);
 assert.equal((await call(env,'/movements','POST',{...payload,quantity:'11'})).status,409);
 await good(call(env,'/users','PUT',{user_id:'lab',name:'Laboratoire',role:'laboratory'}));assert.equal((await call(env,'/movements','POST',payload,'lab')).status,409);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM sp_movements').get().n,1);env.sqlite.close();
});
test('server permissions use existing identity, isolate staff and honour revocation and origin',async()=>{
 const env=setup(),raw=await create(env),finished=await create(env,'Pralinés','finished');
 assert.equal((await call(env,'/references','GET',undefined,null)).status,401);assert.equal((await call(env,'/references','GET',undefined,'visitor')).status,403);
 for(const [id,role]of [['lab','laboratory'],['shop','shop']])await good(call(env,'/users','PUT',{user_id:id,name:id,role}));
 await good(call(env,'/movements','POST',move(raw,'raw_in','10'),'lab'),201);await good(call(env,'/movements','POST',move(finished,'production_in','5'),'lab'),201);
 assert.equal((await call(env,'/movements','POST',move(finished,'production_out','1'),'lab')).status,403);
 assert.equal((await call(env,'/movements','POST',move(raw,'raw_in','1'),'shop')).status,403);
 await good(call(env,'/movements','POST',move(finished,'production_out','1'),'shop'),201);
 const visible=await good(call(env,'/references','GET',undefined,'shop'));assert.equal(visible.items.length,1);assert.equal(visible.items[0].id,finished.id);
 for(const path of ['/users','/export','/movements'])assert.equal((await call(env,path,'GET',undefined,'shop')).status,403);
 assert.equal((await call(env,'/references','POST',{name:'X',category:'raw',unit:'kg'},'lab')).status,403);
 assert.equal((await call(env,'/movements','POST',move(raw,'raw_in','1'),'owner','https://evil.example')).status,403);
 assert.equal((await handleAdmin(new Request(origin+'/admin/api/products',{headers:{'oai-authenticated-user-id':'shop'}}),env)).status,403);
 assert.equal((await handleAdmin(new Request(origin+'/admin/puck',{headers:{'oai-authenticated-user-id':'shop'}}),env)).headers.get('location'),'/admin/stocks');
 await good(call(env,'/users','PUT',{user_id:'shop',name:'shop',role:'shop',active:false,version:1}));assert.equal((await call(env,'/references','GET',undefined,'shop')).status,403);
 // Owner granted by the existing activation table also keeps administrator privileges.
 delete env.ADMIN_USER_IDS;env.sqlite.prepare('INSERT INTO admin_access(slot,user_id,created_at) VALUES(1,?,?)').run('owner',new Date().toISOString());await good(call(env,'/users'));env.sqlite.close();
});
test('compensation preserves original, reverses exactly once, requires admin reason and sufficient balance',async()=>{
 const env=setup(),ref=await create(env),entry=(await good(call(env,'/movements','POST',move(ref,'raw_in','10',{lot_code:'LOT',supplier:'Supplier'})),201)).movement;
 await good(call(env,'/users','PUT',{user_id:'lab',name:'Lab',role:'laboratory'}));const correction={request_key:crypto.randomUUID(),correction_of:entry.id,comment:'Erreur de saisie'};
 assert.equal((await call(env,'/movements','POST',correction,'lab')).status,403);assert.equal((await call(env,'/movements','POST',{...correction,comment:''})).status,400);
 const out=(await good(call(env,'/movements','POST',move(ref,'raw_out','10',{lot_code:'LOT'})),201)).movement;
 assert.equal((await call(env,'/movements','POST',correction)).status,409);
 await good(call(env,'/movements','POST',{request_key:crypto.randomUUID(),correction_of:out.id,comment:'Annulation prélèvement'}),201);
 const reverse=await good(call(env,'/movements','POST',correction),201);assert.equal(reverse.movement.after_quantity,'0');assert.equal(reverse.movement.lot_code,'LOT');assert.equal(reverse.movement.correction_of,entry.id);
 assert.equal((await call(env,'/movements','POST',{...correction,request_key:crypto.randomUUID()})).status,409);
 for(const sql of ['DELETE FROM sp_movements','UPDATE sp_movements SET quantity=1','UPDATE sp_balances SET quantity=9000','DELETE FROM sp_references','DELETE FROM sp_lots'])assert.throws(()=>env.sqlite.exec(sql));
 const history=await good(call(env,'/movements'));assert.equal(history.items.find(m=>m.id===entry.id).corrected_by,reverse.movement.id);env.sqlite.close();
});
test('references support search, alert thresholds, optimistic edits and archival without erasure',async()=>{
 const env=setup(),ref=await create(env);let res=await good(call(env,'/references/'+ref.id,'PUT',{name:'Noisettes du Piémont',category:'raw',unit:'kg',threshold:'2,5',version:1}));assert.equal(res.threshold,'2.5');
 assert.equal((await call(env,'/references/'+ref.id,'PUT',{...res,version:1})).status,409);
 const movement=await good(call(env,'/movements','POST',move(ref,'raw_in','2')),201);assert.equal((await good(call(env,'/dashboard'))).low[0].id,ref.id);
 assert.equal((await call(env,'/references/'+ref.id,'PUT',{...res,unit:'g',version:2})).status,409);
 await good(call(env,'/references/'+ref.id,'PUT',{...res,archived:true,version:2}));assert.equal((await good(call(env,'/references'))).total,0);assert.equal((await good(call(env,'/references?archived=1&q=Piémont'))).total,1);
 assert.equal((await call(env,'/movements','POST',move(ref,'raw_in','1'))).status,409);
 await good(call(env,'/movements','POST',{request_key:crypto.randomUUID(),correction_of:movement.movement.id,comment:'Inventaire erroné'}),201);env.sqlite.close();
});
test('CSV and history filters preserve trace data and neutralise spreadsheet formulas',async()=>{
 const env=setup(),ref=await create(env,'=Danger');await good(call(env,'/movements','POST',move(ref,'raw_in','1.125',{lot_code:'L-1',supplier:'Supplier',comment:'=1+1'})),201);
 const result=await good(call(env,'/movements?from=2026-01-01&to=2099-01-01&category=raw&kind=raw_in&actor=owner&q=Danger'));assert.equal(result.total,1);assert.equal(result.items[0].quantity,'1.125');
 assert.equal((await good(call(env,'/movements?actor=unknown'))).total,0);assert.equal((await call(env,'/movements?from=2026-02-30')).status,400);
 const csv=await (await call(env,'/export')).text();assert.match(csv,/'=Danger/);assert.match(csv,/'=1\+1/);assert.match(csv,/L-1/);assert.match(csv,/Supplier/);assert.match(csv,/1\.125/);env.sqlite.close();
});
test('balances and journal survive connection closure / refresh and migration adds no sample inventory',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'apg-stock-')),path=join(dir,'stock.sqlite'),env=setup(path);assert.equal((await good(call(env,'/references'))).total,0);const ref=await create(env);await good(call(env,'/movements','POST',move(ref,'raw_in','3.125')),201);env.sqlite.close();const db=new DatabaseSync(path);assert.equal(db.prepare('SELECT quantity FROM sp_balances').get().quantity,3125);assert.equal(db.prepare('SELECT COUNT(*) n FROM sp_movements').get().n,1);db.close();rmSync(dir,{recursive:true});
});
test('two real concurrent writers cannot overspend a shared balance',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'apg-stock-race-')),path=join(dir,'stock.sqlite'),env=setup(path),ref=await create(env);env.sqlite.exec('PRAGMA journal_mode=WAL');await good(call(env,'/movements','POST',move(ref,'raw_in','10')),201);env.sqlite.close();
 const ready=new Int32Array(new SharedArrayBuffer(4));
 const writer=()=>new Promise((resolve,reject)=>{const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');const {randomUUID}=require('node:crypto');const db=new DatabaseSync(workerData.path);db.exec('PRAGMA busy_timeout=10000');parentPort.postMessage('ready');Atomics.wait(new Int32Array(workerData.signal),0,0);try{db.exec('BEGIN IMMEDIATE');const id=randomUUID();db.prepare("INSERT INTO sp_movements(id,request_key,payload,reference_id,reference_name,category,unit,kind,direction,quantity,before_quantity,after_quantity,actor,actor_name,actor_role,created_at,occurred_on) SELECT ?,?,'{}',r.id,r.name,r.category,r.unit,'raw_out',-1,7000,b.quantity,b.quantity-7000,?,?, 'admin',?,? FROM sp_references r JOIN sp_balances b ON b.reference_id=r.id WHERE r.id=?").run(id,id,id,id,new Date().toISOString(),'2026-10-19',workerData.ref);db.exec('COMMIT');parentPort.postMessage('success');}catch(e){db.exec('ROLLBACK');parentPort.postMessage('refused');}db.close();`,{eval:true,workerData:{path,ref:ref.id,signal:ready.buffer}});worker.on('message',m=>{if(m==='ready'){if(Atomics.add(ready,0,0)===0){ready.count=(ready.count||0)+1;if(ready.count===2){Atomics.store(ready,0,1);Atomics.notify(ready,0);}}}else resolve(m);});worker.on('error',reject);});
 const outcomes=await Promise.all([writer(),writer()]);assert.deepEqual(outcomes.sort(),['refused','success']);const db=new DatabaseSync(path);assert.equal(db.prepare('SELECT quantity FROM sp_balances').get().quantity,3000);assert.equal(db.prepare('SELECT SUM(direction*quantity) n FROM sp_movements').get().n,3000);db.close();rmSync(dir,{recursive:true});
});
test('tablet surface includes viewport, large targets, restricted CSP and an executable client',async()=>{
 const env=setup();const response=await handleAdmin(new Request(origin+'/admin/stocks',{headers:{'oai-authenticated-user-id':'owner'}}),env);assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'self'/);const html=inventoryHTML('test');assert.match(html,/width=device-width/);assert.match(html,/min-height:52px/);const script=html.match(/<script nonce="test">([\s\S]*)<\/script>/)[1];assert.doesNotThrow(()=>new Function(script));env.sqlite.close();
});
test('empty rollback is possible but cannot erase a used ledger',async()=>{
 const rollback=readFileSync(new URL('../docs/migrations/0033_rollback_empty.sql',import.meta.url),'utf8');
 const empty=setup();empty.sqlite.exec(rollback);assert.equal(empty.sqlite.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='sp_movements'").get().n,0);empty.sqlite.close();
 const used=setup();const ref=await create(used);await good(call(used,'/movements','POST',move(ref,'raw_in','1')),201);assert.throws(()=>used.sqlite.exec(rollback));used.sqlite.exec('ROLLBACK');assert.equal(used.sqlite.prepare('SELECT COUNT(*) n FROM sp_movements').get().n,1);used.sqlite.close();
});
test('database prevents attaching a raced or mismatched supplier to an existing lot',async()=>{
 const env=setup(),ref=await create(env);await good(call(env,'/movements','POST',move(ref,'raw_in','1',{lot_code:'same',supplier:'Supplier A'})),201);
 assert.equal((await call(env,'/movements','POST',move(ref,'raw_in','1',{lot_code:'same',supplier:'Supplier B'}))).status,409);
 const id=crypto.randomUUID(),lot=env.sqlite.prepare('SELECT id FROM sp_lots').get();
 assert.throws(()=>env.sqlite.prepare("INSERT INTO sp_movements(id,request_key,payload,reference_id,reference_name,category,unit,kind,direction,quantity,before_quantity,after_quantity,actor,actor_name,actor_role,created_at,occurred_on,lot_id,lot_code,supplier) VALUES(?,?,'{}',?,'Noisettes','raw','kg','raw_in',1,1000,1000,2000,'owner','owner','admin',?,'2026-10-19',?,'same','Supplier B')").run(id,id,ref.id,new Date().toISOString(),lot.id),/sp invalid lot/);assert.equal(env.sqlite.prepare('SELECT quantity FROM sp_balances').get().quantity,1000);env.sqlite.close();
});
test('sensitive admin routes refuse employees before reading payments or customer data',async()=>{
 const env=setup();for(const role of ['laboratory','shop'])await good(call(env,'/users','PUT',{user_id:role,name:role,role}));
 const prepare=env.DB.prepare,queries=[];env.DB.prepare=sql=>{queries.push(sql);return prepare(sql);};
 const routes=[['/admin/paiements','GET'],['/admin/api/stripe','GET'],['/admin/api/stripe','PUT'],['/admin/api/stripe/reconcile','POST'],['/admin/api/orders','GET'],['/admin/api/audit','GET'],['/admin/api/images','GET'],['/admin/api/appearance','PUT']];
 for(const actor of ['laboratory','shop','visitor'])for(const [path,method]of routes){
 const response=await handleAdmin(new Request(origin+path,{method,headers:{'oai-authenticated-user-id':actor,origin,'content-type':'application/json','x-admin-role':'admin'},...(method==='GET'?{}:{body:JSON.stringify({role:'admin',enabled:true})})}),env);
 assert.equal(response.status,403,actor+' '+path);assert.match(response.headers.get('cache-control'),/no-store/);
 }
 assert.equal(queries.some(sql=>/payment_settings|checkout_attempts|FROM orders|FROM audit|FROM images/i.test(sql)),false);
 assert.equal((await call(env,'/users','PUT',{user_id:'laboratory',name:'Lab',role:'admin',version:1},'laboratory')).status,403);
 assert.equal((await call(env,'/users','PUT',{user_id:'new',name:'Fake admin',role:'admin'})).status,400);
 env.sqlite.prepare("INSERT INTO payment_settings(id,secret,webhook_secret,account_id,endpoint_id,mode,enabled,version,countries) VALUES('stripe','DO_NOT_EXPOSE','WEBHOOK_PRIVATE','acct_apg','we_private','test',0,1,'[]')").run();
 queries.length=0;const config=await handleAdmin(new Request(origin+'/admin/api/stripe',{headers:{'oai-authenticated-user-id':'owner'}}),env);assert.equal(config.status,200);const output=await config.text();assert.ok(!output.includes('DO_NOT_EXPOSE'));assert.ok(!output.includes('WEBHOOK_PRIVATE'));assert.ok(!output.includes('we_private'));assert.ok(queries.every(sql=>!sql.includes('SELECT * FROM payment_settings')));env.sqlite.close();
});
test('D1 trigger-inclusive change counts do not falsely report a conflict after reference creation',async()=>{
 const env=setup(),original=env.DB.batch;env.DB.batch=async statements=>{const rows=await original(statements);if(rows[0].meta.changes===1)rows[0].meta.changes=2;return rows;};
 const ref=await create(env,'Amandes');assert.equal(ref.name,'Amandes');assert.equal(ref.quantity,'0');
 await good(call(env,'/references/'+ref.id,'PUT',{name:ref.name,category:ref.category,unit:ref.unit,threshold:ref.threshold,archived:true,version:ref.version}));assert.equal((await good(call(env,'/references'))).total,0);assert.equal((await good(call(env,'/references?archived=1'))).total,1);
 assert.equal((await call(env,'/references/'+ref.id,'PUT',{name:ref.name,category:ref.category,unit:ref.unit,version:ref.version})).status,409);env.sqlite.close();
});
