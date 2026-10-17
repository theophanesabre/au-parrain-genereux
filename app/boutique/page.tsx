import { env } from 'cloudflare:workers';
import { SiteHeader, SiteFooter, PageIntro } from '@/components/site-chrome';
import { Catalog } from '@/components/catalog';
import { getImageSources } from '@/components/site-data';
import { isRecipe } from '@/admin/products.mjs';
import type { SaleProduct } from '@/components/cart-types';
export const dynamic='force-dynamic';
export const metadata={title:'Tous les articles | Au Parrain Généreux',description:'Découvrez les articles de la maison, leurs prix et leur disponibilité. Composez votre panier pour un retrait en boutique ou une expédition.'};
export default async function Shop(){
  const [rows,sources]=await Promise.all([env.DB?env.DB.prepare('SELECT id,name,description,price_cents,stock,image FROM products WHERE published=1 AND price_cents>0 ORDER BY name LIMIT 500').all<SaleProduct>():Promise.resolve({results:[] as SaleProduct[]}),getImageSources()]);
  const products=rows.results.filter(product=>!isRecipe(product.id));
  return <main className="inner-page"><SiteHeader/><PageIntro index="05" kicker="La boutique" title="Tous les articles."><p>Choisissez votre assortiment de bonbons au poids ou découvrez nos autres créations. Retrait en boutique ou expédition : préparez votre sélection.</p></PageIntro>
    <Catalog products={products.map(product=>({...product,image:sources[product.image]||product.image}))}/><SiteFooter/></main>;
}
