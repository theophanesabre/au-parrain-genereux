import {HttpError,imagePath} from '../admin/core.mjs';
export const FORMATS=[6,12,24,36];
export const ALLERGENS=['gluten','crustaces','oeufs','poissons','arachides','soja','lait','fruits-a-coque','celeri','moutarde','sesame','sulfites','lupin','mollusques'];
export const FAMILIES=['ganache','praline','pate-amande','pate-fruits','confiserie','specialite'];
export const TYPES=['noir','lait','blanc','autre','aucun'];
export const demoCreations=()=>Array.from({length:45},(_,i)=>({id:`demo-${String(i+1).padStart(2,'0')}`,name:`Création ${String(i+1).padStart(2,'0')}`,description:'Emplacement de démonstration · profil illustratif',image:i<15?`/images/bonbons-ia-basse-def/${i+1}.png`:'',family:FAMILIES[i%6],chocolate:TYPES[i%5],intensity:i%5+1,sweetness:(i*3)%5+1,textures:[['fondante','croquante','croustillante','tendre','moelleuse'][i%5]],aromas:[['cacao','fruits','notes grillees'][i%3]],ingredients:'',ingredientTags:[],allergens:[],traces:[],ingredientsVerified:false,allergensVerified:false,tracesVerified:false,available:true,ballotin:true,demo:true,position:i+1,version:0}));
function text(value,max=200){if(typeof value!=='string'||value.length>max)throw new HttpError(400,'Texte invalide');return value.trim();}
function list(value,max=30){if(!Array.isArray(value)||value.length>max)throw new HttpError(400,'Liste invalide');return [...new Set(value.map(v=>text(v,80).toLowerCase()))].filter(Boolean);}
export function validateCreation(input){
 if(!input||typeof input!=='object'||!/^[-a-z0-9]{1,80}$/.test(input.id||''))throw new HttpError(400,'Identifiant invalide');
 const result={id:input.id,name:text(input.name,150),description:text(input.description,500),image:input.image?imagePath(input.image):'',ingredients:text(input.ingredients,8000)};
 if(!result.name)throw new HttpError(400,'Nom requis');
 if(!FAMILIES.includes(input.family)||!TYPES.includes(input.chocolate))throw new HttpError(400,'Famille ou type invalide');Object.assign(result,{family:input.family,chocolate:input.chocolate});
 for(const k of ['intensity','sweetness','position']){if(!Number.isSafeInteger(input[k])||input[k]<(k==='position'?0:1)||input[k]>(k==='position'?1000:5))throw new HttpError(400,'Indice ou position invalide');result[k]=input[k];}
 for(const k of ['textures','aromas','ingredientTags','allergens','traces'])result[k]=list(input[k]);
 if([...result.allergens,...result.traces].some(x=>!ALLERGENS.includes(x)))throw new HttpError(400,'Allergène inconnu');
 for(const k of ['ingredientsVerified','allergensVerified','tracesVerified','available','ballotin','demo']){if(typeof input[k]!=='boolean')throw new HttpError(400,'Option invalide');result[k]=input[k];}
 return result;
}
export async function readCreations(db){const rows=(await db.prepare('SELECT id,body,version,archived FROM catalogue_creations ORDER BY position,id').all()).results;const map=new Map(demoCreations().map(x=>[x.id,x]));for(const row of rows){if(row.archived)map.delete(row.id);else map.set(row.id,{...JSON.parse(row.body),version:row.version});}return [...map.values()].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));}
export function restrictions(value={}){const allergens=list(value.allergens||[],14),ingredients=list(value.ingredients||[],30);if(allergens.some(x=>!ALLERGENS.includes(x)))throw new HttpError(400,'Allergène inconnu');return {allergens,ingredients};}
export function compatible(c,exclude=restrictions()){
 if(!c.available||!c.ballotin)return false;
 if(exclude.allergens.length||exclude.ingredients.length){if(c.demo||!c.ingredients||!c.ingredientsVerified||!c.allergensVerified||!c.tracesVerified)return false;}
 if(exclude.allergens.some(a=>c.allergens.includes(a)||c.traces.includes(a)))return false;
 const canonical=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b([a-z]{4,})s\b/g,'$1');
 if(exclude.ingredients.length&&c.traces.length)return false;
 const tags=c.ingredientTags.map(canonical),recipe=canonical(c.ingredients);return !exclude.ingredients.some(x=>tags.includes(canonical(x))||recipe.includes(canonical(x)));
}
export function purchaseVerified(c){return !c.demo&&c.ingredientsVerified&&c.allergensVerified&&c.tracesVerified&&!!c.ingredients&&!!c.image;}
