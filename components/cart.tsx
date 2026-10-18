'use client';
import { ProductGallery } from './product-gallery';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CART_KEY, MAX_QUANTITY, normalizeCart } from '@/commerce/cart.mjs';
import type { CartLine, Quote, SaleProduct } from './cart-types';
const money=(cents:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100);
const CartContext=createContext<{items:CartLine[];ready:boolean;storageError:boolean;change:(id:string,quantity:number)=>void;add:(id:string,quantity:number)=>void;clear:()=>void}|null>(null);
export function CartProvider({children}:{children:ReactNode}){
  const [items,setItems]=useState<CartLine[]>([]),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false);
  const latest=useRef<CartLine[]>([]);
  function restore(raw:string|null){latest.current=normalizeCart(JSON.parse(raw||'[]'));setItems(latest.current);}
  useEffect(()=>{
    try{restore(localStorage.getItem(CART_KEY));}catch{setStorageError(true);}setReady(true);
    const sync=(event:StorageEvent)=>{if(event.key===CART_KEY||event.key===null){try{restore(event.newValue);}catch{setStorageError(true);}}};
    window.addEventListener('storage',sync);return ()=>window.removeEventListener('storage',sync);
  },[]);
  function save(update:(old:CartLine[])=>CartLine[]){const next=normalizeCart(update(latest.current));latest.current=next;setItems(next);try{localStorage.setItem(CART_KEY,JSON.stringify(next));}catch{setStorageError(true);}}
  function change(id:string,quantity:number){save(old=>quantity===0?old.filter(line=>line.id!==id):old.some(line=>line.id===id)?old.map(line=>line.id===id?{id,quantity}:line):[...old,{id,quantity}]);}
  function add(id:string,quantity:number){save(old=>[...old,{id,quantity}]);}
  return <CartContext.Provider value={{items,ready,storageError,change,add,clear:()=>save(()=>[])}}>{children}</CartContext.Provider>;
}
export function useCart(){const value=useContext(CartContext);if(!value)throw new Error('Panier absent');return value;}
export function CartLink(){const {items,ready}=useCart();return <a className="apg-cart-link" href="/panier" aria-label={`Panier${ready?`, ${items.length} article${items.length>1?'s':''}`:''}`}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg><span>Panier</span>{ready&&items.length>0?<b>{items.length}</b>:null}</a>;}
export function PurchaseCard({product,preview=false,compact=false}:{product:SaleProduct;preview?:boolean;compact?:boolean}){
  const {add,items,ready}=useCart();const [quantity,setQuantity]=useState(1),[message,setMessage]=useState('');
  const inCart=items.find(item=>item.id===product.id)?.quantity||0;
  const href='/boutique/'+encodeURIComponent(product.id);
  const photos=[product.image,...(product.images||[])].filter(Boolean);
  const visual=<figure className="apg-product-photo"><ProductGallery images={photos} name={product.name} href={preview?undefined:href}/></figure>;
  const title=preview?product.name:<a href={href}>{product.name}</a>;
  const valid=Number.isSafeInteger(quantity)&&quantity>0&&quantity<=MAX_QUANTITY&&quantity+inCart<=product.stock;
  if(compact)return <article id={product.id} className="apg-purchase apg-product-square" data-ve-commerce="true">
    {visual}
    <div><h2>{title}</h2><button type="button" className="apg-shop-primary apg-product-add" aria-label={`Ajouter ${product.name} au panier — ${money(product.price_cents)}`} disabled={preview||!ready||product.stock<=0||inCart>=product.stock||inCart>=MAX_QUANTITY} onClick={()=>{if(preview||!ready||inCart>=product.stock||inCart>=MAX_QUANTITY)return;add(product.id,1);setMessage('Ajouté au panier.');}}><span>{product.stock<=0?'Épuisé':inCart>=product.stock?'Stock atteint':'Ajouter'}</span><span>{money(product.price_cents)}</span></button><p className="apg-product-status" role="status">{message}</p>{preview?<p>{product.description}</p>:<a className="apg-product-details-link" href={href}>Découvrir cet article</a>}</div>
  </article>;
  return <article className="apg-purchase" data-ve-commerce="true">
    {visual}
    <div><p className="apg-shop-kicker">La collection</p><h2>{title}</h2><p>{product.description}</p><p className="apg-shop-price">{money(product.price_cents)} <small>/ pièce</small></p>
      {product.stock>0?<form onSubmit={event=>{event.preventDefault();if(preview||!valid||!ready)return;add(product.id,quantity);setMessage('Ajouté au panier.');}}>
        <label>Quantité en pièces<input type="number" min="1" max={Math.min(MAX_QUANTITY,product.stock-inCart)} step="1" disabled={preview} value={Number.isNaN(quantity)?'':quantity} onChange={event=>{setQuantity(event.target.valueAsNumber);setMessage('');}} required/></label>
        <p>{Number.isSafeInteger(quantity)&&quantity>0?money(product.price_cents*quantity):'Choisissez une quantité'}{inCart>0?` · déjà au panier : ${inCart} pièce(s)`:''}</p>
        <button className="apg-shop-primary" disabled={preview||!ready||!valid}>Ajouter au panier</button><p role="status">{message} {message?<a href="/panier">Voir mon panier →</a>:null}</p>
      </form>:<p>Temporairement indisponible.</p>}
    </div>
  </article>;
}
export function CartPage(){
  const {items,ready,storageError,change,clear}=useCart();
  const [quote,setQuote]=useState<Quote|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
  const [delivery,setDelivery]=useState('pickup'),[payment,setPayment]=useState<{enabled:boolean;mode:string;shipping_cents:number|null;countries:string[]}|null>(null),[paying,setPaying]=useState(false),[paymentError,setPaymentError]=useState('');
  const checkoutKey=useRef<{fingerprint:string;key:string}|null>(null);
  useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem('apg-checkout')||'null');if(saved&&typeof saved.key==='string'&&typeof saved.fingerprint==='string'){checkoutKey.current=saved;if(new URLSearchParams(location.search).get('paiement')==='annule'){void fetch('/api/paiement/annuler',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:saved.key})}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error||'Annulation à vérifier');if(result.state==='paid'){location.assign('/paiement?session_id='+encodeURIComponent(result.session_id));return;}if(result.state==='cancelled'){checkoutKey.current=null;sessionStorage.removeItem('apg-checkout');setPaymentError('Paiement annulé. Votre panier est conservé.');setRetry(value=>value+1);}else setPaymentError('Stripe vérifie encore ce paiement. Patientez avant de recommencer.');}).catch(error=>setPaymentError(error.message));}}}catch{/* Browser storage is optional. */}},[]);
  useEffect(()=>{const controller=new AbortController();fetch('/api/paiement/config',{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error();setPayment(await response.json());}).catch(()=>{});return ()=>controller.abort();},[]);
  async function checkout(){if(paying)return;setPaying(true);setPaymentError('');try{const fingerprint=JSON.stringify({items,delivery,mode:payment?.mode});if(checkoutKey.current?.fingerprint!==fingerprint)checkoutKey.current={fingerprint,key:crypto.randomUUID()};try{sessionStorage.setItem('apg-checkout',JSON.stringify(checkoutKey.current));}catch{/* In-memory retries still work. */}let response:Response;let result;for(let attempt=0;;attempt++){response=await fetch('/api/paiement/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,delivery,key:checkoutKey.current.key})});result=await response.json();if(attempt===0&&[409,503].includes(response.status)&&result.retry_checkout){checkoutKey.current={fingerprint,key:crypto.randomUUID()};try{sessionStorage.setItem('apg-checkout',JSON.stringify(checkoutKey.current));}catch{/* Optional storage. */}continue;}break;}if(!response.ok){if(response.status===409){checkoutKey.current=null;try{sessionStorage.removeItem('apg-checkout');}catch{/* Optional browser storage. */}}throw Error(result.error||'Impossible d’ouvrir Stripe');}if(result.state==='paid'){window.location.assign('/paiement?session_id='+encodeURIComponent(result.session_id));return;}const target=new URL(result.url);if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')throw Error('Destination de paiement invalide');window.location.assign(target.href);}catch(error){setPaymentError(error instanceof Error?error.message:'Paiement indisponible');setPaying(false);}}
  useEffect(()=>{
    if(!ready)return;
    const controller=new AbortController();setLoading(true);setError('');setQuote(null);
    fetch('/api/panier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items}),signal:controller.signal}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||'Impossible de vérifier le panier');setQuote(result);}).catch(error=>{if(error.name!=='AbortError')setError(error.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[items,ready,retry]);
  if(!ready)return <p className="apg-cart-loading" role="status">Chargement du panier…</p>;
  return <div className="apg-cart-content" data-ve-commerce="true">
    {storageError?<p role="alert">Votre navigateur ne permet pas de conserver ce panier après fermeture. Gardez cette page ouverte.</p>:null}
    {!items.length?<div className="apg-cart-empty"><h2>Votre panier attend ses chocolats.</h2><p>Découvrez les articles et les boîtes préparés par la maison.</p><a className="apg-shop-primary" href="/boutique">Découvrir la boutique</a></div>:<>
      <div className="apg-cart-lines" aria-busy={loading}>
        {loading?<p role="status">Vérification des prix et disponibilités…</p>:null}
        {error?<p role="alert">{error} <button type="button" onClick={()=>setRetry(value=>value+1)}>Réessayer</button></p>:null}
        {items.map(line=>{const checked=quote?.items.find(item=>item.id===line.id);return <article className="apg-cart-line" key={line.id}>
          <div><h2>{checked?.name||'Article du panier'}</h2>{checked?.price_cents!=null?<p>{money(checked.price_cents)} / pièce</p>:null}{checked&&!checked.available?<p role="alert">Cet article ou cette quantité n’est plus disponible. Réduisez la quantité ou retirez-le.</p>:null}</div>
          <label>Quantité (pièces)<input type="number" min="1" max={MAX_QUANTITY} step="1" defaultValue={line.quantity} key={line.quantity} onBlur={event=>{const value=event.target.valueAsNumber;if(Number.isSafeInteger(value)&&value>0&&value<=MAX_QUANTITY)change(line.id,value);else event.target.value=String(line.quantity);}} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label>
          <strong>{checked?.line_cents!=null?money(checked.line_cents):'—'}</strong><button type="button" className="apg-remove" onClick={()=>change(line.id,0)}>Retirer<span className="apg-visually-hidden"> {checked?.name||'cet article'}</span></button>
        </article>;})}
        <button type="button" className="apg-remove" onClick={clear}>Vider le panier</button><a className="apg-continue" href="/boutique">Continuer mes achats →</a>
      </div>
      <aside className="apg-cart-summary"><h2>Votre sélection</h2><fieldset><legend>Mode de réception souhaité</legend><label><input type="radio" name="delivery" value="pickup" checked={delivery==='pickup'} onChange={()=>setDelivery('pickup')}/> Retrait en boutique</label><label><input type="radio" name="delivery" value="shipping" checked={delivery==='shipping'} onChange={()=>setDelivery('shipping')}/> Expédition</label></fieldset>
        <p className="apg-cart-total"><span>Sous-total produits</span><strong>{!loading&&!error&&quote?money(quote.total_cents):'—'}</strong></p>
        <p>{delivery==='pickup'?'Retrait en boutique : sans frais de livraison.':payment?.shipping_cents!=null?'Expédition : '+money(payment.shipping_cents)+' · Destinations : '+payment.countries.join(', '):'L’expédition n’est pas encore configurée. Choisissez le retrait en boutique.'}</p>
        {quote&&!quote.valid?<p>Vérifiez les articles indisponibles avant de continuer.</p>:null}
        {payment?.enabled?<><p className="apg-cart-total"><span>Total à payer</span><strong>{quote&&!loading&&!error?money(quote.total_cents+(delivery==='shipping'?(payment.shipping_cents||0):0)):'—'}</strong></p>{payment.mode==='test'?<p><strong>Mode test : aucun encaissement réel.</strong></p>:null}<button className="apg-shop-primary" disabled={paying||loading||!!error||!quote?.valid||delivery==='shipping'&&payment.shipping_cents===null} onClick={()=>void checkout()}>{paying?'Ouverture de Stripe…':payment.mode==='test'?'Tester le paiement avec Stripe':'Payer avec Stripe'}</button><p>Le paiement s’effectue sur la page sécurisée de Stripe. Le stock est réservé pendant le paiement, puis libéré si la session expire.</p></>:<><button className="apg-shop-primary" disabled>Paiement bientôt disponible</button><p>Le paiement en ligne est en cours de préparation. Votre panier ne constitue pas encore une commande.</p></>}{paymentError?<p role="alert">{paymentError}</p>:null}
      </aside>
    </>}
  </div>;
}
