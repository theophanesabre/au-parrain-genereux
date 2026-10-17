import { HttpError, checkOrigin } from './core.mjs';
import { initialCatalog } from './catalog.mjs';
export async function claimAdmin(request, env) {
  const actor=request.headers.get('oai-authenticated-user-id');
  if(!actor) throw new HttpError(401,'Connectez-vous avec ChatGPT');
  checkOrigin(request);
  if(!env.DB || !env.ADMIN_SETUP_TOKEN_HASH || !env.ADMIN_SETUP_EXPIRES_AT || Date.parse(env.ADMIN_SETUP_EXPIRES_AT)<Date.now() || !Number.isFinite(Date.parse(env.ADMIN_SETUP_EXPIRES_AT)) || env.ADMIN_USER_IDS?.trim()) throw new HttpError(403,'Activation indisponible ou expirée');
  const token=request.headers.get('X-Admin-Setup-Token');
  if(!token || token.length>200)throw new HttpError(403,'Lien d’activation invalide');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('');
  let difference=digest.length^env.ADMIN_SETUP_TOKEN_HASH.length;
  for(let i=0;i<digest.length;i++)difference|=digest.charCodeAt(i)^(env.ADMIN_SETUP_TOKEN_HASH.charCodeAt(i)||0);
  if(difference)throw new HttpError(403,'Lien d’activation invalide');
  const existing=await env.DB.prepare('SELECT user_id FROM admin_access WHERE slot=1').first();
  if(existing){if(existing.user_id!==actor)throw new HttpError(409,'L’administration est déjà activée');return {ok:true};}
  // Unique singleton slot and batch transaction ensure only one account can claim ownership.
  const seed=initialCatalog.map(p=>env.DB.prepare('INSERT OR IGNORE INTO products (id,name,description,price_cents,stock,image,published) VALUES (?,?,?,0,0,?,1)').bind(p.id,p.name,p.description,p.image));
  await env.DB.batch([env.DB.prepare('INSERT INTO admin_access (slot,user_id,created_at) VALUES (1,?,?)').bind(actor,new Date().toISOString()),...seed,env.DB.prepare('INSERT INTO audit (id,actor,action,target,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,'ACTIVATE','administration',new Date().toISOString())]);
  return {ok:true};
}
export function setupHTML(nonce){return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Activer mon administration</title><style nonce="${nonce}">body{font:18px system-ui;max-width:600px;margin:12vh auto;padding:24px;color:#332319;background:#fff8f0}button{background:#FF6A00;color:#21140a;border:0;padding:14px 22px;border-radius:6px;font:inherit;cursor:pointer}a{color:#8a3600}</style></head><body><h1>Au Parrain Généreux</h1><h2>Activer mon administration</h2><p>Ce lien privé associe l’administration à votre compte ChatGPT. Gardez-le pour vous.</p><p id="account"></p><button id="activate">Activer avec mon compte connecté</button><p id="message" role="status" aria-live="polite"></p><p><a href="/signin-with-chatgpt?return_to=%2Fadmin%2Fsetup" target="_top">Se connecter à ChatGPT</a></p><p>Si vous devez vous connecter, rouvrez ensuite le lien privé reçu dans la conversation.</p><script nonce="${nonce}">const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);const button=document.querySelector('#activate');if(!token){button.disabled=true;document.querySelector('#message').textContent='Rouvrez le lien privé complet fourni dans votre conversation.';}button.onclick=async()=>{button.disabled=true;try{const r=await fetch('/admin/api/claim',{method:'POST',headers:{'X-Admin-Setup-Token':token}});const data=await r.json();if(!r.ok)throw Error(data.error);location.replace('/admin');}catch(e){document.querySelector('#message').textContent=e.message;button.disabled=false;}};</script></body></html>`;}
