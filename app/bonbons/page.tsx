import { permanentRedirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function LegacyPage({searchParams}:{searchParams:Promise<{apercu?:string}>}){
 const query=await searchParams;
 permanentRedirect('/maison'+(query.apercu==='1'?'?apercu=1':'')+'#nos-recettes');
}
