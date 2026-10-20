import {HttpError} from '../admin/core.mjs';
const base='https://api.brevo.com/v3', enc=new TextEncoder();
const emailOK=value=>typeof value==='string'&&value.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export function normalizePhone(value){const p=String(value||'').replace(/[\s().-]/g,'');const n=p.startsWith('00')?'+'+p.slice(2):p;return /^\+[1-9]\d{7,14}$/.test(n)?n:'';}
async function key(env){if(!/^[a-f0-9]{64}$/.test(env.PAYMENT_CONFIG_ENCRYPTION_KEY||''))throw new HttpError(503,'Stockage sécurisé non configuré.');return crypto.subtle.importKey('raw',Uint8Array.from(env.PAYMENT_CONFIG_ENCRYPTION_KEY.match(/../g),x=>parseInt(x,16)),'AES-GCM',false,['encrypt','decrypt']);}
async function seal(secret,env){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('apg-notifications-v1')},await key(env),enc.encode(secret));return btoa(String.fromCharCode(...iv))+'.'+btoa(String.fromCharCode(...new Uint8Array(data)));}
async function unseal(secret,env){const [iv,data]=secret.split('.').map(p=>Uint8Array.from(atob(p),c=>c.charCodeAt(0)));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode('apg-notifications-v1')},await key(env),data));}
export async function notificationStatus(env){const row=await env.DB.prepare("SELECT sender_email,sender_name,sms_sender,enabled,version FROM notification_settings WHERE id='brevo'").first();return {configured:!!row,enabled:row?.enabled===1,version:row?.version||0,sender_email:row?.sender_email||'',sender_name:row?.sender_name||'Au Parrain Généreux',sms_sender:row?.sms_sender||'APG'};}
export async function saveNotificationSettings(input,env,actor,send=fetch){
 const current=await env.DB.prepare("SELECT * FROM notification_settings WHERE id='brevo'").first();
 if(!Number.isSafeInteger(input.version)||(current?.version||0)!==input.version)throw new HttpError(409,'Réglages modifiés ailleurs. Rechargez.');
 if(typeof input.enabled!=='boolean'||!emailOK(input.sender_email)||typeof input.sender_name!=='string'||!input.sender_name.trim()||input.sender_name.length>70||/[\r\n]/.test(input.sender_name)||!(/^[A-Za-z][A-Za-z0-9]{2,10}$/).test(input.sms_sender||''))throw new HttpError(400,'Vérifiez l’adresse email et les noms d’expéditeur (SMS : 3 à 11 lettres/chiffres).');
 if(input.secret!==undefined&&typeof input.secret!=='string')throw new HttpError(400,'Clé API invalide.');
 const secret=input.secret?.trim()||(current?await unseal(current.secret,env):'');if(!secret||secret.length<20||secret.length>500||/[\r\n]/.test(secret))throw new HttpError(400,'Renseignez la clé API Brevo dans ce formulaire sécurisé.');
 if(input.enabled){let response;try{response=await send(base+'/senders',{headers:{'api-key':secret,accept:'application/json'},signal:AbortSignal.timeout(10000)});}catch{throw new HttpError(503,'Brevo est injoignable. Aucun envoi activé.');}
 if(!response.ok)throw new HttpError(400,'Clé Brevo refusée ou accès aux expéditeurs indisponible.');
 const data=await response.json();if(!data.senders?.some(s=>s.active&&s.email?.toLowerCase()===input.sender_email.toLowerCase()))throw new HttpError(400,'Validez cette adresse d’expédition dans Brevo avant d’activer les messages.');}
 const encrypted=await seal(secret,env);const values=[encrypted,input.sender_email.trim(),input.sender_name.trim(),input.sms_sender,input.enabled?1:0];
 const change=current?env.DB.prepare("UPDATE notification_settings SET secret=?,sender_email=?,sender_name=?,sms_sender=?,enabled=?,version=version+1 WHERE id='brevo' AND version=?").bind(...values,input.version):env.DB.prepare("INSERT OR IGNORE INTO notification_settings(secret,sender_email,sender_name,sms_sender,enabled,id) VALUES (?,?,?,?,?,'brevo')").bind(...values);
 const [result]=await env.DB.batch([change,env.DB.prepare("INSERT INTO audit(id,actor,action,target,created_at) SELECT ?,?,'NOTIFICATION_SETTINGS','brevo',? WHERE changes()=1").bind(crypto.randomUUID(),actor,new Date().toISOString())]);if(result.meta.changes!==1)throw new HttpError(409,'Réglages modifiés ailleurs. Rechargez.');return notificationStatus(env);
}
export function notificationMessage(order,event){
 const ref=String(order.order_number||order.id.slice(-8)),pickup=order.delivery==='pickup';
 const title=event==='confirmed'?'Votre commande est confirmée':pickup?'Votre commande est prête à être retirée':'Votre commande est prête à être expédiée';
 const instructions=event==='confirmed'?(pickup?'Nous vous préviendrons lorsque votre commande sera prête. Attendez ce message avant de venir.':'Nous préparons votre commande pour son expédition.'):(pickup?'Vous pouvez la retirer au 123 rue Maréchal Joffre, 76600 Le Havre, du mardi au samedi, de 9 h à 12 h et de 14 h à 19 h.':'Votre commande est préparée. Ce message ne confirme pas encore sa remise au transporteur.');
 const items=(()=>{try{return JSON.parse(order.items).map(i=>`${i.quantity} × ${i.name||'Article maison'}`).join('\n');}catch{return '';}})();
 return {subject:`Au Parrain Généreux — commande n° ${ref} ${event==='confirmed'?'confirmée':'prête'}`,text:`Bonjour ${order.customer||''},\n\n${title} (n° ${ref}).\n${instructions}\n\n${items}\n\nAu Parrain Généreux\n02 35 42 32 75\nhttps://auparraingenereux.fr`,sms:`Au Parrain Genereux - Commande ${ref} ${event==='confirmed'?'confirmee. '+(pickup?'Nous vous previendrons quand elle sera prete.':'Preparation en cours.') : pickup?'prete. Retrait au 123 rue Marechal Joffre, Le Havre. Mar-sam 9h-12h et 14h-19h.':'prete a etre expediee. Elle ne sera remise au transporteur qu ensuite.'}`};
}
export async function dispatchNotifications(env,send=fetch){
 if(!env.DB)return {processed:0};
 const config=await env.DB.prepare("SELECT * FROM notification_settings WHERE id='brevo' AND enabled=1").first();if(!config)return {processed:0};
 const secret=await unseal(config.secret,env),now=new Date().toISOString();
 // A crashed request may already have reached the provider: never blindly resend it.
 await env.DB.prepare("UPDATE order_notifications SET state='uncertain',error='Résultat à vérifier dans Brevo',updated_at=? WHERE state='sending' AND updated_at<?").bind(now,new Date(Date.now()-300000).toISOString()).run();
 const rows=(await env.DB.prepare("SELECT n.*,o.customer,o.customer_email,o.customer_phone,o.items,o.delivery,o.status AS order_status,o.payment_status,o.payment_mode,num.number AS order_number FROM order_notifications n JOIN orders o ON o.id=n.order_id LEFT JOIN order_numbers num ON num.order_id=o.id WHERE n.state='pending' ORDER BY n.created_at,n.event,n.channel LIMIT 8").all()).results;
 let processed=0;
 await Promise.all(rows.map(async row=>{
 const claimed=await env.DB.prepare("UPDATE order_notifications SET state='sending',attempts=attempts+1,updated_at=? WHERE id=? AND state='pending'").bind(now,row.id).run();if(claimed.meta.changes!==1)return;
 processed++;
 const finish=async(state,error='',provider=null)=>env.DB.prepare("UPDATE order_notifications SET state=?,error=?,provider_id=?,updated_at=? WHERE id=? AND state='sending'").bind(state,error,provider,new Date().toISOString(),row.id).run();
 if(row.channel==='email'&&row.event!=='ready'){await finish('skipped','Email envoyé uniquement lorsque la commande est prête');return;}
 if(row.payment_mode!=='live'||row.payment_status!=='paid'||['cancelled','draft'].includes(row.order_status)){await finish('skipped','Commande non payable ou annulée');return;}
 if(row.event==='ready'&&!['ready','completed'].includes(row.order_status)){await finish('skipped','La commande n’est plus prête');return;}
 const recipient=row.channel==='email'?row.customer_email:normalizePhone(row.customer_phone);
 if(row.channel==='email'?!emailOK(recipient):!recipient){await finish('failed',row.channel==='email'?'Email client manquant':'Téléphone international client manquant');return;}
 const message=notificationMessage({...row,id:row.order_id},row.event);
 const payload=row.channel==='email'?{sender:{name:config.sender_name,email:config.sender_email},to:[{email:recipient,name:row.customer.slice(0,70)}],subject:message.subject,textContent:message.text,headers:{idempotencyKey:row.id}}:{sender:config.sms_sender,recipient,content:message.sms,type:'transactional',unicodeEnabled:false};
 try{
 const response=await send(base+(row.channel==='email'?'/smtp/email':'/transactionalSMS/send'),{method:'POST',headers:{'api-key':secret,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
 if(!response.ok){await finish(response.status>=500?'uncertain':'failed',response.status===402?'Crédits Brevo insuffisants':response.status===429?'Limite Brevo atteinte':response.status>=500?'Résultat à vérifier dans Brevo':`Demande refusée par Brevo (${response.status})`);return;}
 const data=await response.json();const id=data.messageId||data.reference;if(!id){await finish('uncertain','Réponse Brevo à vérifier');return;}await finish('accepted','',String(id));
 }catch{await finish('uncertain','Connexion interrompue : vérifiez Brevo avant tout nouvel envoi');}
 }));
 return {processed};
}
export async function retryNotification(env,id,actor){
 const [result]=await env.DB.batch([env.DB.prepare("UPDATE order_notifications SET state='pending',error='',updated_at=? WHERE id=? AND state='failed' AND NOT(event='confirmed' AND channel='email')").bind(new Date().toISOString(),id),env.DB.prepare("INSERT INTO audit(id,actor,action,target,created_at) SELECT ?,?,'NOTIFICATION_RETRY',?,? WHERE changes()=1").bind(crypto.randomUUID(),actor,id,new Date().toISOString())]);
 if(result.meta.changes!==1)throw new HttpError(409,'Seuls les envois refusés peuvent être relancés. Vérifiez les envois incertains dans Brevo.');return {ok:true};
}
