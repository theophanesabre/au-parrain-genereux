import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePrelaunch,prelaunchEnabled} from '../site/prelaunch.mjs';
test('the complete storefront is public, including product pages and previous preview links',async()=>{
 assert.equal(prelaunchEnabled,false);
 for(const path of ['/','/boutique','/boutique/','/boutique/calendrier-conte-avent','/chocolats','/maison','/savoir-faire','/bonbons','/panier','/contenu/livraison','/boutique?apercu=1'])for(const method of ['GET','HEAD'])assert.equal(await handlePrelaunch(new Request('https://maison.example'+path,{method}),{}),null,path);
});
test('opening the storefront does not intercept administration, authentication, assets or payment routes',async()=>{
 for(const path of ['/admin','/admin/api/products','/admin/api/stripe','/images/logo-boutique-neon.webp','/signin-with-chatgpt','/media/123','/api/paiement/config'])assert.equal(await handlePrelaunch(new Request('https://maison.example'+path),{}),null,path);
});
