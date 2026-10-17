import { env } from 'cloudflare:workers';
import { SiteHeader, SiteFooter, PageIntro } from '@/components/site-chrome';
import { PurchaseCard } from '@/components/cart';
import { getImageSources } from '@/components/site-data';
import { isRecipe } from '@/admin/products.mjs';
import type { SaleProduct } from '@/components/cart-types';
export const dynamic='force-dynamic';
export const metadata={title:'La boutique | Au Parrain Généreux'};
export default async function Shop(){
  const [rows,sources]=await Promise.all([env.DB?env.DB.prepare('SELECT id,name,description,price_cents,stock,image FROM products WHERE published=1 AND price_cents>0 ORDER BY name LIMIT 500').all<SaleProduct>():Promise.resolve({results:[] as SaleProduct[]}),getImageSources()]);
  const products=rows.results.filter(product=>!isRecipe(product.id));
  return <main className="inner-page"><SiteHeader/><PageIntro index="05" kicker="La boutique" title="À déguster."><p>Choisissez votre assortiment de bonbons au poids ou découvrez nos autres créations. Retrait en boutique ou expédition : préparez votre sélection.</p></PageIntro>
    <section className="apg-shop" aria-label="Produits de la boutique">{products.length?products.map(product=><PurchaseCard key={product.id} product={{...product,image:sources[product.image]||product.image}}/>):<div className="apg-cart-empty"><h2>La boutique se prépare.</h2><p>Nos produits seront disponibles ici dès l’ouverture des ventes en ligne.</p><a href="/bonbons">Découvrir nos recettes →</a></div>}</section><SiteFooter/></main>;
}
