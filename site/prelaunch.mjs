import { waitingFooter, waitingFooterCSS } from './footer.mjs';
import { authorize } from '../admin/core.mjs';

// Switch off when the owner is ready to open the complete storefront.
export const prelaunchEnabled=false;
const publicPages=new Set(['/','/maison','/savoir-faire','/bonbons','/chocolats','/boutique','/panier']);
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'};
export async function handlePrelaunch(request,env){
 const url=new URL(request.url);
 const path=url.pathname.replace(/\/+$/,'')||'/';
 if(!prelaunchEnabled||!['GET','HEAD'].includes(request.method)||!publicPages.has(path)&&!path.startsWith('/contenu/')&&!path.startsWith('/boutique/'))return null;
 if(url.searchParams.get('apercu')==='1'){
  const user=request.headers.get('oai-authenticated-user-id');
  if(!user)return new Response(null,{status:302,headers:{...headers,Location:'/signin-with-chatgpt?return_to='+encodeURIComponent(url.pathname+url.search)}});
  try{authorize(request,env);return null;}catch{
   const grant=env.DB?await env.DB.prepare('SELECT user_id FROM admin_access WHERE slot=1 AND user_id=?').bind(user).first():null;
   if(grant)return null;
  }
 }
 if(path!=='/')return new Response(null,{status:302,headers:{...headers,Location:'/'}});
 const nonce=crypto.randomUUID();
 const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fffdf9"><title>Au Parrain Généreux — La boutique en ligne arrive bientôt</title><meta name="description" content="La boutique en ligne Au Parrain Généreux se prépare. Retrouvez bientôt les créations de notre chocolaterie artisanale au Havre."><style nonce="${nonce}">
 *{box-sizing:border-box}body{margin:0;background-color:#fffdf9;background-image:repeating-linear-gradient(90deg,rgba(221,91,35,.055) 0,rgba(221,91,35,.055) 38px,rgba(255,255,255,.78) 38px,rgba(255,255,255,.78) 76px);color:#241d18;font-family:Georgia,'Times New Roman',serif}main{min-height:100vh;min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 24px}img{display:block;width:min(460px,85vw);height:auto;margin:0 0 30px}.eyebrow{max-width:520px;text-wrap:balance;line-height:1.7;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#695648;margin:0 0 24px}h1{max-width:750px;font-size:clamp(32px,5.5vw,60px);font-weight:400;line-height:1.16;margin:0;text-wrap:balance}h1::after{content:'';display:block;width:52px;height:2px;background:#FF6A00;margin:30px auto}.message{max-width:430px;font-size:18px;line-height:1.7;color:#59493d;margin:0}.signature{font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.12em;margin:48px 0 0;color:#786452}@media(max-width:480px){main{padding:32px 24px}img{margin-bottom:24px}.eyebrow{font-size:10px;letter-spacing:.14em}.message{font-size:16px}.signature{margin-top:36px}}
 ${waitingFooterCSS}
 </style></head><body><main><img src="/images/logo-medaillon-orange.webp" alt="Au Parrain Généreux" width="800" height="792"><p class="eyebrow">La plus ancienne chocolaterie du Havre depuis 1890</p><h1>Notre boutique en ligne<br>arrive bientôt.</h1><p class="message">Un peu de patience…<br>Nous préparons de belles gourmandises à partager.</p><p class="signature">Au Parrain Généreux</p></main>${waitingFooter()}</body></html>`;
 return new Response(request.method==='HEAD'?null:html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; img-src 'self'; style-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`}});
}
