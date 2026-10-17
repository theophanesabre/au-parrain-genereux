import { env } from 'cloudflare:workers';
import { pageDefinition } from '@/admin/content.mjs';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/db';
import { pages } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { PageIntro, SiteFooter, SiteHeader } from '@/components/site-chrome';
export const dynamic = 'force-dynamic';
export default async function ContentPage({params}: {params: Promise<{slug:string}>}) {
  const {slug} = await params;
  const existing=pageDefinition(slug);if(existing)redirect(existing.path);
  if (!env.DB) notFound();
  const [page] = await getDb().select().from(pages).where(and(eq(pages.id,slug),eq(pages.published,1))).limit(1);
  if (!page) notFound();
  return <main className="inner-page"><SiteHeader/><PageIntro index="" kicker="La maison" title={page.title}><div style={{whiteSpace:'pre-wrap'}}>{page.body}</div></PageIntro><SiteFooter/></main>;
}
