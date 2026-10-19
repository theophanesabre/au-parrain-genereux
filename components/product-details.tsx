'use client';
import { UnitPrice, IngredientText } from './food-info';
import { ProductGallery } from './product-gallery';
import { useRef, useState } from 'react';
import { useCart } from './cart';
import { MAX_QUANTITY } from '@/commerce/cart.mjs';
import type { ProductDetail } from './cart-types';
const money=(cents:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100);
const sections=[['description','Description'],['conservation','Conservation'],['ingredients','Ingrédients'],['allergens','Allergènes'],['nutrition','Nutrition']] as const;
export function ProductDetails({product}:{product:ProductDetail}){
 const {items,add,ready}=useCart();
 const [tab,setTab]=useState(0),[quantity,setQuantity]=useState(1),[message,setMessage]=useState('');
 const tabs=useRef<(HTMLButtonElement|null)[]>([]);
 const inCart=items.find(item=>item.id===product.id)?.quantity||0;
 const maximum=Math.max(0,Math.min(MAX_QUANTITY-inCart,product.stock-inCart));
 const valid=Number.isSafeInteger(quantity)&&quantity>0&&quantity<=maximum;
 return <div className="apg-product-page" data-ve-commerce="true">
  <nav aria-label="Fil d’Ariane"><a href="/boutique">Boutique en ligne</a><span aria-hidden="true"> / </span><span>{product.name}</span></nav>
  <article className="apg-product-detail">
   <div className="apg-product-detail-photo"><ProductGallery crops={product.photo_crops} name={product.name} images={[product.image,...(product.images||[])].filter(Boolean)} detail/></div>
   <div className="apg-product-detail-body"><h1>{product.name}</h1>{product.food_name?<p className="apg-food-name">{product.food_name}</p>:null}<UnitPrice price={product.price_cents} weight={product.weight}/>
    <div className="apg-product-tabs" role="tablist" aria-label="Informations sur l’article">{sections.map(([key,label],index)=><button type="button" key={key} ref={node=>{tabs.current[index]=node;}} id={'tab-'+key} role="tab" aria-selected={tab===index} aria-controls={'panel-'+key} tabIndex={tab===index?0:-1} onClick={()=>setTab(index)} onKeyDown={event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%sections.length;else if(event.key==='ArrowLeft')next=(index+sections.length-1)%sections.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=sections.length-1;else return;event.preventDefault();setTab(next);tabs.current[next]?.focus();}}>{label}</button>)}</div>
    {sections.map(([key,label],index)=><div key={key} id={'panel-'+key} role="tabpanel" aria-labelledby={'tab-'+key} hidden={tab!==index} tabIndex={0} className="apg-product-panel">{key==='ingredients'&&product.ingredients?<IngredientText value={product.ingredients}/>:<p>{product[key]||`${label} : informations à compléter et à valider par la maison avant la vente.`}</p>}{key==='conservation'?<p><a href="/conseils-conservation">Nos conseils pour conserver et déguster vos chocolats</a></p>:null}</div>)}
    <form className="apg-product-purchase" onSubmit={event=>{event.preventDefault();if(!ready||!valid)return;add(product.id,quantity);setMessage('Ajouté au panier.');}}>
     <label htmlFor="product-quantity">Quantité</label><div className="apg-product-quantity"><button type="button" aria-label="Diminuer la quantité" disabled={quantity<=1} onClick={()=>{setQuantity(value=>Math.max(1,value-1));setMessage('');}}>−</button><input id="product-quantity" type="number" min="1" max={Math.max(1,maximum)} step="1" value={Number.isNaN(quantity)?'':quantity} onChange={event=>{setQuantity(event.target.valueAsNumber);setMessage('');}} required/><button type="button" aria-label="Augmenter la quantité" disabled={!valid||quantity>=maximum} onClick={()=>{setQuantity(value=>Math.min(maximum,value+1));setMessage('');}}>+</button></div>
     <button className="apg-shop-primary apg-product-add" disabled={!ready||!valid}><span>{product.stock<=0?'Épuisé':maximum===0?'Stock atteint':'Ajouter au panier'}</span><span>{money(product.price_cents*(valid?quantity:1))}</span></button>
     <p role="status">{message}{message?<> <a href="/panier">Voir mon panier</a></>:null}</p><p className="apg-product-delivery">Retrait en boutique ou expédition.</p>
    </form>
   </div>
  </article>
 </div>;
}
