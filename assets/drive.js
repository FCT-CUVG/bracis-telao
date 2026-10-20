import {driveApiBase} from './cloud-config.js';
let tokenProvider=null;
export const setDriveAuth=provider=>{tokenProvider=provider;};
const supported=/\.(jpe?g|png|webp|avif)$/i, isMark=name=>/^watermark\.(jpe?g|png|webp|avif)$/i.test(name);
let dbPromise;
const openCache=()=>dbPromise??=new Promise((resolve,reject)=>{
  const request=indexedDB.open('bracis-drive-cache',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
}).catch(()=>null);
async function cacheGet(id){const db=await openCache();if(!db)return null;return new Promise(resolve=>{const r=db.transaction('files').objectStore('files').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});}
async function cachePut(value){const db=await openCache();if(!db)return;await new Promise(resolve=>{const t=db.transaction('files','readwrite');t.objectStore('files').put(value);t.oncomplete=resolve;t.onerror=resolve;t.onabort=resolve;});}
export async function pruneCache(ids){const db=await openCache();if(!db)return;const allowed=new Set(ids);await new Promise(resolve=>{const t=db.transaction('files','readwrite'),s=t.objectStore('files'),r=s.openCursor(),kept=[];r.onsuccess=()=>{const c=r.result;if(c){if(!allowed.has(c.key))s.delete(c.key);else kept.push({id:c.key,at:c.value.cachedAt||0});c.continue();}else{kept.sort((a,b)=>b.at-a.at);kept.slice(300).forEach(item=>s.delete(item.id));}};t.oncomplete=resolve;t.onerror=resolve;t.onabort=resolve;});}
export function parseFolder(value){
  const raw=value.trim();let folderId=raw,resourceKey='';
  if(/^https?:\/\//i.test(raw)){
    const url=new URL(raw);if(url.hostname!=='drive.google.com')throw Error('Use um link de pasta do Google Drive.');
    folderId=url.pathname.match(/\/folders\/([\w-]+)/)?.[1]||url.searchParams.get('id')||'';resourceKey=url.searchParams.get('resourcekey')||'';
  }
  if(!/^[\w-]{10,200}$/.test(folderId)||!/^[\w-]{0,200}$/.test(resourceKey))throw Error('Link da pasta inválido.');
  return {folderId,resourceKey};
}
async function request(path,source={}){
  if(!driveApiBase)throw Error('O servidor de fotos ainda está sendo configurado.');
  const url=new URL(path,driveApiBase+'/');
  if(source.folderId)url.searchParams.set('folderId',source.folderId);
  if(source.resourceKey)url.searchParams.set('resourceKey',source.resourceKey);
  const headers={};
  if(tokenProvider){const token=await tokenProvider();if(token){headers.Authorization=`Bearer ${token}`;url.searchParams.set('preview','1');}}
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});
  if(!response.ok){const problem=await response.json().catch(()=>({}));throw Error(problem.error||`O servidor respondeu ${response.status}.`);}
  return response;
}
export async function listFolder(source){
  const files=await (await request('album',source)).json();
  files.photos=files.photos.map(file=>({...file,source:{folderId:source.folderId,resourceKey:source.resourceKey||''}}));
  if(files.watermark)files.watermark={...files.watermark,source:{folderId:source.folderId,resourceKey:source.resourceKey||''}};
  return files;
}
async function optimize(blob,watermark){
  if(blob.size>80*1024*1024)throw Error('Imagem maior que 80 MB.');
  const url=URL.createObjectURL(blob),image=new Image();
  try {image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>85000000)throw Error('Imagem grande demais.');
    const scale=Math.min(1,2016/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');context.drawImage(image,0,0,canvas.width,canvas.height);
    const result=await new Promise(resolve=>canvas.toBlob(resolve,watermark?'image/png':'image/jpeg',.86));if(!result)throw Error('Falha ao preparar foto.');return result;
  }finally{URL.revokeObjectURL(url);}
}
export async function loadFile(file,watermark=false){
  const revision=`${file.modifiedTime}:${file.size||''}:${watermark}`;
  const cached=await cacheGet(file.id);if(cached?.revision===revision)return {...file,blob:cached.blob};
  const response=await request(`image/${encodeURIComponent(file.id)}`,file.source),blob=await optimize(await response.blob(),watermark);
  await cachePut({id:file.id,revision,blob,cachedAt:Date.now()});return {...file,blob};
}
export const signature=(source,files)=>JSON.stringify([source.folderId,source.resourceKey,files.photos.map(f=>[f.id,f.modifiedTime,f.size]),files.watermark&&[files.watermark.id,files.watermark.modifiedTime]]);
