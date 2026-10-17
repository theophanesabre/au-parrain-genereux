import { HttpError, imagePath, text } from './core.mjs';
export const visualPages={
 '/':[['spotlight','Bandeau'],['news','Nouveautés'],['visit','Nous trouver'],['history','Histoire'],['chapters','Rubriques'],['collection','Collection']],
 '/maison':[['intro','Présentation'],['signature','Signature de la maison']],
 '/savoir-faire':[['intro','Présentation'],['process','Les gestes'],['workshop','L’atelier']],
 '/bonbons':[['intro','Présentation'],['shop','Lien boutique'],['recipes','Recettes']],
 '/boutique':[['intro','Présentation'],['catalog','Articles']],
 '/panier':[['intro','Présentation'],['cart','Panier']],
};
export const defaultVisual={accent:'#FF6A00',surface:'#f7f4ed',ink:'#30271f',font:'classic',scale:100,icons:false,layouts:Object.fromEntries(Object.entries(visualPages).filter(([page])=>page!=='/').map(([page,sections])=>[page,sections.map(([id])=>({id,visible:true}))])),blocks:[],overrides:[]};
const fail=message=>{throw new HttpError(400,message);};
const number=(value,min,max)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail('Dimension invalide');return value;};
const option=(value,allowed)=>{if(!allowed.includes(value))fail('Option visuelle invalide');return value;};
const color=value=>{if(typeof value!=='string'||!/^#[a-fA-F0-9]{6}$/.test(value))fail('Couleur invalide');return value;};
const string=(value,max)=>{if(typeof value!=='string'||value.length>max)fail('Texte invalide');return value;};
export function visualHref(value){
 string(value,500);if(/[\u0000-\u0020\\]/.test(value))fail('Lien invalide');
 if(value.startsWith('/')&&!value.startsWith('//')){const url=new URL(value,'https://site.local');if(/^\/(admin|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname))fail('Lien public requis');return url.pathname+url.search+url.hash;}
 if(/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||/^tel:\+?[0-9().-]{6,30}$/.test(value))return value;
 try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}
 fail('Utilisez un lien de page, https, courriel ou téléphone');
}
export function validateVisualStyle(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('Style invalide');const result={};
 const dimensions={fontSize:[8,140],lineHeight:[1,3],paddingTop:[0,240],paddingRight:[0,240],paddingBottom:[0,240],paddingLeft:[0,240],marginTop:[0,240],marginBottom:[0,240],gap:[0,120],borderRadius:[0,150],maxWidth:[100,2400],minHeight:[0,1600],width:[5,100],columns:[1,4]};
 for(const [key,v] of Object.entries(value)){
  if(Object.hasOwn(dimensions,key)){if(key==='columns'&&!Number.isInteger(v))fail('Nombre de colonnes invalide');result[key]=number(v,...dimensions[key]);}
  else if(['color','backgroundColor','borderColor'].includes(key))result[key]=color(v);
  else if(key==='textAlign')result[key]=option(v,['left','center','right']);
  else if(key==='font')result[key]=option(v,['classic','modern','editorial']);
  else if(key==='layout')result[key]=option(v,['original','row','column','grid']);
  else if(key==='objectFit')result[key]=option(v,['cover','contain']);
  else if(key==='objectPosition')result[key]=option(v,['left','center','right']);
  else fail('Propriété visuelle non autorisée');
 }
 return result;
}
/** @returns {import('../components/visual-types').VisualSettings} */
export function validateVisual(value){
 if(value===undefined)return structuredClone(defaultVisual);
 if(!value||typeof value!=='object'||Array.isArray(value))fail('Personnalisation invalide');
 const result={accent:color(value.accent),surface:color(value.surface),ink:color(value.ink),font:option(value.font,['classic','modern','editorial']),scale:number(value.scale,75,140),icons:value.icons,layouts:{},blocks:[],overrides:[]};
 if(typeof value.icons!=='boolean')fail('Option d’icônes invalide');
 for(const [page,definitions] of Object.entries(visualPages)){if(page==='/')continue;const items=value.layouts?.[page]??defaultVisual.layouts[page];if(!Array.isArray(items)||items.length!==definitions.length)fail('Mise en page invalide');const seen=new Set();result.layouts[page]=items.map(item=>{if(!item||!definitions.some(([id])=>id===item.id)||seen.has(item.id)||typeof item.visible!=='boolean')fail('Bloc de page invalide');seen.add(item.id);return {id:item.id,visible:item.visible};});if(!result.layouts[page].some(item=>item.visible))fail('Conservez un bloc visible par page');}
 if(!Array.isArray(value.blocks)||value.blocks.length>60||!Array.isArray(value.overrides)||value.overrides.length>200)fail('Trop de personnalisations');
 const ids=new Set();
 for(const block of value.blocks){if(!block||typeof block.id!=='string'||!/^[a-z0-9-]{1,80}$/.test(block.id)||ids.has(block.id))fail('Bloc ajouté invalide');ids.add(block.id);if(!Object.hasOwn(visualPages,block.page)||!['page-top','page-bottom',...visualPages[block.page].map(([id])=>id)].includes(block.anchor))fail('Emplacement invalide');
  const kind=option(block.kind,['text','image','button','spacer']);const item={id:block.id,page:block.page,anchor:block.anchor,position:option(block.position,['before','after']),kind,visible:block.visible,title:string(block.title,160),body:string(block.body,6000),image:block.image?imagePath(block.image):'',alt:string(block.alt,300),label:string(block.label,80),href:block.href?visualHref(block.href):'',style:validateVisualStyle(block.style)};
  if(typeof item.visible!=='boolean'||(kind==='image'&&(!item.image||!item.alt.trim()))||(kind==='button'&&(!item.label.trim()||!item.href)))fail('Complétez le contenu du bloc');result.blocks.push(item);
 }
 ids.clear();for(const entry of value.overrides){if(!entry||!Object.hasOwn(visualPages,entry.page)||typeof entry.id!=='string'||!/^[a-z0-9:/_-]{1,400}$/.test(entry.id)||ids.has(entry.page+'|'+entry.id))fail('Élément visuel invalide');ids.add(entry.page+'|'+entry.id);
  const item={page:entry.page,id:entry.id,style:validateVisualStyle(entry.style)};
  if(entry.text!==undefined)item.text=string(entry.text,6000);if(entry.href!==undefined)item.href=visualHref(entry.href);if(entry.image!==undefined)item.image=imagePath(entry.image);if(entry.alt!==undefined)item.alt=string(entry.alt,300);if(entry.hidden!==undefined){if(typeof entry.hidden!=='boolean')fail('Visibilité invalide');item.hidden=entry.hidden;}result.overrides.push(item);
 }
 return result;
}
