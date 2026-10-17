import { visualHref } from './visual.mjs';
import { defaultVisual, validateVisual } from './visual.mjs';
import { highlightHref } from './highlights.mjs';
import { text, HttpError } from './core.mjs';
export const homeSections=[['spotlight','Bandeau principal'],['news','Nouveautés'],['visit','Nous trouver'],['history','Histoire de la maison'],['chapters','Découvrir la maison'],['collection','Collection de chocolats']];
export const defaultNavigation={groupLabel:'La maison',items:[{label:'La maison',href:'/maison',group:true},{label:'Savoir-faire',href:'/savoir-faire',group:true},{label:'Nos recettes',href:'/bonbons',group:true},{label:'Boutique en ligne',href:'/boutique',group:false},{label:'Nous trouver',href:'/#nous-trouver',group:false}]};
export const defaultAppearance={navigation:defaultNavigation,background:'cream',spacing:'airy',buttons:'filled',corners:'soft',hero:'image-left',columns:'3',historyLabel:'Découvrir notre histoire',historyHref:'/maison',collectionLabel:'Voir les bonbons',collectionHref:'/bonbons',customButtons:[],visual:defaultVisual,sections:homeSections.map(([id])=>({id,visible:true}))};
export function validateAppearance(value){
 if(!value||typeof value!=='object')throw new HttpError(400,'Réglages invalides');
 const choices={background:['cream','white'],spacing:['airy','compact'],buttons:['filled','outline'],corners:['square','soft','round'],hero:['image-left','image-right'],columns:['2','3','4']};
 const result={...defaultAppearance};const navigation=value.navigation??defaultNavigation;if(!navigation||!Array.isArray(navigation.items)||navigation.items.length>20)throw new HttpError(400,'Menu invalide');result.navigation={groupLabel:text(navigation.groupLabel,80),items:navigation.items.map(item=>{if(!item||typeof item.group!=='boolean')throw new HttpError(400,'Groupe de menu invalide');return {label:text(item.label,80),href:visualHref(item.href),group:item.group};})};for(const [key,allowed] of Object.entries(choices)){if(!allowed.includes(value[key]))throw new HttpError(400,'Réglage invalide : '+key);result[key]=value[key];}
 for(const prefix of ['history','collection']){result[prefix+'Label']=text(value[prefix+'Label'],80);result[prefix+'Href']=highlightHref(value[prefix+'Href']);}
 if(!Array.isArray(value.sections)||value.sections.length!==homeSections.length)throw new HttpError(400,'Sections invalides');
 const ids=new Set(homeSections.map(([id])=>id)),seen=new Set();
 result.sections=value.sections.map(section=>{if(!section||!ids.has(section.id)||seen.has(section.id)||typeof section.visible!=='boolean')throw new HttpError(400,'Section invalide');seen.add(section.id);return {id:section.id,visible:section.visible};});
 const buttons=value.customButtons??[];
 if(!Array.isArray(buttons)||buttons.length>30)throw new HttpError(400,'Maximum 30 boutons personnalisés');
 const buttonIds=new Set();
 result.customButtons=buttons.map(button=>{
  if(!button||typeof button.id!=='string'||!/^[a-z0-9-]{1,80}$/.test(button.id)||buttonIds.has(button.id))throw new HttpError(400,'Identifiant de bouton invalide');buttonIds.add(button.id);
  if(!['/','/bonbons','/boutique','/maison','/savoir-faire','/panier'].includes(button.page))throw new HttpError(400,'Page du bouton invalide');
  const locations=['page-top','page-bottom',...(button.page==='/'?homeSections.map(([id])=>id):[])];
  if(!locations.includes(button.location)||!['before','after'].includes(button.position)||!['left','center','right'].includes(button.align)||!['filled','outline','text'].includes(button.style)||!['regular','large'].includes(button.size)||typeof button.visible!=='boolean')throw new HttpError(400,'Emplacement ou style du bouton invalide');
  return {id:button.id,label:text(button.label,80),href:highlightHref(button.href),page:button.page,location:button.location,position:button.position,align:button.align,style:button.style,size:button.size,visible:button.visible};
 });
 if(!result.sections.some(section=>section.visible))throw new HttpError(400,'Conservez au moins une section visible');
 result.visual=validateVisual(value.visual);
 if(value.visual===undefined&&value.background==='white')result.visual.surface='#ffffff';
 if(JSON.stringify(result).length>60000)throw new HttpError(400,'Personnalisation trop volumineuse : réduisez le nombre de modifications');
 return result;
}
export function appearanceValues(body){try{return validateAppearance(JSON.parse(body));}catch{return defaultAppearance;}}
