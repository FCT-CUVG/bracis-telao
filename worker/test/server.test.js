import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createService} from '../src/index.js';
const env={FIREBASE_PROJECT:'example-project',DEFAULT_FOLDER:'default-folder-123',ADMIN_EMAIL:'admin@example.com',ALLOWED_ORIGINS:'https://display.example',DRIVE_API_KEY:'test-only-not-a-real-key'};
const photo={id:'photo-allowed-123',name:'foto.jpg',mimeType:'image/jpeg',modifiedTime:'2026-10-20T01:00:00Z',size:'3'};
const excluded={...photo,id:'photo-excluded-123',name:'excluida.jpg'};
const mark={...photo,id:'watermark-id-123',name:'watermark.png',mimeType:'image/png'};
const fields={folderId:{stringValue:env.DEFAULT_FOLDER},resourceKey:{stringValue:''},excludedIds:{arrayValue:{values:[{stringValue:excluded.id}]}}};
function setup(options={}){
  const calls=[];const fetcher=async(url,init)=>{url=new URL(url);calls.push({url,init});if(url.hostname==='firestore.googleapis.com')return Response.json({fields});if(url.pathname==='/drive/v3/files')return Response.json({files:[photo,excluded,mark]});if(url.pathname===`/drive/v3/files/${photo.id}`)return new Response('jpg',{headers:{'Content-Type':'image/jpeg'}});throw Error('Unexpected request');};
  return {service:createService({fetcher,onError:()=>{},...options}),calls};
}
const req=(path,headers={},method='GET')=>new Request('https://api.example'+path,{method,headers:{Origin:'https://display.example',...headers}});
test('Public album removes excluded photos and never returns the Drive key',async()=>{const {service}=setup();const r=await service.fetch(req('/album'),env);assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes(env.DRIVE_API_KEY));const body=JSON.parse(text);assert.deepEqual(body.photos.map(p=>p.id),[photo.id]);assert.equal(body.watermark.id,mark.id);});
test('Cannot turn server into a proxy for arbitrary files',async()=>{const {service,calls}=setup();const r=await service.fetch(req('/image/arbitrary-file-123'),env);assert.equal(r.status,404);assert.equal(calls.filter(c=>c.url.searchParams.get('alt')==='media').length,0);});
test('Excluded image is inaccessible through the public image route',async()=>{const {service}=setup();assert.equal((await service.fetch(req('/image/'+excluded.id),env)).status,404);});
test('Changing folders requires authentication before requesting Drive',async()=>{const {service,calls}=setup();const r=await service.fetch(req('/album?folderId=other-folder-123'),env);assert.equal(r.status,401);assert.equal(calls.filter(c=>c.url.hostname==='www.googleapis.com').length,0);});
test('Admin email alone is insufficient: provider and verification required',async()=>{for(const extra of [{email_verified:false,firebase:{sign_in_provider:'google.com'}},{email_verified:true,firebase:{sign_in_provider:'password'}}]){const {service}=setup({verifyToken:async()=>({sub:'u',iat:1,auth_time:1,exp:9999999999,email:env.ADMIN_EMAIL,...extra})});const r=await service.fetch(req('/album?preview=1',{Authorization:'Bearer simulated'}),env);assert.equal(r.status,403);}});
test('Verified administrator can preview and restore excluded photos',async()=>{const {service}=setup({verifyToken:async()=>({sub:'u',iat:1,auth_time:1,exp:9999999999,email:env.ADMIN_EMAIL,email_verified:true,firebase:{sign_in_provider:'google.com'}})});const r=await service.fetch(req('/album?preview=1',{Authorization:'Bearer simulated'}),env);assert.equal(r.status,200);assert.equal((await r.json()).photos.length,2);});
test('Disallowed origins and write requests are rejected',async()=>{const {service}=setup();assert.equal((await service.fetch(req('/album',{Origin:'https://other.example'}),env)).status,403);assert.equal((await service.fetch(req('/album',{},'POST'),env)).status,405);});
test('Allowed media is streamed without exposing upstream headers or key',async()=>{const {service}=setup();const r=await service.fetch(req('/image/'+photo.id),env);assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'image/jpeg');assert.equal(await r.text(),'jpg');assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://display.example');});
test('Upstream errors cannot leak URLs or secrets',async()=>{const service=createService({onError:()=>{},fetcher:async()=>{throw Error('Failure '+env.DRIVE_API_KEY);}});const r=await service.fetch(req('/album'),env);assert.equal(r.status,503);assert.ok(!(await r.text()).includes(env.DRIVE_API_KEY));});
test('Expired sessions are rejected',async()=>{const {service}=setup({verifyToken:async()=>({sub:'u',iat:1,auth_time:1,exp:1,email:env.ADMIN_EMAIL,email_verified:true,firebase:{sign_in_provider:'google.com'}})});assert.equal((await service.fetch(req('/album?preview=1',{Authorization:'Bearer simulated'}),env)).status,401);});

test('Drive key is sent only in an upstream header, never a URL',async()=>{const {service,calls}=setup();await service.fetch(req('/album'),env);const call=calls.find(item=>item.url.hostname==='www.googleapis.com');assert.equal(call.url.searchParams.has('key'),false);assert.equal(call.init.headers['X-Goog-Api-Key'],env.DRIVE_API_KEY);});

function previewSetup({link='https://lh3.googleusercontent.com/test-preview=s220',previewStatus=200,previewType='image/jpeg'}={}){
  const calls=[];
  const service=createService({onError:()=>{},fetcher:async(value,init)=>{
    const url=new URL(value);calls.push({url,init});
    if(url.hostname==='firestore.googleapis.com')return Response.json({fields});
    if(url.pathname==='/drive/v3/files')return Response.json({files:[{...photo,thumbnailLink:link},{...mark,thumbnailLink:link}]});
    if(url.hostname==='lh3.googleusercontent.com')return new Response('small-preview',{status:previewStatus,headers:{'Content-Type':previewType}});
    if(url.pathname===`/drive/v3/files/${photo.id}`)return new Response('original',{headers:{'Content-Type':'image/jpeg'}});
    if(url.pathname===`/drive/v3/files/${mark.id}`)return new Response('transparent-original',{headers:{'Content-Type':'image/png'}});
    throw Error('Unexpected request');
  }});
  return {service,calls};
}
test('Display uses a 2016px Google preview without sending credentials or exposing its temporary URL',async()=>{
  const {service,calls}=previewSetup();
  const album=await service.fetch(req('/album'),env);assert.ok(!(await album.text()).includes('thumbnailLink'));
  const response=await service.fetch(req('/image/'+photo.id),env);assert.equal(await response.text(),'small-preview');
  const preview=calls.find(call=>call.url.hostname==='lh3.googleusercontent.com');assert.equal(preview.url.pathname,'/test-preview=s2016');assert.equal(preview.init.headers,undefined);assert.equal(preview.init.redirect,'manual');
  assert.equal(calls.filter(call=>call.url.searchParams.get('alt')==='media').length,0);
});
test('Unavailable, invalid or unrecognized previews fall back to the original',async()=>{
  for(const options of [{previewStatus:403},{previewType:'text/html'},{link:'https://untrusted.example/test=s220'},{link:'https://lh3.googleusercontent.com/unknown-format'},{link:'http://lh3.googleusercontent.com/test=s220'}]){
    const {service,calls}=previewSetup(options);const response=await service.fetch(req('/image/'+photo.id),env);assert.equal(response.status,200);assert.equal(await response.text(),'original');assert.ok(calls.every(call=>call.url.hostname!=='untrusted.example'));
  }
});
test('Watermark keeps its original PNG and transparency rather than a Google preview',async()=>{
  const {service,calls}=previewSetup();const response=await service.fetch(req('/image/'+mark.id),env);assert.equal(response.headers.get('Content-Type'),'image/png');assert.equal(await response.text(),'transparent-original');assert.equal(calls.filter(call=>call.url.hostname==='lh3.googleusercontent.com').length,0);
});

test('Public photo geometry applies camera rotation and does not expose other image metadata',async()=>{
 const service=createService({onError:()=>{},fetcher:async value=>{const url=new URL(value);if(url.hostname==='firestore.googleapis.com')return Response.json({fields});return Response.json({files:[{...photo,imageMediaMetadata:{width:6000,height:4000,rotation:3,location:{latitude:1,longitude:2}}}]});}});
 const response=await service.fetch(req('/album'),env),body=await response.json();assert.equal(body.photos[0].width,4000);assert.equal(body.photos[0].height,6000);assert.ok(!JSON.stringify(body).includes('latitude'));assert.ok(!JSON.stringify(body).includes('imageMediaMetadata'));
});
