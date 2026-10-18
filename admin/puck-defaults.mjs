import { puckDefaults, puckRoot, blockStyle } from './puck-model.mjs';
import { pageDefinition, contentValues } from './content.mjs';
import { appearanceValues, defaultAppearance } from './appearance.mjs';
import { mergeHighlights } from './highlights.mjs';
import { isSale, isRecipe, productGallery, productPhotoCrops } from './products.mjs';
import { bonbons } from '../data/bonbons.ts';
import { bonbonDescriptions } from '../data/bonbon-descriptions.mjs';
export async function puckContext(db,path){
 const pageId=path==='/'?'accueil':path.slice(1),definition=pageDefinition(pageId);
 const [pages,replacements,highlights,products,appearance]=await Promise.all([
  db.prepare("SELECT id,body FROM pages WHERE published=1 AND (id=? OR id='accueil')").bind(pageId).all(),
  db.prepare('SELECT r.original,r.image_id FROM image_replacements r').all(),
  db.prepare('SELECT * FROM highlights ORDER BY position LIMIT 500').all(),
  db.prepare('SELECT id,name,description,price_cents,stock,image,images,photo_crops,published FROM products WHERE archived=0 AND published=1 ORDER BY name LIMIT 500').all(),
  db.prepare("SELECT body FROM site_settings WHERE id='appearance'").first(),
 ]);
 const images=Object.fromEntries(replacements.results.map(item=>[item.original,'/media/'+item.image_id]));
 const home=contentValues(pageDefinition('accueil'),pages.results.find(item=>item.id==='accueil')?.body);
 const content=definition?contentValues(definition,pages.results.find(item=>item.id===pageId)?.body):{};
 const recipes=products.results.filter(item=>isRecipe(item.id)).map(item=>({...item,image:images[item.image]||item.image}));
 const initialized=await db.prepare('SELECT slot FROM admin_access WHERE slot=1').first();
 return {content,home,images,appearance:appearance?appearanceValues(appearance.body):defaultAppearance,highlights:mergeHighlights(highlights.results).filter(item=>item.published===1).map(item=>({...item,image:images[item.image]||item.image})),storefront:{products:products.results.filter(item=>isSale(item.id)&&item.price_cents>0).map(item=>({...item,image:images[item.image]||item.image,images:productGallery(item).map(src=>images[src]||src),photo_crops:productPhotoCrops(item,src=>images[src]||src)})),recipes:recipes.length||initialized?recipes:bonbons.map((name,index)=>({id:'bonbon-'+(index+1),name,description:bonbonDescriptions[index],image:images['/images/bonbons-ia-basse-def/'+(index+1)+'.png']||'/images/bonbons-ia-basse-def/'+(index+1)+'.png'}))}};
}
export function defaultPuckData(path,context){
 const {content:c,home,images,appearance:a,highlights}=context;let counter=0;const block=(type,props={})=>({type,props:{...structuredClone(puckDefaults[type]),id:type+'-initial-'+(++counter),...props}});const img=src=>images[src]||src;
 const root={...structuredClone(puckRoot),pattern:'inherit',stripeColor:a.visual.stripeColor||'#f5e6da',stripeWidth:a.visual.stripeWidth??38,stripeAngle:a.visual.stripeAngle??90,background:a.visual.surface,textColor:a.visual.ink,accent:a.visual.accent,font:a.visual.font,logo:img('/images/logo-boutique-neon.webp'),footerTitle:home.footerTitle||puckRoot.footerTitle,footerText:home.footerText||'',address:[home.address,home.city].filter(Boolean).join(' · '),hours:[home.days,home.hours].filter(Boolean).join(' · '),phone:home.phone||'',email:home.email||''};
 let content=[];
 if(path==='/'){
  const slide=item=>Object.fromEntries(['title','description','kicker','image','alt','href','button_label','image_fit'].map(key=>[key,item[key]]));
  const group={
   spotlight:[block('Bandeau',{items:highlights.filter(item=>item.placement==='hero').map(slide)})],
   news:[block('Nouveautes',{title:c.newsTitle||'Nouveautés & découvertes',intro:c.newsIntro||'',kicker:c.newsKicker||'',items:highlights.filter(item=>item.placement==='news').map(slide)})],
   visit:[block('Colonnes',{children:[block('Texte',{title:c.shopTitle||'Nous trouver',body:[c.shopIntro,root.address,root.hours,root.phone,root.email].filter(Boolean).join('\n'),style:{...blockStyle,padding:16}}),block('Image',{src:img('/images/plan-boutique-le-havre-v4-transparent.png'),alt:'Plan pour trouver la boutique',height:440,style:{...blockStyle,padding:0,paddingX:0}})]})],
   history:[block('Texte',{title:c.heroTitle||'Au Parrain Généreux',body:c.heroKicker||'',level:'h1',style:{...blockStyle,align:'center'}}),block('Colonnes',{children:[block('Image',{src:img('/images/boutique-historique.jpeg'),alt:'La boutique historique',fit:'cover',height:440,style:{...blockStyle,padding:0,paddingX:0}}),block('Section',{children:[block('Texte',{title:c.historyTitle||'La maison',body:c.historyText||'',style:{...blockStyle,padding:12,paddingX:12}}),block('Bouton',{label:a.historyLabel,href:a.historyHref,style:{...blockStyle,padding:12,paddingX:12}})],style:{...blockStyle,padding:16,paddingX:16}})]})],
   chapters:[block('Liens',{title:c.chaptersTitle||'Découvrir la maison',items:[['La collection','/bonbons'],['La Maison','/maison'],['Le savoir-faire','/savoir-faire'],['Nous trouver','/#nous-trouver']].map(([label,href],index)=>({label:c['chapter'+(index+1)+'Title']||label,text:c['chapter'+(index+1)+'Subtitle']||'',href}))})],
   collection:[block('Colonnes',{children:[block('Section',{children:[block('Texte',{title:c.collectionTitle||'La collection',body:c.collectionText||''}),block('Bouton',{label:a.collectionLabel,href:a.collectionHref})],style:{...blockStyle,padding:0,paddingX:0}}),block('Image',{src:img('/images/bonbons-editorial-deep.webp'),alt:'Les chocolats de la maison',height:420,style:{...blockStyle,padding:0,paddingX:0}})]})],
  };
  content=a.sections.filter(item=>item.visible).flatMap(item=>group[item.id]||[]);
 }else if(path==='/maison')content=[block('Texte',{title:c.title||'La maison',body:c.intro||'',level:'h1'}),block('Image',{src:img('/images/apg-au-parrain-genereux-transparent.png'),alt:'Les deux savoir-faire de la maison',height:480})];
 else if(path==='/savoir-faire'){content=[block('Texte',{title:c.title||'Notre savoir-faire',body:c.intro||'',level:'h1'}),block('Texte',{title:c.processTitle||'Les gestes',body:c.processKicker||''})];for(let i=1;i<=6;i++)content.push(block('Texte',{title:c['gesture'+i+'Title']||'Geste '+i,body:c['gesture'+i+'Text']||'',level:'h3'}));content.push(block('Texte',{title:c.workshopTitle||'Notre atelier',body:c.workshopText||''}),block('Bouton',{label:'Venir nous rencontrer',href:'/#nous-trouver'}));}
 else if(path==='/bonbons')content=[block('Texte',{title:c.title||'Nos chocolats',body:c.intro||'',level:'h1'}),block('Bouton',{label:'Voir les articles de la maison',href:'/boutique'}),block('Recettes')];
 else if(path==='/boutique')content=[block('Texte',{title:'Tous les articles.',body:'Découvrez les articles de la maison : boîtes, coffrets et créations préparées par nos soins.',level:'h1'}),block('Catalogue')];
 else if(path==='/panier')content=[block('Texte',{title:'Mon panier.',body:'Retrouvez votre sélection et ajustez vos quantités avant de passer commande.',level:'h1'}),block('Panier')];
 for(const item of a.customButtons.filter(item=>item.visible&&item.page===path))content.push(block('Bouton',{label:item.label,href:item.href,variant:item.style==='text'?'text':item.style,style:{...blockStyle,align:item.align}}));
 for(const item of a.visual.blocks.filter(item=>item.visible&&item.page===path)){if(item.kind==='text')content.push(block('Texte',{title:item.title,body:item.body}));if(item.kind==='image')content.push(block('Image',{src:item.image,alt:item.alt,caption:item.body}));if(item.kind==='button')content.push(block('Bouton',{label:item.label,href:item.href}));if(item.kind==='spacer')content.push(block('Espace',{height:item.style.minHeight||48}));}
 return {root:{props:root},content};
}
