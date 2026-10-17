'use client';
import { VisualRuntime } from './visual-runtime';
import { visualStyle } from './visual-style';
import type { VisualSettings } from './visual-types';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultAppearance, validateAppearance } from '@/admin/appearance.mjs';
export type CustomButton={id:string;label:string;href:string;page:string;location:string;position:string;align:string;style:string;size:string;visible:boolean};
export type Appearance={background:string;spacing:string;buttons:string;corners:string;hero:string;columns:string;historyLabel:string;historyHref:string;collectionLabel:string;collectionHref:string;customButtons:CustomButton[];visual:VisualSettings;sections:{id:string;visible:boolean}[]};
const AppearanceContext=createContext<Appearance>(defaultAppearance);
export function AppearanceShell({initial,children}:{initial:Appearance;children:ReactNode}){
 const [settings,setSettings]=useState<Appearance>(initial??defaultAppearance);
 const path=usePathname()||'/';
 useEffect(()=>{
  if(new URLSearchParams(window.location.search).get('apercu')!=='1')return;
  const embedded=window.parent!==window;
  const receive=(event:MessageEvent)=>{if(!embedded||event.origin!==window.location.origin||event.source!==window.parent||event.data?.type!=='apg-appearance')return;try{setSettings(validateAppearance(event.data.settings) as Appearance);}catch{/* Ignore invalid preview messages. */}};
  const navigate=(event:MouseEvent)=>{const anchor=(event.target as Element).closest('a');if(!anchor||anchor.target==='_blank')return;const url=new URL(anchor.href,location.href);if(url.origin!==location.origin||!['/','/maison','/savoir-faire','/bonbons','/boutique','/panier','/paiement'].includes(url.pathname.replace(/\/+$/,'')||'/'))return;url.searchParams.set('apercu','1');anchor.href=url.href;};
  document.addEventListener('click',navigate,true);
  window.addEventListener('message',receive);if(embedded)window.parent.postMessage({type:'apg-preview-ready'},window.location.origin);
  return ()=>{window.removeEventListener('message',receive);document.removeEventListener('click',navigate,true);};
 },[]);
 if(path.startsWith('/admin/'))return <>{children}</>;
 return <AppearanceContext.Provider value={settings}><div className="apg-site" data-background={settings.background} data-pattern={settings.visual.pattern||'inherit'} data-spacing={settings.spacing} data-buttons={settings.buttons} data-corners={settings.corners} data-hero={settings.hero} data-columns={settings.columns} data-visual-font={settings.visual.font} data-link-icons={settings.visual.icons?'show':'hide'} style={{'--apg-stripe-color':settings.visual.stripeColor||'#f5e6da','--apg-stripe-width':`${settings.visual.stripeWidth??38}px`,'--apg-stripe-period':`${(settings.visual.stripeWidth??38)*2}px`,'--apg-stripe-angle':`${settings.visual.stripeAngle??90}deg`,'--apg-accent':settings.visual.accent,'--apg-surface':settings.visual.surface,'--apg-ink':settings.visual.ink,'--apg-scale':String(settings.visual.scale/100)} as React.CSSProperties}><VisualRuntime settings={settings.visual} page={path}/>{children}</div></AppearanceContext.Provider>;
}
export function HomeSections({sections}:{sections:{id:string;content:ReactNode}[]}){
 const settings=useContext(AppearanceContext);
 return <>{settings.sections.filter(section=>section.visible).map(section=><div className="apg-home-section" key={section.id} data-home-section={section.id} data-ve-native={section.id}><VisualBlocks page="/" anchor={section.id} position="before"/><AppearanceButtons page="/" location={section.id} position="before"/>{sections.find(item=>item.id===section.id)?.content}<AppearanceButtons page="/" location={section.id} position="after"/><VisualBlocks page="/" anchor={section.id} position="after"/></div>)}</>;
}

export function HomeButton({kind}:{kind:'history'|'collection'}){const settings=useContext(AppearanceContext);return <a href={kind==='history'?settings.historyHref:settings.collectionHref}>{kind==='history'?settings.historyLabel:settings.collectionLabel}</a>;}

export function AppearanceButtons({page,location,position='after'}:{page:string;location:string;position?:string}){
 const settings=useContext(AppearanceContext);
 const buttons=(settings.customButtons||[]).filter(button=>button.visible&&button.page===page&&button.location===location&&(location.startsWith('page-')||button.position===position));
 if(!buttons.length)return null;
 return <div className="apg-custom-buttons" aria-label="Liens proposés par la maison">{buttons.map(button=><div key={button.id} className="apg-custom-buttons__row" data-align={button.align}><a className="apg-custom-button" data-style={button.style} data-size={button.size} href={button.href}><span data-ve-label>{button.label}</span><span className="apg-link-icon" aria-hidden="true"> ↗</span></a></div>)}</div>;
}
export function PageButtons({location}:{location:'page-top'|'page-bottom'}){const path=usePathname();return <><AppearanceButtons page={path||'/'} location={location}/><VisualBlocks page={path||'/'} anchor={location}/></>;}

export function VisualBlocks({page,anchor,position='after'}:{page:string;anchor:string;position?:string}){
 const {visual}=useContext(AppearanceContext);
 const blocks=visual.blocks.filter(block=>block.visible&&block.page===page&&block.anchor===anchor&&(anchor.startsWith('page-')||block.position===position));
 return <>{blocks.map(block=><section key={block.id} className="apg-added-block" data-ve-new={block.id} style={visualStyle(block.style)}>
 {block.kind==='text'?<>{block.title?<h2>{block.title}</h2>:null}<p style={{whiteSpace:'pre-line'}}>{block.body}</p></>:null}
 {block.kind==='image'?<figure><img src={block.image} alt={block.alt}/>{block.body?<figcaption>{block.body}</figcaption>:null}</figure>:null}
 {block.kind==='button'?<a className="apg-shop-primary" href={block.href}><span data-ve-label>{block.label}</span><span className="apg-link-icon" aria-hidden="true"> ↗</span></a>:null}
 {block.kind==='spacer'?<div aria-hidden="true" style={{height:block.style.minHeight||40}}/>:null}
 </section>)}</>;
}
export function PageSections({page,items}:{page:string;items:{id:string;content:ReactNode}[]}){
 const {visual}=useContext(AppearanceContext);const layout=visual.layouts[page]||items.map(item=>({id:item.id,visible:true}));
 return <>{layout.filter(item=>item.visible).map(item=><div className="apg-page-section" key={item.id} data-ve-native={item.id}><VisualBlocks page={page} anchor={item.id} position="before"/>{items.find(block=>block.id===item.id)?.content}<VisualBlocks page={page} anchor={item.id} position="after"/></div>)}</>;
}
