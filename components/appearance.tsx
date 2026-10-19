'use client';
import { visualStyle } from './visual-style';
import type { VisualSettings } from './visual-types';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultShop } from '@/admin/shop.mjs';
import { CartLink } from './cart';
import { defaultChrome, defaultAppearance, validateAppearance } from '@/admin/appearance.mjs';
export type CustomButton={id:string;label:string;href:string;page:string;location:string;position:string;align:string;style:string;size:string;visible:boolean};
export type Appearance={shop:typeof defaultShop;stripedEverywhere:boolean;chrome:typeof defaultChrome;navigation:{groupLabel:string;items:{label:string;href:string;group:boolean}[]};background:string;spacing:string;buttons:string;corners:string;hero:string;columns:string;historyLabel:string;historyHref:string;collectionLabel:string;collectionHref:string;customButtons:CustomButton[];visual:VisualSettings;sections:{id:string;visible:boolean}[]};
const AppearanceContext=createContext<Appearance>(defaultAppearance);
export function AppearanceShell({initial,children}:{initial:Appearance;children:ReactNode}){
 const [settings,setSettings]=useState<Appearance>(initial??defaultAppearance);
 const path=usePathname()||'/';
 useEffect(()=>{const update=(event:Event)=>{try{setSettings(validateAppearance((event as CustomEvent).detail) as Appearance);}catch{}};window.addEventListener('apg-settings-updated',update);return()=>window.removeEventListener('apg-settings-updated',update);},[]);
 useEffect(()=>{
  if(new URLSearchParams(window.location.search).get('apercu')!=='1')return;
  const embedded=window.parent!==window;
  const receive=(event:MessageEvent)=>{if(!embedded||event.origin!==window.location.origin||event.source!==window.parent||event.data?.type!=='apg-appearance')return;try{setSettings(validateAppearance(event.data.settings) as Appearance);}catch{/* Ignore invalid preview messages. */}};
  const navigate=(event:MouseEvent)=>{const anchor=(event.target as Element).closest('a');if(!anchor||anchor.target==='_blank')return;const url=new URL(anchor.href,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/boutique/')&&!['/','/maison','/savoir-faire','/bonbons','/chocolats','/boutique','/panier','/paiement'].includes(url.pathname.replace(/\/+$/,'')||'/'))return;url.searchParams.set('apercu','1');anchor.href=url.href;};
  document.addEventListener('click',navigate,true);
  window.addEventListener('message',receive);if(embedded)window.parent.postMessage({type:'apg-preview-ready'},window.location.origin);
  return ()=>{window.removeEventListener('message',receive);document.removeEventListener('click',navigate,true);};
 },[]);
 if(path.startsWith('/admin/'))return <AppearanceContext.Provider value={settings}>{children}</AppearanceContext.Provider>;
 return <AppearanceContext.Provider value={settings}><div className="apg-site" data-background={settings.background} data-pattern={settings.stripedEverywhere&&settings.visual.pattern!=='stripes'?'inherit':settings.visual.pattern||'inherit'} data-striped-everywhere={settings.stripedEverywhere} data-spacing={settings.spacing} data-buttons={settings.buttons} data-corners={settings.corners} data-hero={settings.hero} data-columns={settings.columns} data-visual-font={settings.visual.font} data-link-icons={settings.visual.icons?'show':'hide'} style={{'--apg-site-surface':settings.visual.surface,'--apg-stripe-color':settings.visual.stripeColor||'#f5e6da','--apg-stripe-width':`${settings.visual.stripeWidth??38}px`,'--apg-stripe-period':`${(settings.visual.stripeWidth??38)*2}px`,'--apg-stripe-angle':`${settings.visual.stripeAngle??90}deg`,'--apg-accent':settings.visual.accent,'--apg-surface':settings.visual.surface,'--apg-ink':settings.visual.ink,'--apg-scale':String(settings.visual.scale/100)} as React.CSSProperties}>{children}</div></AppearanceContext.Provider>;
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

export function MenuLinks({flat=false}:{flat?:boolean}){
 const {navigation}=useContext(AppearanceContext);
 const items=navigation.items,grouped=items.filter(item=>item.group);
 const link=(item:{label:string;href:string},index:number)=><a href={item.href} key={index}>{item.label}</a>;
 if(flat)return <>{items.map(link)}</>;
 return <>{grouped.length?<details className="apg-menu-group"><summary>{navigation.groupLabel}</summary><div className="apg-menu-group__links">{grouped.map(link)}</div></details>:null}{items.filter(item=>!item.group).map(link)}</>;
}

type HeaderFallback={logo?:string;logoWidth?:number;background?:string};
export function StoreHeader({logo='/images/logo-boutique-neon.webp',logoWidth=100,background='#fffdf9'}:HeaderFallback){
 const {chrome}=useContext(AppearanceContext);
 return <header className="apg-store-header" data-logo-position={chrome.logoPosition} data-sticky={chrome.sticky} style={{background:chrome.headerBackground||background,color:chrome.headerColor||'var(--apg-ink,#30271f)','--header-background':chrome.headerBackground||background,'--header-padding':`${chrome.headerPadding}px`,'--menu-size':`${chrome.menuSize}px`,'--menu-gap':`${chrome.menuGap}px`} as React.CSSProperties}>
  <a className="apg-store-logo" href="/" aria-label="Au Parrain Généreux — Accueil"><img src={chrome.logo||logo} alt="Au Parrain Généreux" style={{width:chrome.logoWidth||logoWidth}}/></a>
  <nav className="apg-store-desktop" aria-label="Navigation principale"><MenuLinks/></nav><div className="apg-store-actions"><CartLink/><details className="apg-store-mobile"><summary aria-label="Ouvrir le menu">☰</summary><nav aria-label="Navigation mobile"><MenuLinks/></nav></details></div>
 </header>;
}
type ContactCardProps={name?:string;address:string;hours:string;phone:string;email:string};
export function ContactCard({name='Au Parrain Généreux',address,hours,phone,email}:ContactCardProps){
 const lines=(value:string)=>value.replace(/\s*·\s*/, '\n').split('\n').filter(line=>line.trim());
 return <div className="apg-contact-card" aria-label="Coordonnées de la boutique">
  <section className="apg-contact-card__section"><h3>Nous rendre visite —</h3><p className="apg-contact-card__name">{name}</p><address>{lines(address).map((line,index)=><p key={index}>{line}</p>)}</address></section>
  {hours?<section className="apg-contact-card__section"><h3>Horaires —</h3>{lines(hours).map((line,index)=><p key={index}>{line}</p>)}</section>:null}
  {phone||email?<section className="apg-contact-card__section"><h3>Nous contacter —</h3>{phone?<p><a href={'tel:'+phone.replace(/[^+0-9]/g,'')}>{phone}</a></p>:null}{email?<p><a href={'mailto:'+email}>{email}</a></p>:null}</section>:null}
 </div>;
}
type FooterFallback={title:string;text:string;address:string;hours:string;phone:string;email:string;background?:string;logo?:string;anchor?:string};
export function StoreFooter(props:FooterFallback){
 const {chrome}=useContext(AppearanceContext);const content=chrome.overrideContent?{title:chrome.footerTitle,text:chrome.footerText,address:chrome.address,hours:chrome.hours,phone:chrome.phone,email:chrome.email}:props;
 return <footer id={props.anchor} className="apg-store-footer" style={{background:chrome.footerBackground||props.background||'#fffdf9',color:chrome.footerColor||'var(--apg-ink,#30271f)',padding:`${chrome.footerPadding}px clamp(20px,5vw,80px)`,'--footer-columns':chrome.footerColumns} as React.CSSProperties}>
 <div className="apg-store-footer__grid"><div>{chrome.showFooterLogo?<img className="apg-store-footer__logo" src={chrome.logo||props.logo||'/images/logo-boutique-neon.webp'} alt="Au Parrain Généreux"/>:null}{content.title?<h2>{content.title}</h2>:null}{content.text?<p>{content.text}</p>:null}</div>
 {chrome.showFooterLinks?<nav aria-label="Liens de bas de page"><h3>Liens utiles</h3><MenuLinks flat/></nav>:null}
 <ContactCard address={content.address} hours={content.hours} phone={content.phone} email={content.email}/></div><p className="apg-store-footer__legal">{chrome.legal||'© 2026 Au Parrain Généreux'}</p>
 </footer>;
}

export function useShopSettings(){return useContext(AppearanceContext).shop;}
