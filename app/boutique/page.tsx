import { publishedPuckPage } from "@/components/puck/published";
import { PageSections } from "@/components/appearance";
import { env } from 'cloudflare:workers';
import { SiteHeader, SiteFooter, PageIntro } from '@/components/site-chrome';
import { Catalog } from '@/components/catalog';
import { getImageSources } from '@/components/site-data';
import { isSale, productGallery, productPhotoCrops } from '@/admin/products.mjs';
import type { SaleProduct } from '@/components/cart-types';
export const dynamic='force-dynamic';
export const metadata={title:'Tous les articles | Au Parrain Généreux',description:'Découvrez les articles de la maison, leurs prix et leur disponibilité. Composez votre panier pour un retrait en boutique ou une expédition.'};
export default async function Shop(){
  const puck=await publishedPuckPage("/boutique");if(puck)return puck;

  const [rows,sources]=await Promise.all([env.DB?env.DB.prepare('SELECT id,name,description,price_cents,stock,image,images,photo_crops,weight FROM products WHERE archived=0 AND published=1 AND price_cents>0 ORDER BY name LIMIT 500').all<SaleProduct>():Promise.resolve({results:[] as SaleProduct[]}),getImageSources()]);
  const products=rows.results.filter(product=>isSale(product.id));
  return <main className="inner-page"><SiteHeader/><PageSections page="/boutique" items={[{id:"intro",content:<PageIntro index="05" kicker="La boutique" title="Tous les articles."><p>Découvrez les articles de la maison : boîtes, coffrets et créations préparées par nos soins. Retrait en boutique ou expédition : préparez votre sélection.</p></PageIntro>},{id:"catalog",content:<Catalog products={products.map(product=>({...product,image:sources[product.image]||product.image,images:productGallery(product).map((src:string)=>sources[src]||src),photo_crops:productPhotoCrops(product,(src:string)=>sources[src]||src)}))}/>}]} /><SiteFooter/></main>;
}
