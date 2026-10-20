import { LEGAL_VERSION } from '../site/legal.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {configurePayments,paymentConfig,safeConfig} from '../commerce/stripe.mjs';
import {handlePayments} from '../commerce/payments.mjs';
import {handleAdmin} from '../admin/handler.mjs';
const origin='https://auparraingenereux.fr';
const key='sk_test_'+'a'.repeat(32),whsec='whsec_unit_test_signature';
function bindings(){const db=new DatabaseSync(':memory:');for(const entry of JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url))).entries)db.exec(readFileSync(new URL('../drizzle/'+entry.tag+'.sql',import.meta.url),'utf8'));
 function statement(sql,args=[]){return {bind(...values){return statement(sql,values);},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},execute(){const result=db.prepare(sql).run(...args);return {success:true,meta:{changes:result.changes}};}};}
 return {DB:{prepare:sql=>statement(sql),async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>s.execute());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}},BUCKET:{},ADMIN_USER_IDS:'owner',PAYMENT_CONFIG_ENCRYPTION_KEY:'ab'.repeat(32),db};}
function provider(){const sessions=new Map(),calls=[],idempotent=new Map();let count=0;return {sessions,calls,client:{accounts:{retrieve:async()=>({id:'acct_apg',charges_enabled:true})},webhookEndpoints:{create:async()=>({id:'we_apg',secret:whsec})},checkout:{sessions:{create:async(params,options)=>{calls.push(params);if('payment_method_types' in params)throw {type:'StripeInvalidRequestError',param:'payment_method_types'};if(params.expires_at<Math.floor(Date.now()/1000)+1800)throw {type:'StripeInvalidRequestError',param:'expires_at'};if(idempotent.has(options.idempotencyKey))return idempotent.get(options.idempotencyKey);const subtotal=params.line_items.reduce((sum,line)=>sum+line.quantity*line.price_data.unit_amount,0);const session={id:'cs_test_abcdefghijklmnop'+(++count),url:'https://checkout.stripe.com/c/pay/test',metadata:params.metadata,amount_subtotal:subtotal,amount_total:subtotal+(params.shipping_options?.[0].shipping_rate_data.fixed_amount.amount||0),currency:'eur',mode:'payment',livemode:false,status:'open',payment_status:'unpaid',payment_intent:'pi_apg_'+count,customer_details:{name:'Client Test',email:'client@example.test'}};sessions.set(session.id,session);idempotent.set(options.idempotencyKey,session);return session;},expire:async id=>{const session=sessions.get(id);if(session.status!=='open')throw Error('Not open');session.status='expired';return session;},retrieve:async id=>{if(!sessions.has(id))throw Error('Unknown session');return sessions.get(id);}}}}};}
async function setup({stock=5,shipping=null,countries=[]}={}){const env=bindings(),stripe=provider();await configurePayments({secret:key,enabled:true,shipping_cents:shipping,countries,version:0},env,'owner',()=>stripe.client);env.db.prepare('INSERT INTO products(id,name,description,price_cents,stock,published) VALUES (?,?,?,?,?,?)').run('coffret','Coffret maison','Maison',2500,stock,1);return {env,stripe};}
function checkout(env,stripe,{id=crypto.randomUUID(),items=[{id:'coffret',quantity:1,price_cents:1}],delivery='pickup',actor='owner',from=origin}={}){const request=new Request(origin+'/api/paiement/checkout',{method:'POST',headers:{origin:from,'content-type':'application/json',...(actor?{'oai-authenticated-user-id':actor}:{})},body:JSON.stringify({items,delivery,key:id,terms_version:LEGAL_VERSION,terms_accepted:true})});return handlePayments(request,env,()=>stripe.client);}
async function webhook(env,stripe,session,type='checkout.session.completed',options={}){const raw=JSON.stringify({id:options.id||'evt_'+crypto.randomUUID(),type,livemode:false,data:{object:session}});const timestamp=options.timestamp??Math.floor(Date.now()/1000);const signature=createHmac('sha256',options.secret||whsec).update(timestamp+'.'+raw).digest('hex');return handlePayments(new Request(origin+'/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body:raw}),env,()=>stripe.client);}
function stock(env){return env.db.prepare("SELECT stock FROM products WHERE id='coffret'").get().stock;}
function orders(env){return env.db.prepare('SELECT * FROM orders').all();}

test('Stripe secrets are encrypted, never returned by admin configuration, and setup is protected',async()=>{
 const {env,stripe}=await setup();const stored=env.db.prepare('SELECT * FROM payment_settings').get();assert.ok(!stored.secret.includes(key));assert.ok(!stored.webhook_secret.includes(whsec));assert.equal((await paymentConfig(env)).secret,key);assert.ok(!JSON.stringify(safeConfig(stored)).includes(key));
 const get=await handleAdmin(new Request(origin+'/admin/api/stripe',{headers:{'oai-authenticated-user-id':'owner'}}),env);const data=await get.json();assert.equal(data.configured,true);assert.equal(data.mode,'test');assert.ok(!JSON.stringify(data).includes(key));assert.equal(data.pending,0);
 assert.equal((await handleAdmin(new Request(origin+'/admin/api/stripe'),env)).status,401);assert.equal((await handleAdmin(new Request(origin+'/admin/paiements'),env)).status,302);
 const denied=await handleAdmin(new Request(origin+'/admin/api/stripe',{method:'PUT',headers:{'oai-authenticated-user-id':'owner',origin:'https://evil.example','content-type':'application/json'},body:'{}'}),env);assert.equal(denied.status,403);
 await assert.rejects(()=>configurePayments({secret:key,enabled:true,version:0,shipping_cents:null,countries:[]},env,'owner',()=>stripe.client),e=>e.status===409);
 await assert.rejects(()=>configurePayments({secret:key,enabled:true,version:1,shipping_cents:100,countries:[]},env,'owner',()=>stripe.client),e=>e.status===400);
 const page=await handleAdmin(new Request(origin+'/admin/paiements',{headers:{'oai-authenticated-user-id':'owner'}}),env);const html=await page.text();const {Script}=await import('node:vm');new Script(html.match(/<script[^>]*>([\s\S]*)<\/script>/)[1]);assert.ok(!html.includes(key));env.db.close();
});
test('checkout recomputes prices, reserves stock atomically, retries the same session and shows no unpaid order',async()=>{
 const {env,stripe}=await setup({stock:2});const id=crypto.randomUUID();assert.equal((await checkout(env,stripe,{id})).status,200);assert.equal(stock(env),1);assert.equal(orders(env).length,0);assert.equal(stripe.calls[0].line_items[0].price_data.unit_amount,2500);assert.equal('payment_method_types' in stripe.calls[0],false);assert.match(stripe.calls[0].integration_identifier,/^au-parrain-genereux-[a-z]{8}$/);
 assert.equal((await checkout(env,stripe,{id})).status,200);assert.equal(stock(env),1);assert.equal(stripe.sessions.size,1);
 assert.equal((await checkout(env,stripe,{id,items:[{id:'coffret',quantity:2}]})).status,409);
 assert.equal((await checkout(env,stripe,{items:[{id:'coffret',quantity:2}]})).status,409);assert.equal(stock(env),1);
 const session=[...stripe.sessions.values()][0];const status=await handlePayments(new Request(origin+'/api/paiement/statut?session_id='+session.id),env,()=>stripe.client);assert.equal((await status.json()).state,'pending');assert.equal(orders(env).length,0);env.db.close();
});
test('signed paid webhook creates exactly one confirmed order and never deducts stock twice',async()=>{
 const {env,stripe}=await setup({stock:2});await checkout(env,stripe);const session=[...stripe.sessions.values()][0];session.status='complete';session.payment_status='paid';
 assert.equal((await webhook(env,stripe,session)).status,200);assert.equal((await webhook(env,stripe,session)).status,200);assert.equal(orders(env).length,1);const order=orders(env)[0];assert.equal(order.status,'confirmed');assert.equal(order.payment_status,'paid');assert.equal(order.payment_mode,'test');assert.equal(order.total_cents,2500);assert.equal(order.delivery,'pickup');assert.equal(stock(env),1);
 const cancelled=await handleAdmin(new Request(origin+'/admin/api/orders/'+order.id,{method:'PUT',headers:{'oai-authenticated-user-id':'owner',origin,'content-type':'application/json'},body:JSON.stringify({status:'cancelled',version:order.version})}),env);assert.equal(cancelled.status,409);assert.equal(stock(env),1);
 assert.equal((await webhook(env,stripe,{id:'ch_apg',payment_intent:session.payment_intent,refunded:true,amount:2500,amount_refunded:2500},'charge.refunded')).status,200);assert.equal(stock(env),2);assert.equal(orders(env)[0].payment_status,'refunded');assert.equal(orders(env)[0].status,'cancelled');
 await webhook(env,stripe,{id:'ch_apg',payment_intent:session.payment_intent,refunded:true,amount:2500,amount_refunded:2500},'charge.refunded');await webhook(env,stripe,session);assert.equal(stock(env),2);assert.equal(orders(env).length,1);env.db.close();
});
test('expiration restores stock once, ignores browser claims, and invalid signatures or timestamps cannot create orders',async()=>{
 const {env,stripe}=await setup({stock:1});await checkout(env,stripe);const session=[...stripe.sessions.values()][0];
 assert.equal((await webhook(env,stripe,session)).status,200);assert.equal(stock(env),0);assert.equal(orders(env).length,0);
 session.payment_status='paid';session.status='complete';assert.equal((await webhook(env,stripe,session,'checkout.session.completed',{secret:'wrong'})).status,400);assert.equal((await webhook(env,stripe,session,'checkout.session.completed',{timestamp:Math.floor(Date.now()/1000)-1000})).status,400);assert.equal(orders(env).length,0);
 session.payment_status='unpaid';session.status='expired';await webhook(env,stripe,session,'checkout.session.expired');await webhook(env,stripe,session,'checkout.session.expired');assert.equal(stock(env),1);assert.equal(orders(env).length,0);env.db.close();
});
test('shipping uses configured fees and destination; forged totals or missing addresses cannot confirm an order',async()=>{
 const {env,stripe}=await setup({stock:2,shipping:750,countries:['FR']});assert.equal((await checkout(env,stripe,{delivery:'shipping'})).status,200);const session=[...stripe.sessions.values()][0];assert.equal(session.amount_total,3250);assert.deepEqual(stripe.calls[0].shipping_address_collection.allowed_countries,['FR']);session.payment_status='paid';session.status='complete';
 assert.equal((await webhook(env,stripe,session)).status,409);assert.equal(orders(env).length,0);
 session.shipping_details={name:'Client Test',address:{line1:'1 rue du Test',postal_code:'76600',city:'Le Havre',country:'FR'}};session.amount_total=1;assert.equal((await webhook(env,stripe,session)).status,409);assert.equal(orders(env).length,0);
 session.amount_total=3250;assert.equal((await webhook(env,stripe,session)).status,200);assert.equal(orders(env)[0].shipping_cents,750);assert.equal(JSON.parse(orders(env)[0].shipping_address).address.country,'FR');assert.equal(stock(env),1);env.db.close();
});
test('public checkout works while unconfigured shipping, foreign requests and disabled payment fail closed',async()=>{
 const {env,stripe}=await setup();assert.equal((await checkout(env,stripe,{delivery:'shipping'})).status,409);assert.equal((await checkout(env,stripe,{from:'https://evil.example'})).status,403);assert.equal((await checkout(env,stripe,{actor:null})).status,200);
 const config=await handlePayments(new Request(origin+'/api/paiement/config'),env,()=>stripe.client);assert.equal((await config.json()).enabled,true);assert.equal(orders(env).length,0);assert.equal(stock(env),4);
 env.db.exec('UPDATE payment_settings SET enabled=0');assert.equal((await checkout(env,stripe)).status,503);assert.equal((await handlePayments(new Request(origin+'/api/paiement/checkout'),env,()=>stripe.client)).status,405);env.db.close();
});
test('a full refund arriving before the paid event releases the hold and preserves a refunded order',async()=>{
 const {env,stripe}=await setup({stock:1});await checkout(env,stripe);const session=[...stripe.sessions.values()][0];session.status='complete';session.payment_status='paid';
 await webhook(env,stripe,{id:'ch_apg',payment_intent:session.payment_intent,refunded:true,amount:2500,amount_refunded:2500},'charge.refunded');await webhook(env,stripe,session);assert.equal(stock(env),1);assert.equal(orders(env)[0].payment_status,'refunded');assert.equal(orders(env)[0].status,'cancelled');await webhook(env,stripe,session);assert.equal(stock(env),1);env.db.close();
});

test('returning from Stripe expires its session before releasing stock, even if new payments were disabled',async()=>{
 const {env,stripe}=await setup({stock:1});const id=crypto.randomUUID();await checkout(env,stripe,{id});assert.equal(stock(env),0);env.db.exec('UPDATE payment_settings SET enabled=0');
 const cancel=()=>handlePayments(new Request(origin+'/api/paiement/annuler',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-id':'owner'},body:JSON.stringify({key:id})}),env,()=>stripe.client);
 const response=await cancel();assert.equal(response.status,200);assert.equal((await response.json()).state,'cancelled');assert.equal([...stripe.sessions.values()][0].status,'expired');assert.equal(stock(env),1);await cancel();assert.equal(stock(env),1);assert.equal(orders(env).length,0);env.db.close();
});
test('concurrent checkout attempts cannot oversell a single piece',async()=>{
 const {env,stripe}=await setup({stock:1});const responses=await Promise.all([checkout(env,stripe),checkout(env,stripe)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(stock(env),0);assert.equal(stripe.sessions.size,1);env.db.close();
});

test('uncertain network creation keeps the reservation and retry uses the same attempt, while definitive errors release it',async()=>{
 const {env,stripe}=await setup({stock:1});const original=stripe.client.checkout.sessions.create;let fail=true;stripe.client.checkout.sessions.create=async(...args)=>{if(fail){fail=false;throw {type:'StripeConnectionError'};}return original(...args);};const id=crypto.randomUUID();
 assert.equal((await checkout(env,stripe,{id})).status,503);assert.equal(stock(env),0);assert.equal(orders(env).length,0);assert.equal((await checkout(env,stripe,{id})).status,200);assert.equal(stock(env),0);assert.equal(stripe.sessions.size,1);env.db.close();
 const second=await setup({stock:1});second.stripe.client.checkout.sessions.create=async()=>{throw {type:'StripeInvalidRequestError'};};assert.equal((await checkout(second.env,second.stripe)).status,503);assert.equal(stock(second.env),1);assert.equal(orders(second.env).length,0);second.env.db.close();
});
test('a refund after the order is ready does not put shipped or collected goods back in stock',async()=>{
 const {env,stripe}=await setup({stock:1});await checkout(env,stripe);const session=[...stripe.sessions.values()][0];session.status='complete';session.payment_status='paid';await webhook(env,stripe,session);env.db.exec("UPDATE orders SET status='ready'");
 await webhook(env,stripe,{id:'ch_apg',payment_intent:session.payment_intent,refunded:true,amount:2500,amount_refunded:2500},'charge.refunded');assert.equal(stock(env),0);assert.equal(orders(env)[0].status,'ready');assert.equal(orders(env)[0].payment_status,'refunded');env.db.close();
});

test('retry after confirmed payment returns the existing receipt without creating a new checkout',async()=>{
 const {env,stripe}=await setup({stock:1});const id=crypto.randomUUID();await checkout(env,stripe,{id});const session=[...stripe.sessions.values()][0];session.status='complete';session.payment_status='paid';await webhook(env,stripe,session);const retried=await checkout(env,stripe,{id});assert.equal(retried.status,200);assert.deepEqual(await retried.json(),{state:'paid',session_id:session.id});assert.equal(orders(env).length,1);assert.equal(stock(env),0);assert.equal(stripe.sessions.size,1);env.db.close();
});

test('failed legacy attempts request a fresh checkout key and retry without retaining duplicate stock holds',async()=>{
 const {env,stripe}=await setup({stock:1});const create=stripe.client.checkout.sessions.create;let reject=true;stripe.client.checkout.sessions.create=async(...args)=>{if(reject){reject=false;throw {type:'StripeInvalidRequestError',param:'payment_method_types'};}return create(...args);};
 const key=crypto.randomUUID();const first=await checkout(env,stripe,{id:key});assert.equal(first.status,503);assert.equal((await first.json()).retry_checkout,true);assert.equal(stock(env),1);
 const stale=await checkout(env,stripe,{id:key});assert.equal(stale.status,409);assert.equal((await stale.json()).retry_checkout,true);
 const retry=await checkout(env,stripe);assert.equal(retry.status,200);assert.equal(stock(env),0);assert.equal(stripe.sessions.size,1);env.db.close();
});
test('the Stripe creation deadline retains a margin beyond the minimum even after transport delay',async t=>{
 const {env,stripe}=await setup();const create=stripe.client.checkout.sessions.create;const now=Date.now.bind(Date);stripe.client.checkout.sessions.create=async(...args)=>{t.mock.method(Date,'now',()=>now()+10000);return create(...args);};
 const result=await checkout(env,stripe);assert.equal(result.status,200);const params=stripe.calls[0];assert.ok(params.expires_at>=Math.floor(Date.now()/1000)+1800);assert.equal('payment_method_types' in params,false);env.db.close();
});

// The shared delivery policy must agree with the amount actually charged by Stripe.
import {defaultShipping,shippingPrice,saveShipping,estimateDeliveryCost,validateShipping} from '../commerce/shipping.mjs';
test('delivery thresholds are inclusive and cost assumptions remain private',async()=>{
 for(const [subtotal,fee] of [[0,890],[3999,890],[4000,450],[7999,450],[8000,0],[8001,0]])assert.equal(shippingPrice(subtotal,defaultShipping),fee);
 assert.equal(shippingPrice(4000,{...defaultShipping,enabled:false}),null);assert.equal(shippingPrice(4000,null,750),750);
 assert.throws(()=>validateShipping({...defaultShipping,free_from_cents:4000}));assert.throws(()=>validateShipping({...defaultShipping,base_cents:8.9}));assert.throws(()=>validateShipping({...defaultShipping,countries:['BE']}));
 const {env,stripe}=await setup();await saveShipping(env.DB,{version:0,settings:defaultShipping},'owner');
 const config=await handlePayments(new Request(origin+'/api/paiement/config',{headers:{'oai-authenticated-user-id':'owner'}}),env,()=>stripe.client);const publicConfig=await config.json();assert.equal(publicConfig.shipping_policy.free_from_cents,8000);assert.equal('costs' in publicConfig.shipping_policy,false);
 assert.equal((await handleAdmin(new Request(origin+'/admin/api/shipping'),env)).status,401);
 assert.equal((await handleAdmin(new Request(origin+'/admin/api/shipping',{method:'PUT',headers:{origin:'https://evil.example','oai-authenticated-user-id':'owner','content-type':'application/json'},body:'{}'}),env)).status,403);
 await assert.rejects(()=>saveShipping(env.DB,{version:0,settings:defaultShipping},'owner'),e=>e.status===409);
 assert.equal(estimateDeliveryCost(8000,defaultShipping).total_cost_cents,1209);
 assert.equal(estimateDeliveryCost(8000,{...defaultShipping,costs:{...defaultShipping.costs,discount_percent:15}}).total_cost_cents,1065);
 assert.equal(estimateDeliveryCost(8000,{...defaultShipping,costs:{...defaultShipping.costs,weight_g:2000}}).total_cost_cents,1369);env.db.close();
});
test('Stripe charges the server subtotal tier, including free delivery with an address',async()=>{
 for(const [subtotal,fee] of [[3999,890],[4000,450],[7999,450],[8000,0]]){
  const {env,stripe}=await setup();await saveShipping(env.DB,{version:0,settings:defaultShipping},'owner');env.db.prepare("UPDATE products SET price_cents=? WHERE id='coffret'").run(subtotal);
  assert.equal((await checkout(env,stripe,{delivery:'shipping'})).status,200);assert.equal(stripe.calls[0].shipping_options[0].shipping_rate_data.fixed_amount.amount,fee);assert.deepEqual(stripe.calls[0].shipping_address_collection.allowed_countries,['FR']);
  const session=[...stripe.sessions.values()][0];session.status='complete';session.payment_status='paid';session.shipping_details={name:'Client',address:{line1:'1 rue Test',postal_code:'76600',city:'Le Havre',country:'FR'}};
  assert.equal((await webhook(env,stripe,session)).status,200);assert.equal(orders(env)[0].shipping_cents,fee);assert.equal(orders(env)[0].total_cents,subtotal+fee);env.db.close();
 }
});
test('changing delivery settings preserves the amount of an existing checkout and pickup stays free',async()=>{
 const {env,stripe}=await setup();await saveShipping(env.DB,{version:0,settings:defaultShipping},'owner');const id=crypto.randomUUID();await checkout(env,stripe,{id,delivery:'shipping'});
 await saveShipping(env.DB,{version:1,settings:{...defaultShipping,base_cents:1090}},'owner');assert.equal((await checkout(env,stripe,{id,delivery:'shipping'})).status,200);assert.equal(stripe.sessions.size,1);
 const session=[...stripe.sessions.values()][0];assert.equal(session.amount_total,3390);session.status='complete';session.payment_status='paid';session.shipping_details={name:'Client',address:{line1:'1 rue Test',postal_code:'76600',city:'Le Havre',country:'FR'}};assert.equal((await webhook(env,stripe,session)).status,200);assert.equal(orders(env)[0].shipping_cents,890);
 await saveShipping(env.DB,{version:2,settings:{...defaultShipping,enabled:false}},'owner');assert.equal((await checkout(env,stripe,{delivery:'shipping'})).status,409);assert.equal((await checkout(env,stripe)).status,200);assert.equal(stripe.calls.at(-1).shipping_options,undefined);env.db.close();
});
test('shipping migration preserves encrypted Stripe settings and existing policy',async()=>{
 const {env}=await setup({shipping:750,countries:['FR']});const before=env.db.prepare('SELECT * FROM payment_settings').get();const sql=readFileSync(new URL('../drizzle/0029_tiered_shipping.sql',import.meta.url),'utf8');env.db.exec(sql);assert.deepEqual(env.db.prepare('SELECT * FROM payment_settings').get(),before);assert.equal(JSON.parse(env.db.prepare("SELECT body FROM site_settings WHERE id='shipping'").get().body).base_cents,890);
 await saveShipping(env.DB,{version:1,settings:{...defaultShipping,base_cents:990}},'owner');env.db.exec(sql);assert.equal(JSON.parse(env.db.prepare("SELECT body FROM site_settings WHERE id='shipping'").get().body).base_cents,990);env.db.close();
});


test('new checkout requires explicit acceptance and stores the version without touching legacy retries',async()=>{
 const {env,stripe}=await setup();const id=crypto.randomUUID();const raw=terms=>handlePayments(new Request(origin+'/api/paiement/checkout',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-id':'owner'},body:JSON.stringify({key:id,items:[{id:'coffret',quantity:1}],delivery:'pickup',...terms})}),env,()=>stripe.client);
 assert.equal((await raw({})).status,400);assert.equal(stock(env),5);assert.equal(stripe.calls.length,0);assert.equal((await raw({terms_version:'obsolete',terms_accepted:true})).status,400);
 assert.equal((await raw({terms_version:LEGAL_VERSION,terms_accepted:true})).status,200);const attempt=env.db.prepare('SELECT terms_version,terms_accepted_at FROM checkout_attempts WHERE id=?').get(id);assert.equal(attempt.terms_version,LEGAL_VERSION);assert.ok(attempt.terms_accepted_at);
 assert.equal((await raw({})).status,200);assert.equal(stripe.sessions.size,1);env.db.close();
});

test('first production account may differ from the sandbox without changing test orders or stock',async()=>{
 const {env,stripe}=await setup();await checkout(env,stripe);const session=[...stripe.sessions.values()][0];session.payment_status='paid';session.status='complete';await webhook(env,stripe,session);
 const before=orders(env),available=stock(env),liveKey='rk_live_'+'b'.repeat(32);let endpoints=0;
 const client={accounts:{retrieve:async()=>({id:'acct_live_apg',charges_enabled:true})},webhookEndpoints:{create:async()=>{endpoints++;return {id:'we_live_apg',secret:'whsec_live_fixture'};}}};
 const result=await configurePayments({secret:liveKey,enabled:true,shipping_cents:null,countries:[],version:1},env,'owner',()=>client);assert.equal(result.mode,'live');assert.equal(endpoints,1);const config=await paymentConfig(env);assert.equal(config.account_id,'acct_live_apg');assert.equal(config.secret,liveKey);assert.equal(config.webhook_secret,'whsec_live_fixture');assert.deepEqual(orders(env),before);assert.equal(stock(env),available);assert.equal(env.db.prepare('SELECT secret FROM payment_settings').get().secret.includes(liveKey),false);env.db.close();
});
test('first production switch refuses pending sessions, previous live payments and an unverified account',async()=>{
 const input={secret:'rk_live_'+'c'.repeat(32),enabled:true,shipping_cents:null,countries:[],version:1};
 for(const reason of ['pending','live-history','unverified']){const {env,stripe}=await setup();if(reason==='pending')await checkout(env,stripe);if(reason==='live-history')env.db.exec("INSERT INTO orders(id,customer,contact,items,total_cents,payment_mode,created_at) VALUES ('old-live','Client','contact','[]',0,'live','2026-10-20')");let created=0;const client={accounts:{retrieve:async()=>({id:'acct_live_apg',charges_enabled:reason!=='unverified'})},webhookEndpoints:{create:async()=>{created++;return {id:'we_live_apg',secret:whsec};}}};await assert.rejects(()=>configurePayments(input,env,'owner',()=>client),e=>e.status===(reason==='unverified'?400:409));assert.equal(created,0);assert.equal((await paymentConfig(env)).mode,'test');env.db.close();}
});
test('a concurrent live payment blocks the account replacement transaction',async()=>{
 const {env}=await setup();const client={accounts:{retrieve:async()=>({id:'acct_live_apg',charges_enabled:true})},webhookEndpoints:{create:async()=>{env.db.exec("INSERT INTO orders(id,customer,contact,items,total_cents,payment_mode,created_at) VALUES ('concurrent-live','Client','contact','[]',0,'live','2026-10-20')");return {id:'we_live_apg',secret:whsec};}}};await assert.rejects(()=>configurePayments({secret:'rk_live_'+'d'.repeat(32),enabled:true,shipping_cents:null,countries:[],version:1},env,'owner',()=>client),e=>e.status===409);assert.equal((await paymentConfig(env)).account_id,'acct_apg');env.db.close();
});
test('switching to another test account or replacing an active production account remains blocked',async()=>{
 const {env,stripe}=await setup();const other={accounts:{retrieve:async()=>({id:'acct_other',charges_enabled:true})}};const settings={enabled:true,shipping_cents:null,countries:[],version:1};await assert.rejects(()=>configurePayments({...settings,secret:key},env,'owner',()=>other),e=>e.status===409);
 await configurePayments({...settings,secret:'rk_live_'+'e'.repeat(32)},env,'owner',()=>stripe.client);await assert.rejects(()=>configurePayments({...settings,version:2,secret:'rk_live_'+'f'.repeat(32)},env,'owner',()=>other),e=>e.status===409);assert.equal((await paymentConfig(env)).account_id,'acct_apg');env.db.close();
});
