import { HttpError, imagePath } from './core.mjs';
import { visualHref } from './visual.mjs';
export const puckPaths=['/','/maison','/savoir-faire','/bonbons','/chocolats','/boutique','/panier'];
export const blockStyle={background:'',color:'',padding:32,paddingX:28,margin:0,radius:0,maxWidth:1200,align:'left',font:'inherit',size:18,gap:24,width:100,minHeight:0,visualHeight:0,visualBackground:''};
export const puckDefaults={
 Coordonnees:{name:'Au Parrain Généreux',address:'123 rue Maréchal Joffre · 76600 Le Havre',hours:'Mardi — Samedi · 9h–12h · 14h–19h',phone:'02 35 42 32 75',email:'genereuxparrain@gmail.com',style:{...blockStyle,padding:0,paddingX:0}},
 CompositionLibre:{height:560,items:[],style:{...blockStyle,padding:0,paddingX:0}},
 Galerie:{images:[],columns:3,mobileColumns:1,height:280,style:{...blockStyle}},
 Texte:{title:'Votre titre',body:'Votre texte de présentation.',level:'h2',style:{...blockStyle}},
 Image:{src:'/images/boutique-historique.jpeg',alt:'La maison Au Parrain Généreux',caption:'',fit:'contain',height:420,style:{...blockStyle}},
 Bouton:{label:'Découvrir',href:'/boutique',variant:'filled',style:{...blockStyle}},
 Espace:{height:48,style:{...blockStyle,padding:0}},
 Section:{children:[],style:{...blockStyle}},
 Colonnes:{columns:2,mobileColumns:1,children:[],style:{...blockStyle}},
 Bandeau:{source:'manual',items:[],style:{...blockStyle,padding:0,paddingX:0,maxWidth:2000}},
 Nouveautes:{source:'manual',title:'Nouveautés & découvertes',intro:'Les créations de la maison.',kicker:'À découvrir',items:[],style:{...blockStyle,padding:0,paddingX:0}},
 Liens:{title:'Découvrir la maison',items:[{label:'La boutique',text:'Nos articles maison',href:'/boutique'}],style:{...blockStyle}},
 Catalogue:{title:'Les articles de la maison',style:{...blockStyle,padding:0,paddingX:0,maxWidth:2000}},
 Recettes:{title:'Nos recettes',style:{...blockStyle,padding:0,paddingX:0,maxWidth:2000}},
 Panier:{style:{...blockStyle,padding:0,paddingX:0,maxWidth:2000}},
};
export const puckRoot={maisonCombined:false,themeVersion:2,pattern:'inherit',stripeColor:'#f5e6da',stripeWidth:38,stripeAngle:90,background:'#f7f4ed',textColor:'#30271f',accent:'#FF6A00',font:'classic',showHeader:'oui',showFooter:'oui',logo:'/images/logo-boutique-neon.webp',logoWidth:100,headerBackground:'#fffdf8',footerBackground:'#fffdf8',footerTitle:'Une chocolaterie havraise',footerText:'Au Parrain Généreux, depuis 1890.',address:'123 rue Maréchal Joffre · Le Havre',hours:'',phone:'',email:'',menu:[{label:'Chocolats',href:'/bonbons'},{label:'Boutique',href:'/boutique'},{label:'La maison',href:'/maison'},{label:'Savoir-faire',href:'/savoir-faire'},{label:'Nous trouver',href:'/#nous-trouver'}]};
const fail=message=>{throw new HttpError(400,message);};
const string=(v,max=6000)=>{if(typeof v!=='string'||v.length>max)fail('Texte Puck invalide');return v;};
const choice=(v,allowed)=>{if(!allowed.includes(v))fail('Option Puck invalide');return v;};
const number=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail('Dimension Puck invalide');return v;};
const color=(v,optional=false)=>{if(optional&&v==='')return v;if(typeof v!=='string'||!/^#[a-fA-F0-9]{6}$/.test(v))fail('Couleur Puck invalide');return v;};
function style(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(blockStyle,key)&&key!=='mobile'))fail('Style Puck invalide');value={...blockStyle,...value};const mobile=value.mobile??{};if(!mobile||typeof mobile!=='object'||Array.isArray(mobile))fail('Réglages mobiles invalides');const mobileResult={};for(const [key,v] of Object.entries(mobile)){const ranges={width:[5,100],minHeight:[0,1600],padding:[0,200],paddingX:[0,200],margin:[0,200],gap:[0,120],radius:[0,120],size:[10,100],imageHeight:[80,1200]};if(key==='align')mobileResult[key]=choice(v,['left','center','right']);else if(['background','color'].includes(key))mobileResult[key]=color(v,true);else if(Object.hasOwn(ranges,key))mobileResult[key]=number(v,...ranges[key]);else fail('Réglage mobile inconnu');}return {...(Object.keys(mobileResult).length?{mobile:mobileResult}:{}),width:number(value.width,5,100),minHeight:number(value.minHeight,0,1600),visualHeight:number(value.visualHeight,0,1200),visualBackground:color(value.visualBackground,true),background:color(value.background,true),color:color(value.color,true),padding:number(value.padding,0,200),paddingX:number(value.paddingX,0,200),margin:number(value.margin,0,200),radius:number(value.radius,0,120),maxWidth:number(value.maxWidth,320,2400),align:choice(value.align,['left','center','right']),font:choice(value.font,['inherit','classic','modern','editorial']),size:number(value.size,10,100),gap:number(value.gap,0,120)};}
function links(items){if(!Array.isArray(items)||items.length>30)fail('Liste de liens invalide');return items.map(item=>({label:string(item.label,100),text:item.text===undefined?'':string(item.text,1200),href:visualHref(item.href)}));}
function slides(items){if(!Array.isArray(items)||items.length>30)fail('Liste de visuels invalide');return items.map(item=>({title:string(item.title,160),description:string(item.description,1200),kicker:string(item.kicker,100),image:imagePath(item.image),alt:string(item.alt,300),href:visualHref(item.href),button_label:string(item.button_label,80),image_fit:choice(item.image_fit,['cover','contain'])}));}
export function validatePuckData(data){
 if(!data||typeof data!=='object'||!Array.isArray(data.content)||!data.root?.props)fail('Page Puck invalide');const input=data.root.props;
 const root={...puckRoot};if(input.maisonCombined!==undefined&&typeof input.maisonCombined!=='boolean')fail('Option de page invalide');root.maisonCombined=input.maisonCombined??false;root.themeVersion=2;root.pattern=choice(input.themeVersion===undefined&&input.pattern!=='stripes'?'inherit':input.pattern??'inherit',['inherit','plain','stripes']);root.stripeColor=color(input.stripeColor??puckRoot.stripeColor);root.stripeWidth=number(input.stripeWidth??38,2,200);root.stripeAngle=number(input.stripeAngle??90,0,180);for(const key of ['background','textColor','accent','headerBackground','footerBackground'])root[key]=color(input[key]);root.font=choice(input.font,['classic','modern','editorial']);root.showHeader=choice(input.showHeader,['oui','non']);root.showFooter=choice(input.showFooter,['oui','non']);root.logo=imagePath(input.logo);root.logoWidth=number(input.logoWidth,50,240);for(const key of ['footerTitle','footerText','address','hours','phone','email'])root[key]=string(input[key],key==='footerText'?6000:500);root.menu=links(input.menu).map(({label,href})=>({label,href}));
 const ids=new Set();let total=0;
 // Upgrade only the old complete contact paragraph; unrelated editorial text is untouched.
 function upgradeContact(item){const p=item?.props;if(item?.type!=='Texte'||!p?.body||![root.address,root.phone,root.email].every(value=>value&&p.body.includes(value)))return item;return {type:'Coordonnees',props:{id:p.id,name:'Au Parrain Généreux',address:root.address,hours:root.hours,phone:root.phone,email:root.email,style:{...p.style,padding:0,paddingX:0}}};}
 function content(items,depth=0){if(!Array.isArray(items)||depth>8)fail('Imbrication de blocs trop importante');return items.map(original=>{const item=upgradeContact(original);if(++total>200||!item||!Object.hasOwn(puckDefaults,item.type))fail('Bloc Puck inconnu ou limite de 200 blocs atteinte');const p=item.props;if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(p.id)||ids.has(p.id))fail('Identifiant de bloc Puck invalide');ids.add(p.id);if(Object.keys(p).some(key=>key!=='id'&&!Object.hasOwn(puckDefaults[item.type],key)))fail('Propriété de bloc non autorisée');const result={id:p.id,style:style(p.style)};
  if(item.type==='Coordonnees'){for(const key of ['name','address','hours','phone','email'])result[key]=string(p[key],500);}
  if(item.type==='Texte'){result.title=string(p.title,300);result.body=string(p.body,12000);result.level=choice(p.level,['h1','h2','h3']);}
  if(item.type==='Galerie'){if(!Array.isArray(p.images)||p.images.length>30)fail('30 photos maximum par galerie');result.images=p.images.map(photo=>({image:imagePath(photo.image),alt:string(photo.alt,300)}));result.columns=number(p.columns,1,4);result.mobileColumns=number(p.mobileColumns,1,2);if(!Number.isInteger(result.columns)||!Number.isInteger(result.mobileColumns))fail('Nombre de colonnes invalide');result.height=number(p.height,80,1200);}
  if(item.type==='Image'){result.src=imagePath(p.src);result.alt=string(p.alt,300);result.caption=string(p.caption,2000);result.fit=choice(p.fit,['cover','contain']);result.height=number(p.height,80,1200);}
  if(item.type==='Bouton'){result.label=string(p.label,100);result.href=visualHref(p.href);result.variant=choice(p.variant,['filled','outline','text']);}
  if(item.type==='CompositionLibre'){
   result.height=number(p.height,200,1600);if(!Array.isArray(p.items)||p.items.length>30)fail('30 éléments maximum par composition');const elementIds=new Set();
   result.items=p.items.map(entry=>{if(!entry||typeof entry.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(entry.id)||elementIds.has(entry.id))fail('Identifiant de composition invalide');elementIds.add(entry.id);const x=number(entry.x,0,95),y=number(entry.y,0,95),width=number(entry.width,5,100-x),height=number(entry.height,5,100-y);return {id:entry.id,kind:choice(entry.kind,['text','image','button']),text:string(entry.text,6000),image:imagePath(entry.image),alt:string(entry.alt,300),href:visualHref(entry.href),x,y,width,height,size:number(entry.size,10,120),color:color(entry.color),background:color(entry.background,true),align:choice(entry.align,['left','center','right'])};});
  }
  if(item.type==='Espace')result.height=number(p.height,0,600);
  if(item.type==='Section'||item.type==='Colonnes')result.children=content(p.children,depth+1);
  if(item.type==='Colonnes'){if(!Number.isInteger(p.columns))fail('Nombre de colonnes invalide');result.columns=number(p.columns,1,4);result.mobileColumns=number(p.mobileColumns??1,1,2);if(!Number.isInteger(result.mobileColumns))fail('Nombre de colonnes mobiles invalide');}
  if(item.type==='Bandeau'||item.type==='Nouveautes'){result.items=slides(p.items);result.source=choice(p.source??'manual',['manual','managed']);}
  if(['Nouveautes','Liens','Catalogue','Recettes'].includes(item.type))result.title=string(p.title,300);
  if(item.type==='Nouveautes'){result.intro=string(p.intro,2000);result.kicker=string(p.kicker,100);}
  if(item.type==='Liens')result.items=links(p.items);
  return {type:item.type,props:result};});}
 const result={root:{props:root},content:content(data.content)};if(JSON.stringify(result).length>240000)fail('La page dépasse la taille autorisée');return result;
}
export function puckImages(data){const result=[];if(!data)return result;if(data.root?.props?.logo)result.push(data.root.props.logo);function scan(items){for(const item of items||[]){if(item.type==='Image')result.push(item.props.src);for(const photo of item.props.images||[])if(photo.image)result.push(photo.image);for(const slide of item.props.items||[])if(slide.image)result.push(slide.image);scan(item.props.children);}}scan(data.content);return result;}
