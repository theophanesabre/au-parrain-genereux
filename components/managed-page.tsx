import { env } from 'cloudflare:workers';
import { getDb } from '@/db';
import { pages } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { PageIntro, SiteHeader, SiteFooter } from './site-chrome';
export async function getManagedPage(id: string) {
  if (!env.DB) return null;
  const [page] = await getDb().select().from(pages).where(and(eq(pages.id,id),eq(pages.published,1))).limit(1);
  return page ?? null;
}
export function ManagedPage({page}: {page:{title:string;body:string}}) {
  return <main className="inner-page"><SiteHeader/><PageIntro index="" kicker="La maison" title={page.title}><div style={{whiteSpace:'pre-wrap'}}>{page.body}</div></PageIntro><SiteFooter/></main>;
}
