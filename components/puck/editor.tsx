'use client';
import { ConsumerRequests } from '../consumer-requests';
import { ShippingSettings } from './shipping-settings';
import { MediaLibrary } from './media-library';
import { useEffect, useRef, useState } from 'react';
const sections=[['products','Articles et stocks'],['recipes','Recettes'],['highlights','Nouveautés'],['images','Médiathèque'],['orders','Commandes'],['shipping','Livraisons'],['withdrawals','Rétractations'],['audit','Historique']] as const;
type Section=typeof sections[number][0];
const modules=[{id:'products',label:'Articles',entry:'products',sections:['products','recipes','highlights']},{id:'orders',label:'Commandes',entry:'orders',sections:['orders','shipping','withdrawals','audit']},{id:'images',label:'Médiathèque',entry:'images',sections:['images']}] as const;
export function AdminWorkspace(){
 const [section,setSection]=useState<Section>('products'),[dirty,setDirty]=useState(false),[revision,setRevision]=useState(0),[item,setItem]=useState('');const manager=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{const query=new URLSearchParams(location.search),selected=query.get('section');if(sections.some(([key])=>key===selected))setSection(selected as Section);else history.replaceState(null,'','/admin/puck?section=products');setItem(query.get('item')||'');},[]);
 useEffect(()=>{const prevent=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[dirty]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==manager.current?.contentWindow)return;if(event.data?.type==='apg-manager-dirty')setDirty(Boolean(event.data.dirty));if(event.data?.type==='apg-manager-saved')setDirty(false);};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
 function navigate(next:Section){if(next===section)return;if(dirty&&!window.confirm('Des modifications ne sont pas enregistrées. Les abandonner pour changer de rubrique ?'))return;setDirty(false);setItem('');setSection(next);setRevision(value=>value+1);history.replaceState(null,'','/admin/puck?section='+next);}
 const active=modules.find(module=>(module.sections as readonly string[]).includes(section))!;
 return <div className="apg-puck-editor"><header className="apg-workspace-header"><a href="/admin"><img src="/images/logo-boutique-neon.webp" alt="Au Parrain Généreux"/></a><div><h1>Administration</h1><p>Votre maison, simplement.</p></div><a href="/admin/paiements">Paiements Stripe</a><a href="/?apercu=1" target="_blank" rel="noreferrer">Voir le site</a></header>
 <nav className="apg-workspace-modules" aria-label="Modules de l’administration">{modules.map(module=><button type="button" key={module.id} aria-current={active.id===module.id?'page':undefined} onClick={()=>navigate(module.entry)}>{module.label}</button>)}</nav>
 <section className="apg-workspace-surface" aria-label={active.label}>{active.sections.length>1?<nav className="apg-workspace-nav" aria-label={'Rubriques · '+active.label}>{sections.filter(([key])=>(active.sections as readonly string[]).includes(key)).map(([key,label])=><button type="button" key={key} aria-current={section===key?'page':undefined} onClick={()=>navigate(key)}>{label}</button>)}</nav>:null}
 {section==='withdrawals'?<ConsumerRequests/>:section==='shipping'?<ShippingSettings onDirty={setDirty}/>:section==='images'?<MediaLibrary onSaved={()=>{}}/>:<iframe ref={manager} key={section+':'+revision} className="apg-management-frame" title={sections.find(([key])=>key===section)?.[1]} src={'/admin?workspace=1&tab='+section+'&item='+encodeURIComponent(item)}/>}
 </section></div>;
}
