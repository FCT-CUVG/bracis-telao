import {importX509,jwtVerify} from 'jose';
const ID=/^[a-zA-Z0-9_-]{10,200}$/;
const PHOTO=/\.(jpe?g|png|webp|avif)$/i;
const MARK=/^watermark\.(jpe?g|png|webp|avif)$/i;
const publicFile=({thumbnailLink,...file})=>file;
function displayPreview(file){
  if(MARK.test(file.name)||!file.thumbnailLink)return null;
  try {
    const url=new URL(file.thumbnailLink);
    if(url.protocol!=='https:'||!url.hostname.endsWith('.googleusercontent.com')||url.username||url.password||url.port)return null;
    // Drive currently returns a Google image URL ending in =s220. Request the
    // same 2016px limit used by the player; unknown URL formats use the original.
    if(!/=s\d+$/.test(url.pathname))return null;
    url.pathname=url.pathname.replace(/=s\d+$/,'=s2016');return url;
  }catch{return null;}
}
class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new HttpError(status,message);};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// In-memory caches contain only public metadata and Google public signing certificates.
export function createService({fetcher=fetch,now=()=>Date.now(),verifyToken=null,onError=null}={}) {
  let publishedCache=null,certificates=null;
  const manifests=new Map();
  async function timedFetch(url,options={},timeout=30000){return fetcher(url,{...options,signal:AbortSignal.timeout(timeout)});}
  async function verifyAdmin(request,env){
    const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if(!token||token.length>10000)fail(401,'Entre no painel para carregar outra pasta.');
    let claims;
    try {
      if(verifyToken)claims=await verifyToken(token);
      else {
        if(!certificates||certificates.until<now()){
          const response=await timedFetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
          if(!response.ok)throw Error('certificates');
          const maxAge=Math.min(3600,Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1]||300));
          certificates={values:await response.json(),until:now()+maxAge*1000,keys:new Map()};
        }
        const result=await jwtVerify(token,async header=>{
          if(header.alg!=='RS256'||!certificates.values[header.kid])throw Error('key');
          if(!certificates.keys.has(header.kid))certificates.keys.set(header.kid,await importX509(certificates.values[header.kid],'RS256'));
          return certificates.keys.get(header.kid);
        },{algorithms:['RS256'],audience:env.FIREBASE_PROJECT,issuer:`https://securetoken.google.com/${env.FIREBASE_PROJECT}`,requiredClaims:['exp','iat','sub','auth_time'],currentDate:new Date(now())});
        claims=result.payload;
      }
      const seconds=Math.floor(now()/1000);
      if(!claims.sub||claims.sub.length>128||claims.iat>seconds||claims.auth_time>seconds||claims.exp<=seconds)throw Error('time');
    }catch{fail(401,'Sessão inválida. Entre novamente no painel.');}
    if(claims.email!==env.ADMIN_EMAIL||claims.email_verified!==true||claims.firebase?.sign_in_provider!=='google.com')fail(403,'Esta conta não pode administrar o telão.');
    return true;
  }
  async function published(env){
    if(publishedCache&&publishedCache.until>now())return publishedCache.value;
    const response=await timedFetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/databases/(default)/documents/events/bracis`);
    let value;
    if(response.status===404)value={folderId:env.DEFAULT_FOLDER,resourceKey:'',excludedIds:[]};
    else {
      if(!response.ok)fail(503,'Não foi possível ler a apresentação publicada.');
      const data=(await response.json()).fields||{};
      value={folderId:data.folderId?.stringValue,resourceKey:data.resourceKey?.stringValue||'',excludedIds:(data.excludedIds?.arrayValue?.values||[]).map(item=>item.stringValue)};
    }
    if(!ID.test(value.folderId)||!/^[a-zA-Z0-9_-]{0,200}$/.test(value.resourceKey))fail(503,'Pasta da apresentação não configurada.');
    publishedCache={value,until:now()+15000};return value;
  }
  async function sourceFor(request,url,env){
    const live=await published(env),preview=url.searchParams.get('preview')==='1';
    const folderId=url.searchParams.get('folderId')||live.folderId,resourceKey=url.searchParams.get('resourceKey')||'';
    if(!ID.test(folderId)||!/^[a-zA-Z0-9_-]{0,200}$/.test(resourceKey))fail(400,'Pasta inválida.');
    if(preview||folderId!==live.folderId||(resourceKey&&resourceKey!==live.resourceKey)){
      await verifyAdmin(request,env);return {folderId,resourceKey,excludedIds:[],preview:true};
    }
    return {...live,preview:false};
  }
  async function drive(path,params,resource,env){
    if(!env.DRIVE_API_KEY)fail(503,'A conexão com o Drive ainda está sendo configurada.');
    const url=new URL(`https://www.googleapis.com/drive/v3/${path}`);
    url.search=new URLSearchParams(params);
    const headers={'X-Goog-Api-Key':env.DRIVE_API_KEY,...(resource.resourceKey?{'X-Goog-Drive-Resource-Keys':`${resource.id}/${resource.resourceKey}`} : {})};
    const response=await timedFetch(url,{headers,redirect:'manual'});
    if(!response.ok)fail(response.status===404?404:502,response.status===404?'Pasta ou imagem indisponível. Confira o compartilhamento no Drive.':'O Drive não liberou o arquivo. Confira a configuração e o compartilhamento da pasta.');
    return response;
  }
  async function manifest(source,env){
    const key=`${source.folderId}:${source.resourceKey}`,cached=manifests.get(key);
    if(cached?.until>now())return cached.value;
    const files=[];let pageToken='',pages=0;
    do {
      const response=await drive('files',{q:`'${source.folderId}' in parents and trashed = false`,pageSize:'1000',fields:'nextPageToken,files(id,name,mimeType,modifiedTime,size,resourceKey,thumbnailLink)',orderBy:'name',...(pageToken?{pageToken}:{})},{id:source.folderId,resourceKey:source.resourceKey},env);
      const page=await response.json();files.push(...(page.files||[]));pageToken=page.nextPageToken;
      if(++pages>5||files.length>5000)fail(422,'Divida as fotos em uma pasta menor.');
    }while(pageToken);
    const images=files.filter(file=>PHOTO.test(file.name)&&file.mimeType?.startsWith('image/'));
    const photos=images.filter(file=>!MARK.test(file.name));
    const value={photos,watermark:images.find(file=>MARK.test(file.name))||null,ignored:files.filter(file=>/\.(heic|heif)$/i.test(file.name)).length};
    // Bound cache growth even if an administrator previews many folders.
    if(manifests.size>=8)manifests.delete(manifests.keys().next().value);
    manifests.set(key,{value,until:now()+45000});return value;
  }
  async function handle(request,env,ctx={waitUntil:()=>{}}){
    const url=new URL(request.url),origin=request.headers.get('Origin');
    const allowed=(env.ALLOWED_ORIGINS||'').split(',').filter(Boolean);
    if(origin&&!allowed.includes(origin))return json({error:'Origem não permitida.'},403);
    const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'86400'}:{};
    const respond=response=>{const result=new Response(response.body,response);for(const [key,value] of Object.entries(cors))result.headers.set(key,value);return result;};
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(!['GET','HEAD'].includes(request.method))return respond(json({error:'Método não permitido.'},405));
    try {
      if(url.pathname==='/health')return respond(json({ok:true}));
      if(url.pathname!=='/album'&&!/^\/image\/[a-zA-Z0-9_-]{10,200}$/.test(url.pathname))fail(404,'Endereço não encontrado.');
      const source=await sourceFor(request,url,env),listing=await manifest(source,env);
      const photos=listing.photos.filter(file=>!source.excludedIds.includes(file.id));
      if(url.pathname==='/album')return respond(json({...listing,photos:photos.map(publicFile),watermark:listing.watermark?publicFile(listing.watermark):null}));
      const id=url.pathname.split('/')[2],file=[...photos,...(listing.watermark?[listing.watermark]:[])].find(file=>file.id===id);
      if(!file)fail(404,'Esta imagem não faz parte da apresentação.');
      if(Number(file.size)>80*1024*1024)fail(413,'Imagem maior que 80 MB.');
      const cacheKey=new Request(`${url.origin}/cached-display-v2/${encodeURIComponent(id)}?v=${encodeURIComponent(file.modifiedTime||'')}`);
      const cache=globalThis.caches?.default;
      let response=cache?await cache.match(cacheKey):null;
      if(!response){
        let upstream;const preview=displayPreview(file);
        if(preview){
          try {
            const candidate=await timedFetch(preview,{redirect:'manual'},12000);
            if(candidate.ok&&['image/jpeg','image/png','image/webp','image/avif'].includes((candidate.headers.get('Content-Type')||'').split(';')[0]))upstream=candidate;
            else await candidate.body?.cancel();
          }catch{} // A missing or expired Drive preview falls back to the original.
        }
        if(!upstream)upstream=await drive(`files/${encodeURIComponent(id)}`,{alt:'media'},file,env);
        const type=(upstream.headers.get('Content-Type')||'').split(';')[0];
        if(!['image/jpeg','image/png','image/webp','image/avif'].includes(type))fail(415,'Formato de imagem não compatível.');
        if(Number(upstream.headers.get('Content-Length'))>80*1024*1024)fail(413,'Imagem maior que 80 MB.');
        response=new Response(upstream.body,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
        if(cache)ctx.waitUntil(cache.put(cacheKey,response.clone()).catch(()=>{}));
      }
      // Validate current membership before using cached bytes; don't cache the authorization decision.
      const result=new Response(request.method==='HEAD'?null:response.body,response);
      result.headers.set('Cache-Control','private, max-age=300');return respond(result);
    }catch(error){if(onError)onError(error);else console.error(JSON.stringify({event:'drive_error',kind:error.name,status:error.status||503,message:String(error.message).replaceAll(env.DRIVE_API_KEY||'__unset__','[redacted]')}));return respond(json({error:error instanceof HttpError?error.message:'O servidor não conseguiu carregar as fotos. Tente novamente em instantes.'},error instanceof HttpError?error.status:503));}
  }
  return {fetch:handle};
}
export default createService();
