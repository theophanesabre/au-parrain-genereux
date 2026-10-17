import { appearanceValues, defaultAppearance } from '@/admin/appearance.mjs';
import { mergeHighlights } from '@/admin/highlights.mjs';
import type { Highlight } from './highlights-types';
import { cache } from 'react';
import { env } from 'cloudflare:workers';
import { contentValues, pageDefinition } from '@/admin/content.mjs';
export const getPageRecord=cache(async (id:string)=>env.DB?env.DB.prepare('SELECT title,body FROM pages WHERE id=? AND published=1').bind(id).first<{title:string;body:string}>():null);
export const getPageContent=cache(async (id:string):Promise<Record<string,string>>=>{
  const definition=pageDefinition(id);if(!definition)return {};
  const page=await getPageRecord(id);
  return contentValues(definition,page?.body);
});
const getReplacements=cache(async ()=>{
  if(!env.DB)return [];
  const result=await env.DB.prepare('SELECT r.original,r.image_id,i.alt FROM image_replacements r JOIN images i ON i.id=r.image_id').all<{original:string;image_id:string;alt:string}>();
  return result.results;
});
export const getImageSources=cache(async ():Promise<Record<string,string>>=>Object.fromEntries((await getReplacements()).map(row=>[row.original,`/media/${row.image_id}`])));
export const getImageDescriptions=cache(async ():Promise<Record<string,string>>=>Object.fromEntries((await getReplacements()).map(row=>[row.original,row.alt])));

export const getHighlights=cache(async ():Promise<Highlight[]>=>{
  const rows=env.DB?(await env.DB.prepare('SELECT * FROM highlights ORDER BY placement,position,id LIMIT 500').all<Highlight>()).results:[];
  return mergeHighlights(rows).filter(item=>item.published===1) as Highlight[];
});

export const getAppearance=cache(async()=>{
 const record=env.DB?await env.DB.prepare("SELECT body FROM site_settings WHERE id='appearance'").first<{body:string}>():null;
 return record?appearanceValues(record.body):defaultAppearance;
});
