import test from 'node:test';
import assert from 'node:assert/strict';
import {Script,createContext} from 'node:vm';
import {adminThemeClient} from '../admin/theme.mjs';
import {adminHTML} from '../admin/ui.mjs';
import {inventoryHTML} from '../admin/inventory/ui.mjs';
import {paymentsHTML} from '../admin/payments-ui.mjs';
function harness({saved=null,embedded=false}={}){
 const listeners=new Map(),windowEvents=new Map(),root={dataset:{}},storage=new Map(saved?[['apg-admin-theme',saved]]:[]),posts=[];
 const button=label=>({textContent:label,dataset:{},attributes:{},getAttribute(k){return this.attributes[k];},setAttribute(k,v){this.attributes[k]=v;}});
 const toggle=button('Mode sombre'),add=button('+ Ajouter un produit'),remove=button('Supprimer'),neutral=button('Enregistrer');
 const frameListeners=new Map();const frames=[];const frame={contentDocument:{documentElement:{dataset:{}}},contentWindow:{postMessage(data,origin){posts.push({data,origin});}},addEventListener(k,fn){frameListeners.set(k,fn);},removeEventListener(k){frameListeners.delete(k);}};frames.push(frame);
 const parent={postMessage(data,origin){posts.push({data,origin});}};
 const window={parent:null,addEventListener(k,v){windowEvents.set(k,v);},removeEventListener(k){windowEvents.delete(k);}};window.parent=embedded?parent:window;
 const document={documentElement:root,body:{},querySelectorAll(selector){if(selector==='iframe')return frames;if(selector==='[data-admin-theme-toggle]')return [toggle];if(selector.startsWith('button:not'))return [add,remove,neutral];return [];},addEventListener(k,v){listeners.set(k,v);},removeEventListener(k){listeners.delete(k);}};
 let observer;class MutationObserver{constructor(fn){observer=this;this.fn=fn;}observe(){}disconnect(){this.disconnected=true;}}
 const context=createContext({document,window,location:{origin:'https://apg.example'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},MutationObserver});
 const cleanup=new Script('('+adminThemeClient.toString()+')()').runInContext(context);
 return {frames,frameListeners,root,toggle,add,remove,neutral,posts,frame,parent,windowEvents,listeners,storage,cleanup,get observer(){return observer;},click(){listeners.get('click')({target:{closest:()=>toggle}});}};
}
test('administration always starts in light mode and discards the old dark preference',()=>{
 const h=harness({saved:'dark'});assert.equal(h.root.dataset.apgAdminTheme,'light');assert.equal(h.storage.has('apg-admin-theme'),false);h.cleanup();assert.equal(h.root.dataset.apgAdminTheme,undefined);assert.equal(h.observer.disconnected,true);
});
test('add and remove actions retain their semantic colors after content updates',()=>{
 const h=harness();assert.equal(h.add.dataset.adminAction,'add');assert.equal(h.remove.dataset.adminAction,'remove');assert.equal(h.neutral.dataset.adminAction,undefined);h.add.dataset.adminAction='';h.observer.fn();assert.equal(h.add.dataset.adminAction,'add');h.cleanup();
});
test('standalone admin pages retain the centered logo and contain no dark mode control',()=>{
 for(const html of [adminHTML('theme-test'),inventoryHTML('theme-test'),paymentsHTML('theme-test')]){
  assert.equal((html.match(/<img class="admin-center-logo"/g)||[]).length,1);assert.doesNotMatch(html,/<button[^>]*data-admin-theme-toggle/);assert.doesNotMatch(html,/data-apg-admin-theme=dark/);assert.match(html,/<script nonce="theme-test">/);
 }
});
