import {authorize,checkOrigin,HttpError,text,integer} from '../core.mjs';
export const inventoryUnits=['kg','g','piece','sac','carton','litre'];
const kinds={raw_in:['raw',1],raw_out:['raw',-1],production_in:['finished',1],production_out:['finished',-1]};
export const quantityString=value=>String(value/1000);
export function quantity(value,unit,{zero=false}={}){
 if(typeof value!=='string'||!/^\d{1,10}(?:[.,]\d{1,3})?$/.test(value.trim()))throw new HttpError(400,'Quantité invalide : 3 décimales maximum, sans exposant.');
 const [whole,fraction='']=value.trim().replace(',','.').split('.');const scaled=Number(whole)*1000+Number(fraction.padEnd(3,'0'));
 if(!Number.isSafeInteger(scaled)||scaled>(10**12)||scaled<(zero?0:1)||(['piece','sac','carton'].includes(unit)&&scaled%1000))throw new HttpError(400,'Quantité positive requise ; les pièces, sacs et cartons sont entiers.');
 return scaled;
}
const optional=(v,max=300)=>v==null||v===''?'':text(v,max);
const uid=value=>{if(typeof value!=='string'||!/^[a-f0-9-]{36}$/.test(value))throw new HttpError(400,'Identifiant invalide');return value;};
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new HttpError(400,'Date invalide');return value;};
export async function inventoryActor(request,env){
 const id=request.headers.get('oai-authenticated-user-id');if(!id)throw new HttpError(401,'Connexion requise');
 let owner=false;try{authorize(request,env);owner=true;}catch{/* Existing owner activation is the other established admin grant. */}
 if(!owner&&env.DB)owner=Boolean(await env.DB.prepare('SELECT user_id FROM admin_access WHERE slot=1 AND user_id=?').bind(id).first());
 if(owner)return {id,name:id,role:'admin'};
 const grant=env.DB?await env.DB.prepare('SELECT name,role FROM sp_users WHERE user_id=? AND active=1').bind(id).first():null;
 if(!grant)throw new HttpError(403,'Accès Stocks & Production non autorisé. Votre identifiant ChatGPT : '+id);return {id,...grant};
}
function requireAdmin(actor){if(actor.role!=='admin')throw new HttpError(403,'Action réservée aux administrateurs');}
function allowed(actor,kind){if(actor.role==='admin')return;if(actor.role==='laboratory'&&['raw_in','raw_out','production_in'].includes(kind))return;if(actor.role==='shop'&&kind==='production_out')return;throw new HttpError(403,'Ce mouvement n’est pas autorisé pour votre profil');}
const refSelect='SELECT r.*,b.quantity FROM sp_references r JOIN sp_balances b ON b.reference_id=r.id';
const publicReference=r=>({...r,quantity:quantityString(r.quantity),threshold:r.threshold==null?null:quantityString(r.threshold)});
const publicMovement=m=>({...m,quantity:quantityString(m.quantity),before_quantity:quantityString(m.before_quantity),after_quantity:quantityString(m.after_quantity),payload:undefined});
async function reference(db,id,actor){const row=await db.prepare(refSelect+' WHERE r.id=?').bind(uid(id)).first();if(!row)throw new HttpError(404,'Référence introuvable');if(actor.role==='shop'&&row.category!=='finished')throw new HttpError(403,'Référence non autorisée');return row;}
function filters(search,actor,{movement=false}={}){
 const parts=[],values=[];const add=(sql,value)=>{parts.push(sql);values.push(value);};
 if(actor.role==='shop')parts.push((movement?'m':'r')+".category='finished'");
 const alias=movement?'m':'r';
 if(search.get('category')){if(!['raw','finished'].includes(search.get('category')))throw new HttpError(400,'Catégorie invalide');add(alias+'.category=?',search.get('category'));}
 if(search.get('q')){const q=optional(search.get('q'),160).replace(/[\\%_]/g,'\\$&');add((movement?"(m.reference_name LIKE ? ESCAPE '\\' OR m.lot_code LIKE ? ESCAPE '\\')":"r.name LIKE ? ESCAPE '\\'"),'%' + q + '%');if(movement)values.push('%'+q+'%');}
 if(movement){
 if(search.get('reference'))add('m.reference_id=?',uid(search.get('reference')));
 if(search.get('kind')){if(![...Object.keys(kinds),'correction'].includes(search.get('kind')))throw new HttpError(400,'Type invalide');add('m.kind=?',search.get('kind'));}
 if(search.get('actor'))add('m.actor=?',text(search.get('actor'),200));
 if(search.get('from'))add('m.created_at>=?',date(search.get('from'))+'T00:00:00.000Z');
 if(search.get('to'))add('m.created_at<=?',date(search.get('to'))+'T23:59:59.999Z');
 if(search.get('from')&&search.get('to')&&search.get('from')>search.get('to'))throw new HttpError(400,'Période inversée');
 }else add('r.archived=?',search.get('archived')==='1'?1:0);
 return {where:parts.length?' WHERE '+parts.join(' AND '):'',values};
}
export async function saveReference(db,actor,input,id){
 requireAdmin(actor);const name=text(input.name,160),category=input.category,unit=input.unit;
 if(!['raw','finished'].includes(category)||!inventoryUnits.includes(unit))throw new HttpError(400,'Catégorie ou unité invalide');
 const threshold=input.threshold==null||input.threshold===''?null:quantity(input.threshold,unit,{zero:true});
 const archived=input.archived===true?1:0;const now=new Date().toISOString();let statement;
 if(id){uid(id);const version=integer(input.version);statement=db.prepare('UPDATE sp_references SET name=?,category=?,unit=?,threshold=?,archived=?,version=version+1 WHERE id=? AND version=?').bind(name,category,unit,threshold,archived,id,version);}
 else{id=crypto.randomUUID();statement=db.prepare('INSERT INTO sp_references(id,name,category,unit,threshold,created_at,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,name,category,unit,threshold,now,actor.id);}
 const results=await db.batch([statement,db.prepare("INSERT INTO sp_access_audit(id,actor,target,details,created_at) SELECT ?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),actor.id,id,JSON.stringify({action:input.version?'reference_update':'reference_create',name,category,unit,threshold,archived}),now)]);
 if(results[0].meta.changes<1)throw new HttpError(409,'Référence modifiée ailleurs. Actualisez.');return publicReference(await reference(db,id,actor));
}
export async function recordMovement(db,actor,input){
 const key=uid(input.request_key),correctionId=input.correction_of?uid(input.correction_of):null;
 let original=null,kind=input.kind,referenceId=input.reference_id,amount,direction,lotCode=optional(input.lot_code,120),supplier=optional(input.supplier,160),occurredOn=input.occurred_on?date(input.occurred_on):new Date().toISOString().slice(0,10),comment=optional(input.comment,1000);
 if(correctionId){requireAdmin(actor);original=await db.prepare('SELECT * FROM sp_movements WHERE id=?').bind(correctionId).first();if(!original||original.correction_of)throw new HttpError(400,'Mouvement d’origine requis');if(!comment)throw new HttpError(400,'Motif de correction obligatoire');kind='correction';referenceId=original.reference_id;amount=original.quantity;direction=-original.direction;lotCode=original.lot_code;supplier=original.supplier;occurredOn=original.occurred_on;}
 else{if(!kinds[kind])throw new HttpError(400,'Type de mouvement invalide');allowed(actor,kind);}
 const ref=await reference(db,referenceId,actor);
 if(!original){if(ref.category!==kinds[kind][0])throw new HttpError(400,'Catégorie incompatible');amount=quantity(input.quantity,ref.unit);direction=kinds[kind][1];}
 const payload=JSON.stringify({referenceId,kind,amount,direction,lotCode,supplier,occurredOn,comment,correctionId});
 const prior=await db.prepare('SELECT * FROM sp_movements WHERE request_key=?').bind(key).first();
 if(prior){if(prior.actor!==actor.id||prior.payload!==payload)throw new HttpError(409,'Cette validation a déjà été utilisée pour un autre mouvement');return {movement:publicMovement(prior),replayed:true};}
 if(ref.archived&&!original)throw new HttpError(409,'Référence archivée');
 const id=crypto.randomUUID(),now=new Date().toISOString(),batch=[];let snapshotSupplier=supplier;let lotId=original?.lot_id||null;
 if(lotCode&&!original){const existing=await db.prepare('SELECT * FROM sp_lots WHERE reference_id=? AND code=?').bind(ref.id,lotCode).first();
 if(!existing){if(direction<0)throw new HttpError(400,'Lot inconnu : choisissez un lot déjà réceptionné ou fabriqué');lotId=crypto.randomUUID();batch.push(db.prepare('INSERT OR IGNORE INTO sp_lots(id,reference_id,code,supplier,created_at,created_by) VALUES(?,?,?,?,?,?)').bind(lotId,ref.id,lotCode,supplier,now,actor.id));}
 else{if(supplier&&supplier!==existing.supplier)throw new HttpError(409,'Ce lot possède un autre fournisseur. Utilisez une référence de lot distincte.');lotId=existing.id;snapshotSupplier=existing.supplier;}
 }
 // INSERT reads the balance inside the transaction, never from a stale client snapshot.
 // The ledger trigger validates it and applies the new balance atomically on D1.
 const lotExpression=lotCode?'(SELECT id FROM sp_lots WHERE reference_id=? AND code=?)':'NULL';
 const values=[id,key,payload,kind,direction,amount,amount,direction,actor.id,actor.name,actor.role,now,occurredOn];
 if(lotCode)values.push(ref.id,lotCode);values.push(lotCode,snapshotSupplier,comment,correctionId,ref.id);
 batch.push(db.prepare(`INSERT INTO sp_movements(id,request_key,payload,reference_id,reference_name,category,unit,kind,direction,quantity,before_quantity,after_quantity,actor,actor_name,actor_role,created_at,occurred_on,lot_id,lot_code,supplier,comment,correction_of)
 SELECT ?,?,?,r.id,r.name,r.category,r.unit,?,?,?,b.quantity,b.quantity+?*?,?,?,?,?,?,${lotExpression},?,?,?,? FROM sp_references r JOIN sp_balances b ON b.reference_id=r.id WHERE r.id=?`).bind(...values));
 try{await db.batch(batch);}catch(error){
 const existing=await db.prepare('SELECT * FROM sp_movements WHERE request_key=?').bind(key).first();if(existing&&existing.actor===actor.id&&existing.payload===payload)return {movement:publicMovement(existing),replayed:true};
 if(/constraint|sp balance|sp whole|sp invalid|sp forbidden/i.test(String(error)))throw new HttpError(409,'Mouvement refusé : stock insuffisant, correction déjà effectuée ou données modifiées. Actualisez.');throw error;
 }
 return {movement:publicMovement(await db.prepare('SELECT * FROM sp_movements WHERE id=?').bind(id).first()),replayed:false};
}
function csvCell(value){const s=String(value??'');return '"'+(/^[\s]*[=+\-@]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';}
export async function inventoryAPI(request,env,actor,readBody){
 const db=env.DB;if(!db)throw new HttpError(503,'Base de données non configurée');
 const url=new URL(request.url),path=url.pathname.slice('/admin/api/inventory'.length),method=request.method;
 if(method!=='GET')checkOrigin(request);
 const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 if(path==='/me'&&method==='GET')return json(actor);
 if(path==='/references'&&method==='GET'){
 const f=filters(url.searchParams,actor),offset=integer(Number(url.searchParams.get('offset')||0));
 const rows=await db.prepare(refSelect+f.where+' ORDER BY r.name COLLATE NOCASE,r.id LIMIT 100 OFFSET ?').bind(...f.values,offset).all();const count=await db.prepare('SELECT COUNT(*) AS count FROM sp_references r'+f.where).bind(...f.values).first();return json({items:rows.results.map(publicReference),total:count.count});}
 if(path==='/references'&&method==='POST')return json(await saveReference(db,actor,await readBody(request)),201);
 if(path.startsWith('/references/')&&method==='PUT')return json(await saveReference(db,actor,await readBody(request),path.slice(12)));
 if(path==='/lots'&&method==='GET'){
 const ref=await reference(db,url.searchParams.get('reference'),actor);const rows=await db.prepare('SELECT l.*,COALESCE(SUM(m.direction*m.quantity),0) AS declared_quantity FROM sp_lots l LEFT JOIN sp_movements m ON m.lot_id=l.id WHERE l.reference_id=? GROUP BY l.id ORDER BY l.created_at DESC LIMIT 200').bind(ref.id).all();return json({items:rows.results.map(l=>({...l,declared_quantity:quantityString(l.declared_quantity)}))});}
 if(path==='/movements'&&method==='POST')return json(await recordMovement(db,actor,await readBody(request)),201);
 if((path==='/movements'||path==='/export')&&method==='GET'){
 requireAdmin(actor);const f=filters(url.searchParams,actor,{movement:true});const exportCSV=path==='/export';const offset=exportCSV?0:integer(Number(url.searchParams.get('offset')||0));
 const rows=await db.prepare('SELECT m.*,c.id AS corrected_by FROM sp_movements m LEFT JOIN sp_movements c ON c.correction_of=m.id'+f.where+' ORDER BY m.created_at DESC,m.id DESC LIMIT ? OFFSET ?').bind(...f.values,exportCSV?10001:50,offset).all();
 if(exportCSV){if(rows.results.length>10000)throw new HttpError(400,'Plus de 10 000 mouvements : réduisez la période pour exporter sans perte.');const cols=['id','reference_id','reference_name','category','kind','direction','quantity','unit','created_at','occurred_on','actor','actor_name','before_quantity','after_quantity','lot_code','supplier','comment','correction_of','corrected_by'];const lines=[cols,...rows.results.map(publicMovement).map(m=>cols.map(k=>m[k]))];return new Response('\ufeff'+lines.map(row=>row.map(csvCell).join(';')).join('\r\n'),{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="apg-mouvements.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 const count=await db.prepare('SELECT COUNT(*) AS count FROM sp_movements m'+f.where).bind(...f.values).first();return json({items:rows.results.map(publicMovement),total:count.count});}
 if(path==='/dashboard'&&method==='GET'){
 const stockFilters=filters(url.searchParams,actor);
 const stocks=await db.prepare(`SELECT r.category,r.unit,COUNT(*) AS references_count,SUM(b.quantity) AS quantity,SUM(CASE WHEN r.threshold IS NOT NULL AND b.quantity<=r.threshold THEN 1 ELSE 0 END) AS low_count FROM sp_references r JOIN sp_balances b ON b.reference_id=r.id${stockFilters.where} GROUP BY r.category,r.unit`).bind(...stockFilters.values).all();
 const low=await db.prepare(refSelect+stockFilters.where+' AND r.threshold IS NOT NULL AND b.quantity<=r.threshold ORDER BY r.name LIMIT 100').bind(...stockFilters.values).all();
 const f=filters(url.searchParams,actor,{movement:true});const totals=await db.prepare(`SELECT m.category,m.unit,SUM(CASE WHEN m.direction=1 THEN m.quantity ELSE 0 END) AS entered,SUM(CASE WHEN m.direction=-1 THEN m.quantity ELSE 0 END) AS exited,SUM(CASE WHEN m.kind='production_in' THEN m.quantity WHEN m.kind='correction' AND m.category='finished' AND m.direction=-1 THEN -m.quantity ELSE 0 END) AS produced FROM sp_movements m${f.where} GROUP BY m.category,m.unit`).bind(...f.values).all();
 return json({stocks:stocks.results.map(s=>({...s,quantity:quantityString(s.quantity)})),low:low.results.map(publicReference),totals:totals.results.map(t=>({...t,entered:quantityString(t.entered),exited:quantityString(t.exited),produced:quantityString(t.produced)}))});}
 if(path==='/production'&&method==='GET'){
 const params=new URLSearchParams(url.searchParams);params.set('category','finished');const f=filters(params,actor,{movement:true});
 // Select groups by the chosen period; balances include their entire retained history.
 const rows=await db.prepare(`WITH selected AS (SELECT DISTINCT m.reference_id,m.lot_id FROM sp_movements m${f.where}) SELECT r.id,r.name,r.unit,l.id AS lot_id,COALESCE(l.code,'Sans lot') AS lot_code,MIN(CASE WHEN m.kind='production_in' THEN m.occurred_on END) AS first_production,MAX(CASE WHEN m.kind='production_in' THEN m.occurred_on END) AS last_production,SUM(CASE WHEN m.kind='production_in' THEN m.quantity WHEN m.kind='correction' AND m.direction=-1 THEN -m.quantity ELSE 0 END) AS produced,SUM(CASE WHEN m.kind='production_out' THEN m.quantity WHEN m.kind='correction' AND m.direction=1 THEN -m.quantity ELSE 0 END) AS taken,SUM(m.direction*m.quantity) AS quantity FROM selected s JOIN sp_references r ON r.id=s.reference_id JOIN sp_movements m ON m.reference_id=s.reference_id AND m.lot_id IS s.lot_id LEFT JOIN sp_lots l ON l.id=s.lot_id GROUP BY r.id,m.lot_id ORDER BY last_production DESC,r.name LIMIT 201`).bind(...f.values).all();return json({items:rows.results.slice(0,200).map(r=>({...r,produced:quantityString(r.produced),taken:quantityString(r.taken),quantity:quantityString(r.quantity)})),has_more:rows.results.length>200});}
 if(path==='/users'&&method==='GET'){requireAdmin(actor);const rows=await db.prepare('SELECT * FROM sp_users ORDER BY name').all();return json({items:rows.results});}
 if(path==='/users'&&method==='PUT'){
 requireAdmin(actor);const input=await readBody(request),id=text(input.user_id,200),name=text(input.name,100),role=input.role,active=input.active===false?0:1,version=integer(input.version||0);if(!['laboratory','shop'].includes(role))throw new HttpError(400,'Profil Laboratoire ou Boutique requis');const now=new Date().toISOString();
 const stmt=version===0?db.prepare('INSERT INTO sp_users(user_id,name,role,active,updated_at,updated_by) VALUES(?,?,?,?,?,?)').bind(id,name,role,active,now,actor.id):db.prepare('UPDATE sp_users SET name=?,role=?,active=?,version=version+1,updated_at=?,updated_by=? WHERE user_id=? AND version=?').bind(name,role,active,now,actor.id,id,version);
 const result=await db.batch([stmt,db.prepare('INSERT INTO sp_access_audit(id,actor,target,details,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor.id,id,JSON.stringify({role,name,active}),now)]);if(result[0].meta.changes!==1)throw new HttpError(409,'Accès modifié ailleurs. Actualisez.');return json({ok:true});}
 throw new HttpError(405,'Route ou méthode Stocks & Production refusée');
}
