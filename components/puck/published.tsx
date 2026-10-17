import { cache } from 'react';
import { env } from 'cloudflare:workers';
import { Render } from '@puckeditor/core/rsc';
import { puckConfig } from './config';
import { puckContext } from '@/admin/puck-defaults.mjs';
import { validatePuckData } from '@/admin/puck-model.mjs';
export const publishedPuckPage=cache(async(path:string)=>{
 if(!env.DB)return null;
 const record=await env.DB.prepare('SELECT published FROM puck_pages WHERE path=?').bind(path).first<{published:string|null}>();
 if(!record?.published)return null;
 const context=await puckContext(env.DB,path);
 return <Render config={puckConfig([],context.storefront)} data={validatePuckData(JSON.parse(record.published))}/>;
});
