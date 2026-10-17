import Stripe from 'stripe';
import { HttpError } from '../admin/core.mjs';
const encoder=new TextEncoder();
export const storeOrigin='https://auparraingenereux.fr';
export function stripeClient(secret){return new Stripe(secret,{httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2,timeout:15000});}
async function encryptionKey(env){if(!/^[a-f0-9]{64}$/.test(env.PAYMENT_CONFIG_ENCRYPTION_KEY||''))throw new HttpError(503,'Le stockage sécurisé des paiements n’est pas configuré.');return crypto.subtle.importKey('raw',Uint8Array.from(env.PAYMENT_CONFIG_ENCRYPTION_KEY.match(/../g),x=>parseInt(x,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('apg-stripe-v1')},await encryptionKey(env),encoder.encode(value)));return btoa(String.fromCharCode(...iv))+'.'+btoa(String.fromCharCode(...encrypted));}
async function unseal(value,env){const [iv,data]=value.split('.').map(part=>Uint8Array.from(atob(part),char=>char.charCodeAt(0)));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode('apg-stripe-v1')},await encryptionKey(env),data));}
export async function paymentConfig(env){
 if(!env.DB)return null;const row=await env.DB.prepare("SELECT * FROM payment_settings WHERE id='stripe'").first();
 if(!row)return null;return {...row,secret:await unseal(row.secret,env),webhook_secret:await unseal(row.webhook_secret,env),countries:JSON.parse(row.countries)};
}
export function safeConfig(row){return {configured:!!row,enabled:row?.enabled===1,mode:row?.mode||'test',account_id:row?.account_id||'',version:row?.version||0,shipping_cents:row?.shipping_cents??null,countries:row?JSON.parse(typeof row.countries==='string'?row.countries:JSON.stringify(row.countries)):[],webhook_url:storeOrigin+'/api/stripe/webhook'};}
export async function configurePayments(input,env,actor,makeClient=stripeClient){
 if(!env.PAYMENT_CONFIG_ENCRYPTION_KEY)throw new HttpError(503,'Stockage sécurisé non configuré');
 const current=await paymentConfig(env);const secret=input.secret?.trim()||current?.secret;
 if(!/^(?:sk|rk)_(test|live)_[a-zA-Z0-9]{16,300}$/.test(secret||''))throw new HttpError(400,'Renseignez une clé secrète Stripe de test ou de production.');
 const mode=secret.includes('_test_')?'test':'live';
 if(typeof input.enabled!=='boolean'||!Number.isSafeInteger(input.version)||input.version<0)throw new HttpError(400,'Réglages invalides');
 if((current?.version||0)!==input.version)throw new HttpError(409,'Réglages modifiés ailleurs : rechargez.');
 if(input.shipping_cents!==null&&(!Number.isSafeInteger(input.shipping_cents)||input.shipping_cents<0||input.shipping_cents>100000))throw new HttpError(400,'Frais d’expédition invalides');
 const allowed=['FR','BE','LU','DE','ES','IT','NL','PT','AT','IE','MC','CH','GB'];
 if(!Array.isArray(input.countries)||input.countries.length>allowed.length||new Set(input.countries).size!==input.countries.length||input.countries.some(country=>!allowed.includes(country))||input.shipping_cents!==null&&!input.countries.length)throw new HttpError(400,'Choisissez les destinations d’expédition.');
 if(current&&current.mode!==mode){const pending=await env.DB.prepare("SELECT id FROM checkout_attempts WHERE status IN ('creating','open') LIMIT 1").first();if(pending)throw new HttpError(409,'Des paiements sont encore en cours. Terminez-les avant de changer de mode.');}
 const stripe=makeClient(secret);let account;
 try{account=await stripe.accounts.retrieve();}catch{throw new HttpError(400,'Clé Stripe refusée : vérifiez le compte et les autorisations.');}
 if(current&&current.account_id!==account.id)throw new HttpError(409,'Le changement de compte Stripe nécessite une migration des paiements existants.');
 if(input.enabled&&mode==='live'&&!account.charges_enabled)throw new HttpError(400,'Activez les paiements et terminez la vérification du compte dans Stripe.');
 let webhookSecret=current?.mode===mode?current.webhook_secret:null,endpointId=current?.mode===mode?current.endpoint_id:null;
 if(!webhookSecret){try{const endpoint=await stripe.webhookEndpoints.create({url:storeOrigin+'/api/stripe/webhook',enabled_events:['checkout.session.completed','checkout.session.expired','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','charge.refunded'],description:'Au Parrain Généreux — commandes du site'},{idempotencyKey:'apg-webhook-'+mode+'-'+account.id});webhookSecret=endpoint.secret;endpointId=endpoint.id;}catch{throw new HttpError(400,'Stripe ne permet pas de créer le webhook. Utilisez une clé autorisée à gérer les sessions Checkout et les webhooks.');}}
 if(!webhookSecret)throw new HttpError(503,'Signature du webhook indisponible : recommencez la configuration.');
 const values=[await seal(secret,env),await seal(webhookSecret,env),account.id,endpointId,mode,input.enabled?1:0,input.shipping_cents,JSON.stringify(input.countries)];
 const change=current?env.DB.prepare("UPDATE payment_settings SET secret=?,webhook_secret=?,account_id=?,endpoint_id=?,mode=?,enabled=?,shipping_cents=?,countries=?,version=version+1 WHERE id='stripe' AND version=? AND NOT EXISTS (SELECT 1 FROM checkout_attempts WHERE status IN ('creating','open') AND mode<>?)").bind(...values,input.version,mode):env.DB.prepare("INSERT OR IGNORE INTO payment_settings(secret,webhook_secret,account_id,endpoint_id,mode,enabled,shipping_cents,countries,id) VALUES (?,?,?,?,?,?,?,?,'stripe')").bind(...values);
 const [result]=await env.DB.batch([change,env.DB.prepare('INSERT INTO audit(id,actor,action,target,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor,'STRIPE_CONFIGURE',mode,new Date().toISOString())]);if(result.meta.changes!==1)throw new HttpError(409,'Réglages modifiés ailleurs : rechargez.');return {configured:true,mode,version:input.version+1};
}
export async function verifyStripeEvent(raw,signature,secret){return Stripe.webhooks.constructEventAsync(raw,signature,secret,300,Stripe.createSubtleCryptoProvider());}
