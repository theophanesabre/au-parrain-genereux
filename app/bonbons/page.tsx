import { publishedPuckPage } from "@/components/puck/published";
import { PageSections } from "@/components/appearance";
import { getPageContent, getImageSources, getImageDescriptions } from "@/components/site-data";
import { isRecipe } from "@/admin/products.mjs";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import Image from "next/image";
import { bonbons } from "@/data/bonbons";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";

import { bonbonDescriptions as descriptions } from "@/data/bonbon-descriptions.mjs";

export const dynamic = "force-dynamic";
export default async function Bonbons() {
  const puck=await publishedPuckPage("/bonbons");if(puck)return puck;

  const content=await getPageContent("bonbons");
  const [imageSources,imageAlts]=await Promise.all([getImageSources(),getImageDescriptions()]);
  const stored = env.DB ? await getDb().select().from(products).where(eq(products.published, 1)) : null;
  const initialized = env.DB ? await env.DB.prepare("SELECT slot FROM admin_access WHERE slot=1").first() : null;
  const recipes = stored?.filter(product => isRecipe(product.id));
  const collection = recipes && (recipes.length > 0 || initialized) ? recipes : bonbons.map((name, index) => ({id: `bonbon-${index + 1}`, name, description: descriptions[index], image: `/images/bonbons-ia-basse-def/${index + 1}.png`}));
  return <main className="inner-page">
    <SiteHeader />
    <PageSections page="/bonbons" items={[
{id:'intro',content:(<><PageIntro index="04" kicker={content.kicker} title={content.title}>
      <p>{content.intro} <a className="inline-text-link" href="/#nous-trouver">Consulter nos informations pratiques</a>.</p>
    </PageIntro></>)},
{id:'shop',content:(<><div className="apg-discovery-shop"><p>Découvrez nos articles et nos boîtes préparées par la maison.</p><a className="apg-shop-primary" href="/boutique">Voir les articles de la maison</a></div></>)},
{id:'recipes',content:(<><section className="bonbon-grid standalone bonbon-collection">
      {collection.map((product) => <figure key={product.id} id={product.id}>
        <div className="bonbon-card__visual">
          <Image src={imageSources[product.image] || product.image || imageSources["/logo-au-parrain-genereux.png"] || "/logo-au-parrain-genereux.png"} alt={imageAlts[product.image] || `${product.name}, bonbon de chocolat maison`} width={768} height={768} quality={84} sizes="(max-width: 620px) 90vw, (max-width: 980px) 45vw, 30vw" />
        </div>
        <figcaption><strong>{product.name}</strong><p>{product.description}</p></figcaption>
      </figure>)}
    </section></>)}
]}/>
    <SiteFooter />
  </main>;
}
