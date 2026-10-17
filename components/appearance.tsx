'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultAppearance, validateAppearance } from '@/admin/appearance.mjs';
export type Appearance={background:string;spacing:string;buttons:string;corners:string;hero:string;columns:string;historyLabel:string;historyHref:string;collectionLabel:string;collectionHref:string;sections:{id:string;visible:boolean}[]};
const AppearanceContext=createContext<Appearance>(defaultAppearance);
export function AppearanceShell({initial,children}:{initial:Appearance;children:ReactNode}){
 const [settings,setSettings]=useState(initial);
 useEffect(()=>{
  if(new URLSearchParams(window.location.search).get('apercu')!=='1'||window.parent===window)return;
  const receive=(event:MessageEvent)=>{if(event.origin!==window.location.origin||event.source!==window.parent||event.data?.type!=='apg-appearance')return;try{setSettings(validateAppearance(event.data.settings) as Appearance);}catch{/* Ignore invalid preview messages. */}};
  const navigate=(event:MouseEvent)=>{const anchor=(event.target as Element).closest('a');if(!anchor||anchor.target==='_blank')return;const url=new URL(anchor.href,location.href);if(url.origin!==location.origin||url.pathname.startsWith('/admin'))return;url.searchParams.set('apercu','1');anchor.href=url.href;};
  document.addEventListener('click',navigate);
  window.addEventListener('message',receive);window.parent.postMessage({type:'apg-preview-ready'},window.location.origin);
  return ()=>{window.removeEventListener('message',receive);document.removeEventListener('click',navigate);};
 },[]);
 return <AppearanceContext.Provider value={settings}><div className="apg-site" data-background={settings.background} data-spacing={settings.spacing} data-buttons={settings.buttons} data-corners={settings.corners} data-hero={settings.hero} data-columns={settings.columns}>{children}</div></AppearanceContext.Provider>;
}
export function HomeSections({sections}:{sections:{id:string;content:ReactNode}[]}){
 const settings=useContext(AppearanceContext);
 return <>{settings.sections.filter(section=>section.visible).map(section=><div className="apg-home-section" key={section.id} data-home-section={section.id}>{sections.find(item=>item.id===section.id)?.content}</div>)}</>;
}

export function HomeButton({kind}:{kind:'history'|'collection'}){const settings=useContext(AppearanceContext);return <a href={kind==='history'?settings.historyHref:settings.collectionHref}>{kind==='history'?settings.historyLabel:settings.collectionLabel}</a>;}
