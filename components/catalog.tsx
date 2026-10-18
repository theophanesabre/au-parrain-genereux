'use client';
import { useShopSettings } from './appearance';
import { useState, type CSSProperties } from 'react';
import { PurchaseCard } from './cart';
import type { SaleProduct } from './cart-types';
const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR');
export function Catalog({products,preview=false}:{products:SaleProduct[];preview?:boolean}){
  const shop=useShopSettings();
  const [query,setQuery]=useState(''),[availableOnly,setAvailableOnly]=useState(false);
  const visible=products.filter(product=>(!availableOnly||product.stock>0)&&fold(product.name+' '+product.description).includes(fold(query.trim())));
  return <section className="apg-catalog" data-layout={shop.layout} data-presentation={shop.presentation} aria-label="Tous les articles" style={{'--shop-columns':shop.columns,'--shop-tablet-columns':shop.tabletColumns,'--shop-mobile-columns':shop.mobileColumns,'--shop-image-height':`${shop.imageHeight}px`,'--shop-image-fit':shop.imageFit,'--shop-gap':`${shop.gap}px`,'--shop-padding':`${shop.cardPadding}px`,'--shop-radius':`${shop.radius}px`,'--shop-max-width':`${shop.maxWidth}px`,'--shop-title-size':`${shop.titleSize}px`,'--shop-text-size':`${shop.textSize}px`,'--shop-align':shop.align,'--shop-card-background':shop.cardBackground} as CSSProperties}>
    <div className="apg-catalog-toolbar"><label>Rechercher un article<input type="search" placeholder="Nom ou description…" value={query} onChange={event=>setQuery(event.target.value)}/></label><label className="apg-catalog-filter"><input type="checkbox" checked={availableOnly} onChange={event=>setAvailableOnly(event.target.checked)}/> En stock uniquement</label><p role="status">{visible.length} article{visible.length===1?'':'s'}{query||availableOnly?` sur ${products.length}`:''}</p></div>
    {products.length?<>{visible.length?<div className="apg-catalog-grid">{visible.map(product=><PurchaseCard key={product.id} product={product} preview={preview} compact={shop.presentation==='square'}/>)}</div>:<div className="apg-cart-empty"><h2>Aucun article ne correspond.</h2><button type="button" className="apg-shop-primary" onClick={()=>{setQuery('');setAvailableOnly(false);}}>Afficher tous les articles</button></div>}</>:<div className="apg-cart-empty"><h2>La boutique se prépare.</h2><p>Nos articles apparaîtront ici dès leur publication. En attendant, découvrez les recettes de la maison.</p><a href="/maison#nos-recettes">Découvrir nos recettes →</a></div>}
  </section>;
}
