import {HttpError,text} from '../core.mjs';
import {quantity,quantityString} from './service.mjs';
const json=data=>Response.json(data,{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const publicMove=m=>({...m,quantity:quantityString(m.quantity),before_quantity:quantityString(m.before_quantity),after_quantity:quantityString(m.after_quantity),payload:undefined,location:'shop'});
export async function stockLocationsAPI(request,env,actor,readBody){
 const url=new URL(request.url),path=url.pathname.slice('/admin/api/inventory'.length),db=env.DB;
 if(path==='/online'&&request.method==='GET'){
  // Intentionally no prices, customer information, orders or payment settings.
  const q=(url.searchParams.get('q')||'').trim();if(q.length>160)throw new HttpError(400,'Recherche trop longue');
  const rows=await db.prepare("SELECT id,name,stock,published FROM products WHERE archived=0 AND id<>'bonbon' AND id NOT LIKE 'bonbon-%' AND instr(lower(name),lower(?))>0 ORDER BY name LIMIT 101").bind(q).all();return json({items:rows.results.slice(0,100),has_more:rows.results.length>100});
 }
 if(path==='/shop'&&request.method==='GET'){
  const q=(url.searchParams.get('q')||'').trim();if(q.length>160)throw new HttpError(400,'Recherche trop longue');
  const rows=await db.prepare("SELECT r.*,b.quantity,EXISTS(SELECT 1 FROM sp_shop_movements m WHERE m.reference_id=r.id) AS initialized FROM sp_references r JOIN sp_shop_balances b ON b.reference_id=r.id WHERE r.archived=0 AND r.category='finished' AND instr(lower(r.name),lower(?))>0 ORDER BY r.name LIMIT 101").bind(q).all();return json({items:rows.results.slice(0,100).map(r=>({...r,quantity:quantityString(r.quantity),threshold:r.threshold==null?null:quantityString(r.threshold)})),has_more:rows.results.length>100});
 }
 if(path==='/shop-movements'&&request.method==='POST'){
  if(!['admin','shop'].includes(actor.role))throw new HttpError(403,'Prélèvement magasin réservé à la boutique ou aux responsables');
  const input=await readBody(request);let correction=null;if(input.correction_of){if(actor.role!=='admin')throw new HttpError(403,'Correction réservée aux responsables');correction=await db.prepare('SELECT * FROM sp_shop_movements WHERE id=?').bind(typeof input.correction_of==='string'?input.correction_of:'').first();if(!correction||correction.origin_id||correction.correction_of)throw new HttpError(400,'Mouvement magasin d’origine requis');if(!input.comment?.trim())throw new HttpError(400,'Motif obligatoire');Object.assign(input,{reference_id:correction.reference_id,kind:{shop_in:'shop_out',shop_out:'shop_in',web_reserve:'web_return',web_return:'web_reserve'}[correction.kind],quantity:quantityString(correction.quantity),web_product_id:correction.web_product_id,lot_code:correction.lot_code,confirm_same_article:true});}if(typeof input.request_key!=='string'||!/^[a-f0-9-]{36}$/.test(input.request_key))throw new HttpError(400,'Identifiant de validation requis');
  const operations={shop_in:1,shop_out:-1,web_reserve:-1,web_return:1},direction=operations[input.kind];if(!direction)throw new HttpError(400,'Opération magasin invalide');
  const ref=await db.prepare("SELECT * FROM sp_references WHERE id=? AND category='finished'").bind(typeof input.reference_id==='string'?input.reference_id:'').first();if(!ref)throw new HttpError(404,'Produit fini introuvable');
  const amount=quantity(input.quantity,ref.unit),web=input.kind.startsWith('web_');
  let product=null;if(web){if(ref.unit!=='piece'||input.confirm_same_article!==true)throw new HttpError(400,'Transfert web uniquement pour le même article fini, pièce pour pièce. Aucune conversion kg/coffret.');product=await db.prepare("SELECT id,name FROM products WHERE id=? AND archived=0 AND id<>'bonbon' AND id NOT LIKE 'bonbon-%'").bind(typeof input.web_product_id==='string'?input.web_product_id:'').first();if(!product)throw new HttpError(400,'Choisissez l’article web correspondant');}
  const comment=input.comment?text(input.comment,1000):'',lot=input.lot_code?text(input.lot_code,120):'';
  const payload=JSON.stringify({reference_id:ref.id,kind:input.kind,amount,web_product_id:product?.id||null,comment,lot,correction_of:correction?.id||null});
  const previous=await db.prepare('SELECT * FROM sp_shop_movements WHERE request_key=?').bind(input.request_key).first();
  if(previous){if(previous.actor!==actor.id||previous.payload!==payload)throw new HttpError(409,'Validation déjà utilisée pour une autre opération');return json({movement:publicMove(previous),replayed:true});}
  if(ref.archived&&!correction)throw new HttpError(409,'Référence archivée');const id=crypto.randomUUID();
  const stmt=db.prepare(`INSERT INTO sp_shop_movements(id,request_key,payload,reference_id,reference_name,unit,kind,direction,quantity,before_quantity,after_quantity,web_product_id,web_product_name,actor,actor_name,created_at,lot_code,comment,correction_of)
 SELECT ?,?,?,r.id,r.name,r.unit,?,?,?,b.quantity,b.quantity+?*?,?,?,?,?,?,?,?,? FROM sp_references r JOIN sp_shop_balances b ON b.reference_id=r.id WHERE r.id=?`).bind(id,input.request_key,payload,input.kind,direction,amount,amount,direction,product?.id||null,product?.name||'',actor.id,actor.name,new Date().toISOString(),lot,comment,correction?.id||null,ref.id);
  try{await db.batch([stmt]);}catch(error){const prior=await db.prepare('SELECT * FROM sp_shop_movements WHERE request_key=?').bind(input.request_key).first();if(prior&&prior.actor===actor.id&&prior.payload===payload)return json({movement:publicMove(prior),replayed:true});if(/constraint|sp shop/i.test(String(error)))throw new HttpError(409,'Transfert refusé : stock magasin ou stock web disponible insuffisant. Aucun stock n’a été modifié.');throw error;}
  return json({movement:publicMove(await db.prepare('SELECT * FROM sp_shop_movements WHERE id=?').bind(id).first()),replayed:false});
 }
 return null;
}
