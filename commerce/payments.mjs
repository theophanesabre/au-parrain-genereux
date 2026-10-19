import { LEGAL_VERSION } from '../site/legal.mjs';
import { shippingConfiguration, shippingPrice } from './shipping.mjs';
import { buildCheckoutParams } from './stripe-params.ts';
import { normalizeCart,quoteCart } from './cart.mjs';
import { authorize,HttpError } from '../admin/core.mjs';
import { prelaunchEnabled } from '../site/prelaunch.mjs';
import { paymentConfig,stripeClient,verifyStripeEvent,storeOrigin } from './stripe.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export async function isStoreAdmin(request,env){try{authorize(request,env);return true;}catch{const user=request.headers.get('oai-authenticated-user-id');return !!(user&&env.DB&&await env.DB.prepare('SELECT user_id FROM admin_access WHERE slot=1 AND user_id=?').bind(user).first());}}
async function rawBody(request,max=16000){if(Number(request.headers.get('content-length'))>max)throw new HttpError(413,'Requête trop volumineuse');const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Corps requis');const parts=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new HttpError(413,'Requête trop volumineuse');}parts.push(value);}return new TextDecoder().decode(await new Blob(parts).arrayBuffer());}
async function requesterHash(request,env){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.PAYMENT_CONFIG_ENCRYPTION_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(request.headers.get('CF-Connecting-IP')||'unknown'));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export function checkoutParams(attempt,items,countries){return buildCheckoutParams(attempt,items,countries,storeOrigin,prelaunchEnabled);}
async function sessionFor(attempt,stripe){if(attempt.session_id)return stripe.checkout.sessions.retrieve(attempt.session_id,{expand:['payment_intent.latest_charge']});return stripe.checkout.sessions.create(JSON.parse(attempt.params),{idempotencyKey:'apg-checkout-'+attempt.id});}
function intentId(session){return typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id||null;}
export async function fulfillSession(session,env){
 const id=session.metadata?.apg_attempt;if(!id)return false;
 const attempt=await env.DB.prepare('SELECT * FROM checkout_attempts WHERE id=?').bind(id).first();if(!attempt)return false;
 if(attempt.session_id&&attempt.session_id!==session.id)throw new HttpError(409,'Session Stripe incohérente');
 if(session.mode!=='payment'||Boolean(session.livemode)!==(attempt.mode==='live'))throw new HttpError(409,'Mode Stripe incohérent');
 if(session.payment_status!=='paid')return false;
 if(session.currency!=='eur'||session.amount_subtotal!==attempt.total_cents||session.amount_total!==attempt.total_cents+attempt.shipping_cents)throw new HttpError(409,'Montant Stripe incohérent');
 const existingOrder=await env.DB.prepare('SELECT id FROM orders WHERE stripe_session_id=?').bind(session.id).first();if(existingOrder)return true;
 if(!['creating','open','paid'].includes(attempt.status))throw new HttpError(409,'Réservation à réconcilier');
 const customer=session.customer_details||{},shipping=session.collected_information?.shipping_details||session.shipping_details||null;
 if(attempt.delivery==='shipping'&&(!shipping?.address||!JSON.parse(attempt.params).shipping_address_collection.allowed_countries.includes(shipping.address.country)))throw new HttpError(409,'Adresse d’expédition absente ou invalide');
 const paymentIntent=intentId(session);if(!paymentIntent)throw new HttpError(409,'Paiement Stripe non identifié');
 const latestCharge=typeof session.payment_intent==='object'?session.payment_intent?.latest_charge:null;
 const refund=latestCharge&&typeof latestCharge==='object'&&latestCharge.refunded;
 const orderId='web-'+attempt.id,createdAt=new Date().toISOString();
 const statements=[];
 if(refund)statements.push(env.DB.prepare('INSERT OR IGNORE INTO stripe_refunds(payment_intent,created_at) VALUES (?,?)').bind(paymentIntent,createdAt));
 statements.push(env.DB.prepare(`INSERT OR IGNORE INTO orders(id,customer,contact,items,total_cents,status,created_at,payment_status,stripe_session_id,stripe_payment_intent,payment_mode,delivery,shipping_address,shipping_cents)
 SELECT ?,?,?,?,?,CASE WHEN EXISTS(SELECT 1 FROM stripe_refunds WHERE payment_intent=?) THEN 'cancelled' ELSE 'confirmed' END,?,CASE WHEN EXISTS(SELECT 1 FROM stripe_refunds WHERE payment_intent=?) THEN 'refunded' ELSE 'paid' END,?,?,?,?,?,? FROM checkout_attempts WHERE id=? AND status IN ('creating','open')`).bind(orderId,customer.name||shipping?.name||'Client Stripe',customer.email||session.customer_email||customer.phone||'',attempt.items,session.amount_total,paymentIntent,createdAt,paymentIntent,session.id,paymentIntent,attempt.mode,attempt.delivery,shipping?JSON.stringify(shipping):null,attempt.shipping_cents,attempt.id));
 statements.push(env.DB.prepare(`UPDATE checkout_attempts SET status=CASE WHEN EXISTS(SELECT 1 FROM stripe_refunds WHERE payment_intent=?) THEN 'failed' ELSE 'paid' END,session_id=? WHERE id=? AND status IN ('creating','open') AND EXISTS(SELECT 1 FROM orders WHERE stripe_session_id=?)`).bind(paymentIntent,session.id,attempt.id,session.id));
 statements.push(env.DB.prepare("INSERT OR IGNORE INTO audit(id,actor,action,target,created_at) VALUES (?,'stripe','STRIPE_PAYMENT',?,?)").bind('payment-'+session.id,orderId,createdAt));
 await env.DB.batch(statements);return true;
}
async function settleSession(session,env){
 if(session.payment_status==='paid')return fulfillSession(session,env);
 if(session.status==='expired'){await env.DB.batch([env.DB.prepare("UPDATE checkout_attempts SET status='expired',session_id=? WHERE id=? AND status IN ('creating','open') AND (session_id IS NULL OR session_id=?)").bind(session.id,session.metadata?.apg_attempt||'',session.id)]);}
 return false;
}
export async function reconcilePayments(env,config,makeClient=stripeClient){
 const pending=await env.DB.prepare("SELECT * FROM checkout_attempts WHERE status IN ('creating','open') AND expires_at<=? ORDER BY created_at LIMIT 3").bind(Math.floor(Date.now()/1000)).all();const stripe=makeClient(config.secret);let checked=0;
 for(const attempt of pending.results){try{const session=await sessionFor(attempt,stripe);await settleSession(session,env);checked++;}catch{/* Keep uncertain reservations until Stripe confirms their state. */}}
 return {checked,pending:pending.results.length};
}
export async function handlePayments(request,env,makeClient=stripeClient){
 const url=new URL(request.url),path=url.pathname;if(!['/api/paiement/config','/api/paiement/checkout','/api/paiement/annuler','/api/paiement/statut','/api/stripe/webhook'].includes(path))return null;
 try{
  if(!env.DB)throw new HttpError(503,'Paiement temporairement indisponible');
  const config=await paymentConfig(env);
  if(path==='/api/stripe/webhook'){
   if(request.method!=='POST')throw new HttpError(405,'Méthode refusée');if(!config)throw new HttpError(503,'Stripe non configuré');
   const raw=await rawBody(request,1024*1024);let event;try{event=await verifyStripeEvent(raw,request.headers.get('stripe-signature')||'',config.webhook_secret);}catch{throw new HttpError(400,'Signature Stripe invalide');}
   if(Boolean(event.livemode)!==(config.mode==='live'))throw new HttpError(400,'Mode Stripe invalide');
   const object=event.data.object,stripe=makeClient(config.secret);
   if(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type)){
    if(!object.id?.startsWith('cs_'))throw new HttpError(400,'Session invalide');const session=await stripe.checkout.sessions.retrieve(object.id,{expand:['payment_intent.latest_charge']});await settleSession(session,env);if(event.type==='checkout.session.async_payment_failed'&&session.status==='complete'&&session.payment_status==='unpaid')await env.DB.batch([env.DB.prepare("UPDATE checkout_attempts SET status='failed' WHERE session_id=? AND status IN ('creating','open')").bind(session.id)]);
   }
   if(event.type==='charge.refunded'&&object.refunded&&object.amount_refunded===object.amount){
    const paymentIntent=typeof object.payment_intent==='string'?object.payment_intent:object.payment_intent?.id;
    if(paymentIntent){const now=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO stripe_refunds(payment_intent,created_at) VALUES (?,?)').bind(paymentIntent,now),env.DB.prepare("UPDATE orders SET payment_status='refunded',status=CASE WHEN status IN ('confirmed','preparing') THEN 'cancelled' ELSE status END,version=version+1 WHERE stripe_payment_intent=? AND payment_status='paid'").bind(paymentIntent),env.DB.prepare("INSERT OR IGNORE INTO audit(id,actor,action,target,created_at) VALUES (?,'stripe','STRIPE_REFUND',?,?)").bind(event.id,paymentIntent,now)]);}
   }
   return json({received:true});
  }
  if(path==='/api/paiement/statut'){
   if(request.method!=='GET')throw new HttpError(405,'Méthode refusée');const id=url.searchParams.get('session_id')||'';if(!/^cs_(?:test_|live_)?[a-zA-Z0-9_]{10,250}$/.test(id))throw new HttpError(400,'Référence invalide');
   const attempt=await env.DB.prepare('SELECT * FROM checkout_attempts WHERE session_id=?').bind(id).first();if(!attempt)throw new HttpError(404,'Paiement introuvable');
   if(config&&attempt.mode===config.mode&&['creating','open'].includes(attempt.status)){try{await settleSession(await makeClient(config.secret).checkout.sessions.retrieve(id,{expand:['payment_intent.latest_charge']}),env);}catch{/* The signed webhook will retry fulfillment. */}}
   const order=await env.DB.prepare('SELECT id,payment_status,payment_mode FROM orders WHERE stripe_session_id=?').bind(id).first();return json(order?{state:order.payment_status,reference:order.id,mode:order.payment_mode,items:JSON.parse(attempt.items).map(({id,quantity})=>({id,quantity}))}:{state:attempt.status==='expired'?'expired':attempt.status==='failed'?'failed':'pending',mode:attempt.mode});
  }
  const deliveryConfig=await shippingConfiguration(env.DB,config);
  const visible=!prelaunchEnabled||await isStoreAdmin(request,env);
  if(path==='/api/paiement/config'){
   if(request.method!=='GET')throw new HttpError(405,'Méthode refusée');return json({enabled:visible&&config?.enabled===1,mode:config?.mode||'test',...deliveryConfig});
  }
  if(request.method!=='POST')throw new HttpError(405,'Méthode refusée');
  if(request.headers.get('origin')!==url.origin)throw new HttpError(403,'Origine refusée');
  if(!visible)throw new HttpError(403,'La boutique en ligne n’est pas encore ouverte.');
  if(!config||(path!=='/api/paiement/annuler'&&!config.enabled))throw new HttpError(503,'Le paiement n’est pas encore activé.');
  let body;try{body=JSON.parse(await rawBody(request));}catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'Panier invalide');}
  if(path==='/api/paiement/annuler'){
   if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.key||''))throw new HttpError(400,'Référence invalide');
   const attempt=await env.DB.prepare('SELECT * FROM checkout_attempts WHERE id=?').bind(body.key).first();if(!attempt||attempt.mode!==config.mode)throw new HttpError(404,'Session introuvable');
   if(['expired','failed'].includes(attempt.status))return json({state:'cancelled'});
   const stripe=makeClient(config.secret);let session=await sessionFor(attempt,stripe);if(session.status==='open')session=await stripe.checkout.sessions.expire(session.id);await settleSession(session,env);
   return json({state:session.payment_status==='paid'?'paid':session.status==='expired'?'cancelled':'pending',session_id:session.id});
  }
  const lines=normalizeCart(body.items);if(!Array.isArray(body.items)||!lines.length||lines.length!==body.items.length||lines.some(line=>line.quantity>1000))throw new HttpError(400,'Panier invalide');
  if(!['pickup','shipping'].includes(body.delivery)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.key||''))throw new HttpError(400,'Réception ou référence invalide');
  if(body.delivery==='shipping'&&(deliveryConfig.shipping_cents===null||!deliveryConfig.countries.length))throw new HttpError(409,'L’expédition n’est pas encore configurée. Choisissez le retrait en boutique.');
  const fingerprint=JSON.stringify({items:[...lines].sort((a,b)=>a.id.localeCompare(b.id)),delivery:body.delivery,mode:config.mode});let attempt=await env.DB.prepare('SELECT * FROM checkout_attempts WHERE id=?').bind(body.key).first();const stripe=makeClient(config.secret);
  if(attempt&&attempt.fingerprint!==fingerprint)throw new HttpError(409,'Le panier a changé : recommencez le paiement.');
  if(!attempt){
   if(body.terms_accepted!==true||body.terms_version!==LEGAL_VERSION)throw new HttpError(400,'Veuillez lire et accepter la version actuelle des conditions générales de vente.');
   await reconcilePayments(env,config,makeClient);
   const rows=(await env.DB.prepare(`SELECT id,name,price_cents,stock,published FROM products WHERE id IN (${lines.map(()=>'?').join(',')})`).bind(...lines.map(line=>line.id)).all()).results;const quote=quoteCart(lines,rows);
   if(!quote.valid||quote.total_cents>99999999)throw new HttpError(409,'Les prix ou stocks ont changé. Actualisez le panier.');
   const items=quote.items.map(item=>({id:item.id,name:item.name,quantity:item.quantity,price_cents:item.price_cents,line_total_cents:item.line_cents,unit:'piece'}));
   const createdAt=Math.floor(Date.now()/1000),expiresAt=createdAt+2100;attempt={id:body.key,session_id:null,delivery:body.delivery,shipping_cents:body.delivery==='shipping'?shippingPrice(quote.total_cents,deliveryConfig.shipping_policy,deliveryConfig.shipping_cents):0,shipping_label:deliveryConfig.shipping_policy?.label||'Expédition',total_cents:quote.total_cents,expires_at:expiresAt,status:'creating'};
   attempt.params=JSON.stringify(checkoutParams(attempt,items,deliveryConfig.countries));
   const requester=await requesterHash(request,env);
   const active=await env.DB.prepare("SELECT COUNT(*) AS count FROM checkout_attempts WHERE requester=? AND status IN ('creating','open')").bind(requester).first();if(active.count>=5)throw new HttpError(429,'Plusieurs paiements sont déjà en cours. Patientez avant de recommencer.');
   try{await env.DB.batch([env.DB.prepare('INSERT INTO checkout_attempts(id,params,requester,fingerprint,items,total_cents,shipping_cents,delivery,mode,status,created_at,expires_at,terms_version,terms_accepted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(attempt.id,attempt.params,requester,fingerprint,JSON.stringify(items),attempt.total_cents,attempt.shipping_cents,body.delivery,config.mode,'creating',createdAt,expiresAt,LEGAL_VERSION,createdAt)]);}catch(error){
    const existing=await env.DB.prepare('SELECT * FROM checkout_attempts WHERE id=?').bind(body.key).first();if(existing&&existing.fingerprint===fingerprint)attempt=existing;else if(/checkout rate limit/.test(String(error)))throw new HttpError(429,'Plusieurs paiements sont déjà en cours. Patientez avant de recommencer.');else if(/stock|product unavailable/.test(String(error)))throw new HttpError(409,'Le stock vient de changer. Actualisez le panier.');else throw error;
   }
  }
  if(attempt.status==='paid'&&attempt.session_id)return json({state:'paid',session_id:attempt.session_id});
  if(!['creating','open'].includes(attempt.status)){const error=new HttpError(409,'Cette tentative est terminée. Le paiement peut être recommencé.');error.retryCheckout=['failed','expired'].includes(attempt.status);throw error;}
  let session;
  try{session=await sessionFor(attempt,stripe);}catch(error){const safe=value=>typeof value==='string'&&/^[a-zA-Z0-9_\[\].-]{1,120}$/.test(value)?value:undefined;console.error('stripe_checkout_failed',{attempt:attempt.id,type:safe(error.type),code:safe(error.code),param:safe(error.param),requestId:safe(error.requestId)});if(error.type==='StripeInvalidRequestError'&&!attempt.session_id)await env.DB.batch([env.DB.prepare("UPDATE checkout_attempts SET status='failed' WHERE id=? AND status='creating' AND session_id IS NULL").bind(attempt.id)]);const failure=new HttpError(503,'Stripe n’a pas pu ouvrir le paiement. Réessayez avec le même panier.');failure.retryCheckout=error.type==='StripeInvalidRequestError'&&!attempt.session_id;throw failure;}
  if(session.payment_status==='paid'){await settleSession(session,env);return json({state:'paid',session_id:session.id});}
  if(session.status!=='open'){await settleSession(session,env);throw new HttpError(409,'Ce paiement est terminé ou expiré. Actualisez le panier.');}
  const target=new URL(session.url);if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')throw new HttpError(503,'Destination de paiement Stripe invalide');
  await env.DB.batch([env.DB.prepare("UPDATE checkout_attempts SET session_id=?,status='open' WHERE id=? AND status='creating'").bind(session.id,attempt.id)]);
  return json({url:session.url,mode:config.mode});
 }catch(error){if(error instanceof HttpError)return json({error:error.message,...(error.retryCheckout?{retry_checkout:true}:{})},error.status);return json({error:'Le paiement est temporairement indisponible. Réessayez plus tard.'},503);}
}
