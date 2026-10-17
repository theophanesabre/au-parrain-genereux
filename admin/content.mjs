import { builtinPages } from '../data/site-content.mjs';
import { HttpError } from './core.mjs';
export const contentFormat='site-fields-v1';
export const pageDefinition=id=>builtinPages.find(page=>page.id===id);
export function contentValues(definition,body) {
  const defaults=Object.fromEntries(definition.fields.map(field=>[field.key,field.value]));
  try {const parsed=JSON.parse(body);if(parsed.format===contentFormat && parsed.fields && typeof parsed.fields==='object')return {...defaults,...Object.fromEntries(Object.entries(parsed.fields).filter(([key,value])=>key in defaults && typeof value==='string'))};}catch{}
  return defaults;
}
export function validatePageBody(id,body) {
  const definition=pageDefinition(id);if(!definition)return body;
  let parsed;try{parsed=JSON.parse(body);}catch{throw new HttpError(400,'Contenu de page invalide');}
  if(!parsed || parsed.format!==contentFormat || !parsed.fields || Array.isArray(parsed.fields) || typeof parsed.fields!=='object')throw new HttpError(400,'Contenu de page invalide');
  const allowed=new Set(definition.fields.map(field=>field.key));
  for(const [key,value] of Object.entries(parsed.fields)) {
    if(!allowed.has(key) || typeof value!=='string' || value.length>6000)throw new HttpError(400,'Champ de page invalide');
    if(key==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new HttpError(400,'Adresse courriel invalide');
    if(key==='phone' && !/^\+?[\d ().-]{6,30}$/.test(value))throw new HttpError(400,'Téléphone invalide');
  }
  return JSON.stringify({format:contentFormat,fields:contentValues(definition,body)});
}
export function adminPage(definition,stored) {
  const values=contentValues(definition,stored?.body);
  return {...stored,id:definition.id,title:stored?.title||definition.title,path:definition.path,builtin:true,published:stored?.published??1,version:stored?.version??0,body:stored?.body||JSON.stringify({format:contentFormat,fields:values}),fields:definition.fields.map(field=>({...field,value:values[field.key]}))};
}
