'use client';
import type { PhotoCrop } from './cart-types';
import { useId, useRef, useState } from 'react';
export function ProductGallery({images,name,href,detail=false,crops={}}:{images:string[];name:string;href?:string;detail?:boolean;crops?:Record<string,PhotoCrop>}){
 const [active,setActive]=useState(0);const track=useRef<HTMLDivElement>(null);const id=useId();
 const photos=[...new Set(images.filter(Boolean))].slice(0,12);if(!photos.length)photos.push('/images/bonbons-editorial-deep.webp');
 function go(index:number){const element=track.current;if(!element)return;const next=Math.max(0,Math.min(index,photos.length-1));element.scrollTo({left:next*element.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 return <div className={'apg-product-gallery'+(detail?' apg-product-gallery--detail':'')} aria-label={`Photos de ${name}`} aria-roledescription={photos.length>1?'carrousel':undefined}>
  <div id={id} className="apg-product-gallery-track" ref={track} tabIndex={photos.length>1?0:undefined} onScroll={event=>{const el=event.currentTarget;setActive(Math.min(photos.length-1,Math.round(el.scrollLeft/Math.max(1,el.clientWidth))));}} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='ArrowRight'){event.preventDefault();go(active+1);}else if(event.key==='ArrowLeft'){event.preventDefault();go(active-1);}}}>
   {photos.map((src,index)=>{const crop=crops[src];const photo=<img style={crop?{transform:`translate(${crop.x}%, ${crop.y}%) scale(${crop.zoom/100})`,transformOrigin:'center',objectFit:'contain',objectPosition:'center'}:undefined} src={src} alt={`${name}${photos.length>1?` — vue ${index+1} sur ${photos.length}`:''}`} loading={index>0?'lazy':undefined} draggable={false}/>;return href?<a className="apg-product-gallery-slide" href={href} key={src} tabIndex={active===index?0:-1}>{photo}</a>:<div className="apg-product-gallery-slide" key={src}>{photo}</div>;})}
  </div>
  {photos.length>1?<><div className="apg-product-gallery-navigation"><button type="button" aria-label={`Photo précédente de ${name}`} aria-controls={id} disabled={active===0} onClick={()=>go(active-1)}>‹</button><span aria-live="polite" aria-atomic="true">{active+1} / {photos.length}</span><button type="button" aria-label={`Photo suivante de ${name}`} aria-controls={id} disabled={active===photos.length-1} onClick={()=>go(active+1)}>›</button></div>{detail?<div className="apg-product-gallery-thumbnails">{photos.map((src,index)=><button type="button" key={src} aria-label={`Afficher la photo ${index+1} de ${name}`} aria-current={index===active?'true':undefined} aria-controls={id} onClick={()=>go(index)}><img src={src} alt="" loading="lazy"/></button>)}</div>:null}</>:null}
 </div>;
}
