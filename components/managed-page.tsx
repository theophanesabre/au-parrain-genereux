import { getPageRecord } from './site-data';
import { PageIntro, SiteHeader, SiteFooter } from './site-chrome';
export async function getManagedPage(id: string) {
  const page=await getPageRecord(id);
  if(page){try{if(JSON.parse(page.body).format==='site-fields-v1')return null;}catch{}}
  return page ?? null;
}
export function ManagedPage({page}: {page:{title:string;body:string}}) {
  return <main className="inner-page"><SiteHeader/><PageIntro index="" kicker="La maison" title={page.title}><div style={{whiteSpace:'pre-wrap'}}>{page.body}</div></PageIntro><SiteFooter/></main>;
}
