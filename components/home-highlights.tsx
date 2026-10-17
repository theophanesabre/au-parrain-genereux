'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import type { Highlight } from './highlights-types';

function useMotionPreference() {
  const [reducedMotion,setReducedMotion]=useState(true);
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReducedMotion(preference.matches);update();
    preference.addEventListener('change',update);
    return ()=>preference.removeEventListener('change',update);
  },[]);
  return reducedMotion;
}

export function SpotlightCarousel({items,label='À la une'}:{items:Highlight[];label?:string}) {
  const [active,setActive]=useState(0);
  const [paused,setPaused]=useState(false);
  const [hovered,setHovered]=useState(false);
  const [hidden,setHidden]=useState(false);
  const reducedMotion=useMotionPreference();
  const touch=useRef<{x:number;y:number}|null>(null);
  const id=useId();
  const current=Math.min(active,Math.max(0,items.length-1));
  useEffect(()=>{
    const update=()=>setHidden(document.hidden);update();
    document.addEventListener('visibilitychange',update);
    return ()=>document.removeEventListener('visibilitychange',update);
  },[]);
  useEffect(()=>{
    if(items.length<2||paused||hovered||hidden||reducedMotion||(new URLSearchParams(window.location.search).get('edition')==='1'&&window.parent!==window))return;
    const timer=window.setInterval(()=>setActive(previous=>(previous+1)%items.length),7000);
    return ()=>window.clearInterval(timer);
  },[items.length,paused,hovered,hidden,reducedMotion]);
  function goTo(index:number){setActive((index+items.length)%items.length);setPaused(true);}
  if(!items.length)return null;
  return <section className="apg-spotlight" data-transparent-background={items[current]?.image==='/images/calendrier-conte-avent-photo.jpg'?'true':undefined} aria-roledescription="carrousel" aria-label={label}
    tabIndex={items.length>1?0:undefined}
    onPointerEnter={()=>setHovered(true)} onPointerLeave={()=>setHovered(false)}
    onFocusCapture={()=>setPaused(true)}
    onKeyDown={event=>{
      if(event.target!==event.currentTarget||items.length<2)return;
      if(event.key==='ArrowRight'){event.preventDefault();goTo(current+1);}
      if(event.key==='ArrowLeft'){event.preventDefault();goTo(current-1);}
      if(event.key==='Home'){event.preventDefault();goTo(0);}
      if(event.key==='End'){event.preventDefault();goTo(items.length-1);}
    }}
    onTouchStart={event=>{const point=event.touches[0];touch.current=point?{x:point.clientX,y:point.clientY}:null;}}
    onTouchEnd={event=>{
      const start=touch.current;touch.current=null;const end=event.changedTouches[0];
      if(!start||!end||items.length<2)return;
      const dx=end.clientX-start.x,dy=end.clientY-start.y;
      if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)goTo(current+(dx<0?1:-1));
    }}>
    <div id={id} className="apg-spotlight__slides">
      {items.map((item,index)=><article key={item.id} className="apg-spotlight__slide" hidden={index!==current}
        inert={index!==current} aria-hidden={index!==current} role="group" aria-roledescription="diapositive" aria-label={`${index+1} sur ${items.length} : ${item.title}`}>
        <div className="apg-spotlight__visual" data-fit={item.image_fit}>
          <Image src={item.image} alt={item.alt} fill priority={index===0} sizes="(max-width: 760px) 100vw, 58vw" style={{objectFit:item.image_fit}}/>
        </div>
        <div className="apg-spotlight__copy">
          {item.kicker?<p className="apg-spotlight__kicker">{item.kicker}</p>:null}
          <h2 className="apg-spotlight__title">{item.title}</h2>
          {item.description?<p className="apg-spotlight__description">{item.description}</p>:null}
          <a className="apg-spotlight__link" href={item.href}><span data-ve-label>{item.button_label}</span><span className="apg-link-icon" aria-hidden="true">↗</span></a>
        </div>
      </article>)}
    </div>
    {items.length>1?<div className="apg-spotlight__controls">
      <span className="apg-spotlight__count" aria-hidden="true">{String(current+1).padStart(2,'0')} <span>/ {String(items.length).padStart(2,'0')}</span></span>
      <div className="apg-spotlight__dots" aria-label="Choisir une mise à la une">
        {items.map((item,index)=><button key={item.id} type="button" aria-label={`Afficher ${item.title}`} aria-current={index===current?'true':undefined} aria-controls={id} onClick={()=>goTo(index)}/>)}
      </div>
      <span className="apg-visually-hidden" aria-live={paused?'polite':'off'} aria-atomic="true">Diapositive {current+1} sur {items.length}</span>
    </div>:null}
  </section>;
}

export function NewsRail({items,title,intro,kicker}:{items:Highlight[];title:string;intro:string;kicker:string}) {
  const id=useId();
  if(!items.length)return null;
  return <section className="apg-news" aria-labelledby={id+'-heading'}>
    <header className="apg-news__header"><div><p className="apg-news__kicker">{kicker}</p><h2 id={id+'-heading'}>{title}</h2>{intro?<p className="apg-news__intro">{intro}</p>:null}</div>
    </header>
    <div id={id} className="apg-news__rail" tabIndex={0} role="region" aria-label="Nouveautés et découvertes à faire défiler">
      {items.map(item=><article className="apg-news__card" key={item.id}>
        <a href={item.href}>
          <div className="apg-news__visual"><Image src={item.image} alt={item.alt} fill sizes="(max-width: 620px) 82vw, (max-width: 980px) 45vw, 32vw" style={{objectFit:item.image_fit}}/>{item.kicker?<span className="apg-news__badge">{item.kicker}</span>:null}</div>
          <div className="apg-news__copy"><h3>{item.title}</h3>{item.description?<p>{item.description}</p>:null}<span className="apg-news__link"><span data-ve-label>{item.button_label}</span><span className="apg-link-icon" aria-hidden="true"> ↗</span></span></div>
        </a>
      </article>)}
    </div>
    <p className="apg-news__hint">Faites glisser pour découvrir la suite</p>
  </section>;
}
