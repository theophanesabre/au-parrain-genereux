import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePrelaunch} from '../site/prelaunch.mjs';
const req=(path,headers={},method='GET')=>new Request('https://maison.example'+path,{headers,method});
test('prelaunch shows the logo and message while unfinished pages temporarily redirect',async()=>{
 const response=await handlePrelaunch(req('/'),{});assert.equal(response.status,200);const html=await response.text();assert.match(html,/Notre boutique en ligne<br>arrive bientôt/);assert.match(html,/logo-boutique-neon.webp/);assert.match(html,/#FF6A00/);assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('content-security-policy'),/default-src 'none'/);
 for(const path of ['/boutique/calendrier-conte-avent','/boutique','/boutique/','/maison','/savoir-faire','/bonbons','/panier','/contenu/livraison']){const result=await handlePrelaunch(req(path),{});assert.equal(result.status,302);assert.equal(result.headers.get('location'),'/');}
 assert.equal(await(await handlePrelaunch(req('/',{},'HEAD'),{})).text(),'');
 for(const path of ['/admin','/admin/puck','/admin/api/products','/images/logo-boutique-neon.webp','/signin-with-chatgpt','/media/123','/api/panier'])assert.equal(await handlePrelaunch(req(path),{}),null);
});
test('preview requires an authorized administrator, not just the query parameter or any session',async()=>{
 assert.equal(await handlePrelaunch(req('/boutique/calendrier-conte-avent?apercu=1',{'oai-authenticated-user-id':'owner'}),{ADMIN_USER_IDS:'owner'}),null);
 const anonymous=await handlePrelaunch(req('/boutique?apercu=1'),{});assert.equal(anonymous.status,302);assert.match(anonymous.headers.get('location'),/^\/signin-with-chatgpt\?return_to=/);
 const visitor=await handlePrelaunch(req('/?apercu=1',{'oai-authenticated-user-id':'visitor'}),{ADMIN_USER_IDS:'owner'});assert.match(await visitor.text(),/arrive bientôt/);
 assert.equal(await handlePrelaunch(req('/?apercu=1',{'oai-authenticated-user-id':'owner'}),{ADMIN_USER_IDS:'owner'}),null);
 const DB={prepare:()=>({bind:user=>({first:async()=>user==='owner'?{user_id:user}:null})})};assert.equal(await handlePrelaunch(req('/maison?apercu=1',{'oai-authenticated-user-id':'owner'}),{DB}),null);
 assert.equal((await handlePrelaunch(req('/maison?apercu=1',{'oai-authenticated-user-id':'visitor'}),{DB})).status,302);
});
