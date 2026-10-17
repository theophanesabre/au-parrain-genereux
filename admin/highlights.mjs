import { HttpError, integer, text, imagePath } from './core.mjs';
export const defaultHighlights = [
  {"id": "calendrier-conte-avent", "placement": "hero", "title": "Le Conte de l’Avent", "description": "24 bonbons en chocolat.", "kicker": "Calendrier de l’Avent", "image": "/images/calendrier-conte-avent.jpg", "alt": "Le Conte de l’Avent du Parrain Généreux, calendrier et ses 24 cases de chocolats", "href": "/boutique", "button_label": "Voir la boutique en ligne", "image_fit": "contain", "position": 0, "published": 1, "version": 0},
  {id:'maison-collection',placement:'hero',kicker:'Chocolatier · Confiseur',title:'Les bonbons de la maison.',description:'Pralinés, gianduja et recettes maison : entrez dans notre collection de chocolats.',image:'/images/bonbons-editorial-deep.webp',alt:'Collection de bonbons de chocolat de la maison',image_fit:'cover',button_label:'Découvrir les chocolats',href:'/bonbons',position:1,published:1,version:0},
  {id:'maison-histoire',placement:'hero',kicker:'Au Havre depuis 1890',title:'Le chocolat en héritage.',description:'Une histoire havraise, des recettes transmises et le goût du travail bien fait.',image:'/images/boutique-historique.jpeg',alt:'La boutique historique Au Parrain Généreux',image_fit:'cover',button_label:'Rencontrer la maison',href:'/maison',position:2,published:1,version:0},
  {id:'decouverte-buchette',placement:'news',kicker:'La collection maison',title:'La Bûchette',description:'Pâte d’amande et praliné maison, enrobés de chocolat noir ou au lait.',image:'/images/bonbons-ia-basse-def/1.png',alt:'Bûchette, bonbon de chocolat de la maison',image_fit:'contain',button_label:'Découvrir la recette',href:'/bonbons#bonbon-1',position:1,published:1,version:0},
  {id:'decouverte-feuilletine',placement:'news',kicker:'À découvrir',title:'La Feuilletine',description:'Biscuit dentelle au beurre et praliné, enrobés de chocolat noir ou au lait.',image:'/images/bonbons-ia-basse-def/9.png',alt:'Feuilletine, bonbon de chocolat de la maison',image_fit:'contain',button_label:'Découvrir la recette',href:'/bonbons#bonbon-9',position:2,published:1,version:0},
  {id:'decouverte-pecan',placement:'news',kicker:'Une recette de la maison',title:'Le Praliné pécan',description:'Praliné lisse de noix de pécan, enrobé de chocolat au lait ou noir.',image:'/images/bonbons-ia-basse-def/15.png',alt:'Praliné pécan, bonbon de chocolat de la maison',image_fit:'contain',button_label:'Découvrir la recette',href:'/bonbons#bonbon-15',position:3,published:1,version:0},
];
export const isDefaultHighlight=id=>defaultHighlights.some(item=>item.id===id);
export function mergeHighlights(rows) {
  const merged=new Map(defaultHighlights.map(item=>[item.id,{...item,builtin:true}]));
  for(const row of rows)merged.set(row.id,{...row,builtin:isDefaultHighlight(row.id)});
  return [...merged.values()].sort((a,b)=>a.placement.localeCompare(b.placement)||a.position-b.position||a.id.localeCompare(b.id));
}
export function highlightHref(value) {
  if(typeof value!=='string'||value.length>500||!value.startsWith('/')||/[\\\u0000-\u0020]/.test(value))throw new HttpError(400,'Lien interne attendu, par exemple /bonbons');
  const url=new URL(value,'https://site.local');
  if(url.origin!=='https://site.local'||/^\/(?:admin|signin-with-chatgpt|signout-with-chatgpt|callback)(?:\/|$)/.test(url.pathname))throw new HttpError(400,'Lien public du site attendu');
  return url.pathname+url.search+url.hash;
}
export function validateHighlight(data) {
  if(!data || !['hero','news'].includes(data.placement))throw new HttpError(400,'Choisissez Bandeau principal ou Nouveautés');
  if(!['cover','contain'].includes(data.image_fit))throw new HttpError(400,'Cadrage invalide');
  if(typeof data.published!=='boolean')throw new HttpError(400,'Publication invalide');
  const optional=(value,max)=>{if(typeof value!=='string'||value.length>max)throw new HttpError(400,'Texte invalide');return value.trim();};
  const image=imagePath(data.image);if(!image)throw new HttpError(400,'Choisissez une image');
  return {placement:data.placement,kicker:optional(data.kicker,100),title:text(data.title,160),description:optional(data.description,1200),image,alt:text(data.alt,300),image_fit:data.image_fit,button_label:text(data.button_label,60),href:highlightHref(data.href),position:integer(data.position,9999),published:data.published?1:0};
}
