import { getPageContent, getImageSources, getImageDescriptions } from "@/components/site-data";
import { BONBON_ID, BONBON_PRICE_CENTS_PER_KG, isRecipe } from "@/admin/products.mjs";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import Image from "next/image";
import { bonbons } from "@/data/bonbons";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";

const descriptions = [
  "Pâte d’amande et praliné maison, enrobés de chocolat noir ou au lait.",
  "Praliné onctueux, délicatement enrobé de chocolat noir.",
  "Praliné noisette et chocolat blanc, enrobé de chocolat noir, au lait ou blanc.",
  "Praliné à l’ancienne aux éclats d’amandes grillées, enrobé de chocolat.",
  "Gianduja surmonté d’une fleur cristallisée de violette ou de mimosa.",
  "Praliné lisse d’amande, enrobé de chocolat noir ou au lait.",
  "Praliné à l’ancienne, enrobé de chocolat noir, au lait ou blanc.",
  "Praliné à l’ancienne et paillettes de chocolat, sous un fin enrobage.",
  "Biscuit dentelle au beurre et praliné, enrobés de chocolat noir ou au lait.",
  "Biscuit spéculoos mêlé au praliné, enrobé de chocolat noir ou au lait.",
  "Pâte d’amande fondante, enrobée de chocolat noir ou au lait.",
  "Un godet de chocolat garni d’un gianduja généreux.",
  "Zestes de citron et d’orange confits, délicatement enrobés de chocolat.",
  "Confiserie d’œuf, de miel et d’amande, enrobée de chocolat noir ou au lait.",
  "Praliné lisse de noix de pécan, enrobé de chocolat au lait ou noir.",
];

export const dynamic = "force-dynamic";
export default async function Bonbons() {
  const content=await getPageContent("bonbons");
  const [imageSources,imageAlts]=await Promise.all([getImageSources(),getImageDescriptions()]);
  const stored = env.DB ? await getDb().select().from(products).where(eq(products.published, 1)) : null;
  const initialized = env.DB ? await env.DB.prepare("SELECT slot FROM admin_access WHERE slot=1").first() : null;
  const [commonProduct] = env.DB ? await getDb().select().from(products).where(eq(products.id, BONBON_ID)).limit(1) : [];
  const pricePerKg = ((commonProduct?.priceCents ?? BONBON_PRICE_CENTS_PER_KG) / 100).toLocaleString("fr-FR", {maximumFractionDigits:2});
  const recipes = stored?.filter(product => isRecipe(product.id));
  const collection = recipes && (recipes.length > 0 || initialized) ? recipes : bonbons.map((name, index) => ({id: `bonbon-${index + 1}`, name, description: descriptions[index], image: `/images/bonbons-ia-basse-def/${index + 1}.png`}));
  return <main className="inner-page">
    <SiteHeader />
    <PageIntro index="04" kicker={content.kicker} title={content.title}>
      <p>Nos bonbons de chocolat sont tous proposés au même tarif : <strong>{pricePerKg} € le kilo</strong>. {content.intro} <a className="inline-text-link" href="/#nous-trouver">Consulter nos informations pratiques</a>.</p>
    </PageIntro>
    <div className="apg-discovery-shop"><p>Envie de déguster nos recettes ? Retrouvez notre assortiment de bonbons, vendu au poids.</p><a className="apg-shop-primary" href="/boutique">Composer mon assortiment</a></div>
    <section className="bonbon-grid standalone bonbon-collection">
      {collection.map((product) => <figure key={product.id} id={product.id}>
        <div className="bonbon-card__visual">
          <Image src={imageSources[product.image] || product.image || imageSources["/logo-au-parrain-genereux.png"] || "/logo-au-parrain-genereux.png"} alt={imageAlts[product.image] || `${product.name}, bonbon de chocolat maison`} width={768} height={768} quality={84} sizes="(max-width: 620px) 90vw, (max-width: 980px) 45vw, 30vw" />
        </div>
        <figcaption><strong>{product.name}</strong><p>{product.description}</p></figcaption>
      </figure>)}
    </section>
    <SiteFooter />
  </main>;
}
