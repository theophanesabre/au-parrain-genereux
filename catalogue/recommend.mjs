import {HttpError} from '../admin/core.mjs';
import {FORMATS,compatible,restrictions} from './model.mjs';
const stable=(a,b)=>a.id.localeCompare(b.id);
export function tasteProfile(selected){
 const count=key=>{const sums={};for(const c of selected)for(const v of Array.isArray(c[key])?c[key]:[c[key]])sums[v]=(sums[v]||0)+1;return Object.entries(sums).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));};
 const avg=k=>selected.reduce((s,c)=>s+c[k],0)/selected.length;
 return {families:count('family'),chocolates:count('chocolate'),textures:count('textures'),aromas:count('aromas'),intensity:avg('intensity'),sweetness:avg('sweetness'),count:selected.length};
}
export function affinity(c,p){const match=(entries,values)=>values.reduce((s,v)=>s+(entries.find(x=>x[0]===v)?.[1]||0)/p.count,0);return 5*match(p.families,[c.family])+3*match(p.chocolates,[c.chocolate])+2*match(p.textures,c.textures)+3*match(p.aromas,c.aromas)+2*(1-Math.abs(c.intensity-p.intensity)/4)+2*(1-Math.abs(c.sweetness-p.sweetness)/4);}
export function recommend(catalogue,ids,size,excluded={},variant=0){
 if(!FORMATS.includes(size))throw new HttpError(400,'Format inconnu');if(!Array.isArray(ids)||!ids.length)throw new HttpError(400,'Sélectionnez au moins une création.');
 const exclude=restrictions(excluded),chosen=new Set(ids);const selected=catalogue.filter(c=>chosen.has(c.id)&&compatible(c,exclude));if(!selected.length)throw new HttpError(400,'Aucune sélection compatible avec les exclusions et les informations vérifiées.');
 const profile=tasteProfile(selected),eligible=catalogue.filter(c=>compatible(c,exclude)&&(!selected.every(s=>!s.demo)||!c.demo));const ranked=eligible.map(c=>({...c,score:affinity(c,profile)})).sort((a,b)=>b.score-a.score||stable(a,b));
 const preferenceCount=Math.round(size*.8),discoveryCount=size-preferenceCount;
 const discovery=ranked.filter(c=>!chosen.has(c.id)&&c.score>=ranked[0].score*.4);if(!discovery.length)throw new HttpError(400,'Pas de découverte cohérente disponible. Sélectionnez moins de créations ou modifiez vos exclusions.');
 // Reserve a small, disjoint discovery pool; rotation is deterministic, never random.
 const start=Math.abs(Number.isSafeInteger(variant)?variant:0)%discovery.length;
 const discoveries=Array.from({length:Math.min(discoveryCount,Math.max(1,Math.ceil(discovery.length/3)))},(_,i)=>discovery[(start+i)%discovery.length]);
 const discoveryIds=new Set(discoveries.map(c=>c.id)),preferred=ranked.filter(c=>!discoveryIds.has(c.id));if(!preferred.length)throw new HttpError(400,'Catalogue insuffisant pour les deux parties du ballotin.');
 const pieces=[];const fill=(pool,count,role)=>{const used=new Map();for(let i=0;i<count;i++){const next=[...pool].sort((a,b)=>(b.score-3*(used.get(b.id)||0))-(a.score-3*(used.get(a.id)||0))||stable(a,b))[0];used.set(next.id,(used.get(next.id)||0)+1);pieces.push({id:next.id,role,reason:role==='discovery'?'Une nouvelle création, proche de vos goûts.':`Affinité avec vos choix : ${next.family}, ${next.chocolate}.`});}};
 fill(preferred,preferenceCount,'preference');fill(discoveries,discoveryCount,'discovery');return {size,pieces,profile,preferenceCount,discoveryCount,demo:pieces.some(p=>catalogue.find(c=>c.id===p.id)?.demo)};
}
export function replacePiece(result,index,id,catalogue,exclude={}){const c=catalogue.find(c=>c.id===id);if(!Number.isSafeInteger(index)||!result.pieces[index]||!c||!compatible(c,restrictions(exclude)))throw new HttpError(400,'Remplacement incompatible ou indisponible.');return {...result,pieces:result.pieces.map((p,i)=>i===index?{...p,id,reason:'Création choisie par vous.'}:p),demo:result.pieces.some((p,i)=>(i===index?c:catalogue.find(x=>x.id===p.id))?.demo)};}
export function toggleSelection(ids,id){return ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];}

export function regenerateDiscoveries(result,catalogue,selectedIds,excluded={},variant=1){const exclude=restrictions(excluded),forbidden=new Set([...selectedIds,...result.pieces.filter(p=>p.role==='preference').map(p=>p.id)]);const ranked=catalogue.filter(c=>!forbidden.has(c.id)&&compatible(c,exclude)&&(result.demo||!c.demo)).map(c=>({...c,score:affinity(c,result.profile)})).sort((a,b)=>b.score-a.score||stable(a,b));const pool=ranked.filter(c=>c.score>=Math.max(...catalogue.filter(c=>compatible(c,exclude)).map(c=>affinity(c,result.profile)))*.4);if(!pool.length)throw new HttpError(400,'Aucune autre découverte cohérente disponible.');let n=0;const pieces=result.pieces.map(p=>p.role==='preference'?p:{id:pool[(Math.abs(variant)+n++)%pool.length].id,role:'discovery',reason:'Une nouvelle découverte, proche de vos goûts.'});return {...result,pieces,demo:pieces.some(p=>catalogue.find(c=>c.id===p.id)?.demo)};}
