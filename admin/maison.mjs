import { blockStyle, puckDefaults, validatePuckData } from './puck-model.mjs';
import { puckContext, defaultPuckData } from './puck-defaults.mjs';

const sections=[['/maison','la-maison'],['/savoir-faire','savoir-faire'],['/bonbons','nos-recettes']];

// Compose existing published content without changing or deleting the source documents.
export function combineMaisonDocuments(documents){
 const main=documents[0];
 if(main.root.props.maisonCombined)return validatePuckData(main);
 const content=documents.map((document,index)=>{
  let counter=0;
  const copy=items=>items.map(item=>{const props={...structuredClone(item.props),id:`maison-part-${index}-${++counter}`};if(props.children)props.children=copy(props.children);if(index>0&&item.type==='Texte'&&props.level==='h1')props.level='h2';return {type:item.type,props};});
  return {type:'Section',props:{...structuredClone(puckDefaults.Section),id:sections[index][1],style:{...blockStyle,padding:0,paddingX:0,maxWidth:2400},children:copy(document.content)}};
 });
 return validatePuckData({root:{props:{...main.root.props,maisonCombined:true}},content});
}

export async function loadMaisonDocument(db,{draft=false,defaults=false}={}){
 const main=defaults?null:await db.prepare("SELECT published,draft FROM puck_pages WHERE path='/maison'").first();
 const body=draft?(main?.draft||main?.published):main?.published;
 const current=body?JSON.parse(body):null;
 if(current?.root?.props?.maisonCombined)return validatePuckData(current);
 const documents=await Promise.all(sections.map(async([path],index)=>{
  if(index===0&&current)return validatePuckData(current);
  const record=defaults||index===0?null:await db.prepare('SELECT published FROM puck_pages WHERE path=?').bind(path).first();
  if(record?.published)return validatePuckData(JSON.parse(record.published));
  const context=await puckContext(db,path),data=defaultPuckData(path,context);
  const page=await db.prepare('SELECT title,body FROM pages WHERE id=? AND published=1').bind(path.slice(1)).first();
  if(page){let structured=false;try{structured=JSON.parse(page.body).format==='site-fields-v1';}catch{}if(!structured)data.content=[{type:'Texte',props:{...structuredClone(puckDefaults.Texte),id:'managed-content',title:page.title,body:page.body,level:'h1'}}];}
  if(path==='/bonbons'){const heading=data.content.find(item=>item.type==='Texte');if(heading)heading.props.title='Nos recettes';}
  return validatePuckData(data);
 }));
 return combineMaisonDocuments(documents);
}
