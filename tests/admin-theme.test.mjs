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
 const frame={contentWindow:{postMessage(data,origin){posts.push({data,origin});}},addEventListener(){},removeEventListener(){}};
 const parent={postMessage(data,origin){posts.push({data,origin});}};
 const window={parent:null,addEventListener(k,v){windowEvents.set(k,v);},removeEventListener(k){windowEvents.delete(k);}};window.parent=embedded?parent:window;
 const document={documentElement:root,body:{},querySelectorAll(selector){if(selector==='iframe')return [frame];if(selector==='[data-admin-theme-toggle]')return [toggle];if(selector.startsWith('button:not'))return [add,remove,neutral];return [];},addEventListener(k,v){listeners.set(k,v);},removeEventListener(k){listeners.delete(k);}};
 let observer;class MutationObserver{constructor(fn){observer=this;this.fn=fn;}observe(){}disconnect(){this.disconnected=true;}}
 const context=createContext({document,window,location:{origin:'https://apg.example'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},MutationObserver});
 const cleanup=new Script('('+adminThemeClient.toString()+')()').runInContext(context);
 return {root,toggle,add,remove,neutral,posts,frame,parent,windowEvents,listeners,storage,cleanup,get observer(){return observer;},click(){listeners.get('click')({target:{closest:()=>toggle}});}};
}
test('admin starts white and persists dark choice while synchronising embedded screens',()=>{
 const h=harness();assert.equal(h.root.dataset.apgAdminTheme,'light');assert.equal(h.toggle.attributes['aria-pressed'],'false');h.click();assert.equal(h.root.dataset.apgAdminTheme,'dark');assert.equal(h.storage.get('apg-admin-theme'),'dark');assert.equal(h.toggle.attributes['aria-pressed'],'true');assert.equal(h.posts.at(-1).data.theme,'dark');assert.equal(h.posts.at(-1).origin,'https://apg.example');
 const restored=harness({saved:'dark'});assert.equal(restored.root.dataset.apgAdminTheme,'dark');h.windowEvents.get('storage')({key:'apg-admin-theme',newValue:'light'});assert.equal(h.root.dataset.apgAdminTheme,'light');h.cleanup();restored.cleanup();
});
test('only approved same-origin parent can set an embedded theme and admin cleanup restores page isolation',()=>{
 const h=harness({embedded:true});const message=h.windowEvents.get('message');message({origin:'https://evil.example',source:h.parent,data:{type:'apg-admin-theme',theme:'dark'}});assert.equal(h.root.dataset.apgAdminTheme,'light');message({origin:'https://apg.example',source:{},data:{type:'apg-admin-theme',theme:'dark'}});assert.equal(h.root.dataset.apgAdminTheme,'light');message({origin:'https://apg.example',source:h.parent,data:{type:'apg-admin-theme',theme:'dark'}});assert.equal(h.root.dataset.apgAdminTheme,'dark');assert.equal(h.storage.size,0);h.cleanup();assert.equal(h.root.dataset.apgAdminTheme,undefined);assert.equal(h.observer.disconnected,true);assert.equal(h.listeners.size,0);assert.equal(h.windowEvents.size,0);
});
test('add and remove buttons have explicit semantic markers while ordinary saves stay neutral',()=>{
 const h=harness();assert.equal(h.add.dataset.adminAction,'add');assert.equal(h.remove.dataset.adminAction,'remove');assert.equal(h.neutral.dataset.adminAction,undefined);h.cleanup();
});
test('all standalone admin surfaces retain a centered logo, theme control and nonce scripts',()=>{
 for(const html of [adminHTML('theme-test'),inventoryHTML('theme-test'),paymentsHTML('theme-test')]){
  assert.equal((html.match(/<img class="admin-center-logo"/g)||[]).length,1);assert.match(html,/data-admin-theme-toggle/);assert.match(html,/data-apg-admin-theme=dark/);assert.match(html,/<script nonce="theme-test">/);
 }
});
