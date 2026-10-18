import { env } from 'cloudflare:workers';
import { notFound } from 'next/navigation';
import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { getImageSources } from '@/components/site-data';
import { ProductDetails } from '@/components/product-details';
import { getStoreProduct, productGallery, productPhotoCrops } from '@/admin/products.mjs';
import type { ProductDetail } from '@/components/cart-types';
export const dynamic='force-dynamic';
export default async function ProductPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const product=await getStoreProduct(env.DB,id) as ProductDetail|null;
 if(!product)notFound();
 const sources=await getImageSources();
 return <main className="inner-page"><SiteHeader/><ProductDetails product={{...product,image:sources[product.image]||product.image,images:productGallery(product).map((src:string)=>sources[src]||src),photo_crops:productPhotoCrops(product,(src:string)=>sources[src]||src)}}/><SiteFooter/></main>;
}
