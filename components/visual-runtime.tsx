'use client';
import { useEffect, useRef } from 'react';
import { visualStyle } from './visual-style';
import type { VisualSettings } from './visual-types';
const tags='h1,h2,h3,h4,p,span,strong,em,a,img,section,header,footer,article,figure,address,nav,div,button';
const pxless=new Set(['lineHeight','opacity','fontWeight','order','zIndex','flexGrow','flexShrink']);
function source(image:HTMLImageElement){const url=new URL(image.getAttribute('src')||'',location.href);return url.pathname==='/_vinext/image'?url.searchParams.get('url')||url.pathname:url.pathname;}
function keyFor(node:Element,root:Element){
 const anchor=node.closest('[data-ve-native],[data-ve-new],[data-home-section]');const parts:string[]=[];let current:Element|null=node;
 while(current&&current!==root&&current!==anchor){const tag=current.tagName.toLowerCase();const siblings=current.parentElement?[...current.parentElement.children].filter(item=>item.tagName===current!.tagName):[current];parts.unshift(`${tag}:${siblings.indexOf(current)+1}`);current=current.parentElement;}
 const prefix=anchor?.getAttribute('data-ve-native')||anchor?.getAttribute('data-ve-new')||anchor?.getAttribute('data-home-section')||'root';return `${prefix}/${parts.join('/')||'block'}`;
}
export function VisualRuntime({settings,page}:{settings:VisualSettings;page:string}){
 const selected=useRef<string|null>(null);
 useEffect(()=>{
  const root=document.querySelector('.apg-site');if(!root||!settings)return;
  const editing=new URLSearchParams(location.search).get('edition')==='1'&&window.parent!==window;if(!editing&&!settings.overrides.some(item=>item.page===page))return;
  const originals=new Map<HTMLElement,{style:string|null;hidden:boolean;text?:string;textTarget?:HTMLElement;src?:string|null;srcset?:string|null;href?:string|null;alt?:string|null}>();
  const nodes=new Map<string,HTMLElement>();let frame=0;
  if(editing)root.setAttribute('data-visual-editing','true');
  function restore(){for(const [node,old] of originals){if(!node.isConnected)continue;if(old.style===null)node.removeAttribute('style');else node.setAttribute('style',old.style);node.hidden=old.hidden;if(old.text!==undefined)(old.textTarget||node).textContent=old.text;if(old.src!==undefined){if(old.src===null)node.removeAttribute('src');else node.setAttribute('src',old.src);if(old.srcset===null)node.removeAttribute('srcset');else if(old.srcset!==undefined)node.setAttribute('srcset',old.srcset);}if(old.href!==undefined){if(old.href===null)node.removeAttribute('href');else node.setAttribute('href',old.href);}if(old.alt!==undefined){if(old.alt===null)node.removeAttribute('alt');else node.setAttribute('alt',old.alt);}}originals.clear();}
  const observer=new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(apply);});
  function apply(){observer.disconnect();restore();nodes.clear();if(!root)return;
   for(const node of root.querySelectorAll<HTMLElement>(tags)){if(node.closest('[data-ve-ignore]'))continue;nodes.set(keyFor(node,root),node);}
   for(const entry of settings.overrides.filter(item=>item.page===page)){const node=nodes.get(entry.id);if(!node)continue;const protectedContent=Boolean(node.closest('[data-ve-commerce]'));
    const label=node.tagName==='A'?node.querySelector<HTMLElement>('[data-ve-label]'):null;const textTarget=label||node;const canText=!protectedContent&&node.tagName!=='BUTTON'&&node.tagName!=='IMG'&&textTarget.childElementCount===0;
    originals.set(node,{style:node.getAttribute('style'),hidden:node.hidden,text:entry.text!==undefined&&canText?textTarget.textContent||'':undefined,textTarget,src:entry.image!==undefined&&node.tagName==='IMG'&&!protectedContent?node.getAttribute('src'):undefined,srcset:node.getAttribute('srcset'),alt:entry.alt!==undefined&&node.tagName==='IMG'&&!protectedContent?node.getAttribute('alt'):undefined,href:entry.href!==undefined&&node.tagName==='A'&&!protectedContent?node.getAttribute('href'):undefined});
    const styles=visualStyle(entry.style);for(const [key,value] of Object.entries(styles)){if(value===undefined)continue;const property=key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase());node.style.setProperty(property,typeof value==='number'&&!pxless.has(key)?value+'px':String(value),'important');}
    if(entry.text!==undefined&&canText)textTarget.textContent=entry.text;
    if(entry.image!==undefined&&node.tagName==='IMG'&&!protectedContent){node.setAttribute('src',entry.image);node.removeAttribute('srcset');}
    if(entry.alt!==undefined&&node.tagName==='IMG'&&!protectedContent)node.setAttribute('alt',entry.alt);
    if(entry.href!==undefined&&node.tagName==='A'&&!protectedContent)node.setAttribute('href',entry.href);
    if(entry.hidden&&!protectedContent)node.style.setProperty('display','none','important');
   }
   if(selected.current&&nodes.get(selected.current))nodes.get(selected.current)!.classList.add('apg-visual-selected');
   observer.observe(root,{childList:true,subtree:true});
  }
  function choose(node:HTMLElement){if(!root||node===root)return;if(getComputedStyle(node).display==='contents'&&node.firstElementChild)node=node.firstElementChild as HTMLElement;root.querySelectorAll('.apg-visual-selected').forEach(item=>item.classList.remove('apg-visual-selected'));const id=keyFor(node,root);selected.current=id;node.classList.add('apg-visual-selected');const computed=getComputedStyle(node);const protectedContent=Boolean(node.closest('[data-ve-commerce]'));const textTarget=(node.tagName==='A'?node.querySelector<HTMLElement>('[data-ve-label]'):null)||node;
   window.parent.postMessage({type:'apg-visual-selection',selection:{id,page,tag:node.tagName.toLowerCase(),text:textTarget.textContent?.slice(0,6000)||'',canText:!protectedContent&&textTarget.childElementCount===0&&!['BUTTON','IMG'].includes(node.tagName),canImage:!protectedContent&&node.tagName==='IMG',canLink:!protectedContent&&node.tagName==='A',image:node.tagName==='IMG'?source(node as HTMLImageElement):'',alt:node.getAttribute('alt')||'',href:node.getAttribute('href')||'',native:node.closest('[data-ve-native]')?.getAttribute('data-ve-native')||'',newBlock:node.closest('[data-ve-new]')?.getAttribute('data-ve-new')||'',protectedContent,computed:{color:computed.color,backgroundColor:computed.backgroundColor,fontSize:parseFloat(computed.fontSize),lineHeight:parseFloat(computed.lineHeight)/parseFloat(computed.fontSize),paddingTop:parseFloat(computed.paddingTop),paddingRight:parseFloat(computed.paddingRight),paddingBottom:parseFloat(computed.paddingBottom),paddingLeft:parseFloat(computed.paddingLeft),marginTop:parseFloat(computed.marginTop),marginBottom:parseFloat(computed.marginBottom),gap:parseFloat(computed.gap)||0,borderRadius:parseFloat(computed.borderRadius),textAlign:computed.textAlign}}},location.origin);
  }
  function click(event:MouseEvent){let target=(event.target as Element).closest(tags) as HTMLElement|null;if(target?.closest('[data-ve-label]'))target=target.closest('a')||target;if(!target||target===root||!root?.contains(target)||target.closest('[data-ve-ignore]'))return;event.preventDefault();event.stopImmediatePropagation();choose(target);}
  function command(event:MessageEvent){if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='apg-visual-command')return;const node=nodes.get(event.data.id||selected.current||'');if(!node)return;if(event.data.action==='parent'){let parent=node.parentElement;while(parent&&parent!==root&&!parent.matches(tags))parent=parent.parentElement;if(parent&&parent!==root)choose(parent);}if(event.data.action==='locate'){const target=getComputedStyle(node).display==='contents'?(node.firstElementChild as HTMLElement)||node:node;target.scrollIntoView({block:'center',behavior:'instant'});choose(target);}}
  apply();if(editing){document.addEventListener('click',click,true);window.addEventListener('message',command);window.parent.postMessage({type:'apg-visual-ready',page},location.origin);}
  return ()=>{observer.disconnect();cancelAnimationFrame(frame);restore();root.querySelectorAll('.apg-visual-selected').forEach(item=>item.classList.remove('apg-visual-selected'));root.removeAttribute('data-visual-editing');document.removeEventListener('click',click,true);window.removeEventListener('message',command);};
 },[settings,page]);
 return null;
}
