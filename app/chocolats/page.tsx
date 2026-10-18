import { env } from 'cloudflare:workers';
import { Render } from '@puckeditor/core/rsc';
import { puckConfig } from '@/components/puck/config';
import { publishedPuckPage } from '@/components/puck/published';
import { puckContext, defaultPuckData } from '@/admin/puck-defaults.mjs';
export const dynamic='force-dynamic';
export const metadata={title:'Nos chocolats | Au Parrain Généreux',description:'Découvrez les recettes de chocolats de la maison : pralinés, giandujas et pâtes d’amande, au Havre depuis 1890.'};
export default async function Chocolats(){
 const published=await publishedPuckPage('/chocolats');if(published)return published;
 const context=await puckContext(env.DB,'/chocolats');
 return <Render config={puckConfig([],context.storefront)} data={defaultPuckData('/chocolats',context)}/>;
}
