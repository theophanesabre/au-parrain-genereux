import {cartProducts} from '../catalogue/service.mjs';
import { normalizeCart, quoteCart } from './cart.mjs';
export async function handleCommerce(request,env) {
  if(new URL(request.url).pathname!=='/api/panier')return null;
  const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(request.method!=='POST')return json({error:'Méthode refusée'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origine refusée'},403);
  try{
    if(Number(request.headers.get('content-length'))>12000)return json({error:'Panier trop volumineux'},413);
    const raw=await request.text();if(raw.length>12000)return json({error:'Panier trop volumineux'},413);
    const body=JSON.parse(raw);
    if(!Array.isArray(body?.items)||body.items.length>50)return json({error:'Panier invalide'},400);
    const lines=normalizeCart(body.items);
    if(lines.length!==body.items.length)return json({error:'Quantités ou articles invalides'},400);
    if(!env.DB)return json({error:'Le catalogue est temporairement indisponible'},503);
    const rows=await cartProducts(env.DB,lines);
    return json(quoteCart(lines,rows));
  }catch(error){return json({error:error instanceof SyntaxError?'Panier invalide':'Impossible de vérifier le panier'},error instanceof SyntaxError?400:503);}
}
