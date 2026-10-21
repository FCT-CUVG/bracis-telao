import {auth,ready,watchAuth,authorized,login,logout,watchEvent,publishEvent} from './cloud.js';
import {defaultFolder} from './cloud-config.js';
import {parseFolder,setDriveAuth,loadFile} from './drive.js';
import {DriveAlbum} from './album.js';
const $=id=>document.getElementById(id),player=await ready();
let source={folderId:defaultFolder,resourceKey:'',excludedIds:[]},dirty=false,loaded=false,files=null,stopWatch=null,lastExcluded=null,loadingFolder=false,publishing=false;
setDriveAuth(()=>auth.currentUser?.getIdToken());
const album=new DriveAlbum(player,(text,warning)=>player.status(text,warning));
function changed(){dirty=true;$('publishStatus').textContent='Ajustes ainda não publicados.';updatePublish();}
function updatePublish(){$('publish').disabled=!authorizedUser||!loaded||loadingFolder||publishing;}
function folderUI(){const link=`https://drive.google.com/drive/folders/${source.folderId}${source.resourceKey?`?resourcekey=${encodeURIComponent(source.resourceKey)}`:''}`;$('driveFolder').value=link;$('openDrive').href=link;}
function excludedUI(){
  const container=$('excludedPhotos');container.replaceChildren();
  const excluded=(files?.photos||[]).filter(f=>source.excludedIds.includes(f.id));if(!excluded.length)return;
  const title=document.createElement('h3');title.textContent='Fora da apresentação';container.append(title);
  for(const file of excluded){const row=document.createElement('div'),name=document.createElement('span'),button=document.createElement('button');name.textContent=file.name;button.className='text-button';button.textContent='Restaurar';button.addEventListener('click',async()=>{source.excludedIds=source.excludedIds.filter(id=>id!==file.id);changed();await refresh();});row.append(name,button);container.append(row);}
}
async function refresh(force=false){loadingFolder=true;updatePublish();try{await album.update(source,{force,onFiles:value=>{files=value;excludedUI();renderDirectory();}});}finally{loadingFolder=false;updatePublish();}}
let directoryPage=0;
function renderDirectory(){
  if(!files)return;
  const active=files.photos.filter(file=>!source.excludedIds.includes(file.id)),query=$('photoSearch').value.toLocaleLowerCase();
  const filtered=active.filter(file=>file.name.toLocaleLowerCase().includes(query));
  const totalPages=Math.max(1,Math.ceil(filtered.length/100));directoryPage=Math.min(directoryPage,totalPages-1);
  $('albumCount').textContent=`${active.length} fotos`;$('photoCount').textContent=`${active.length} FOTOS`;$('albumEmpty').hidden=!!active.length;
  const orientations={portrait:0,landscape:0,square:0,unknown:0};active.forEach(file=>orientations[window.TelaoTiming.orientation(file)]++);
  $('orientationInfo').textContent=`${orientations.portrait} retratos · ${orientations.landscape} paisagens · ${orientations.square} quadradas${orientations.unknown?` · ${orientations.unknown} a identificar`:''}`;
  $('directoryPage').textContent=`${directoryPage+1} / ${totalPages}`;$('directoryPrev').disabled=directoryPage===0;$('directoryNext').disabled=directoryPage===totalPages-1;
  const fragment=document.createDocumentFragment();
  for(const file of filtered.slice(directoryPage*100,directoryPage*100+100)){
    const row=document.createElement('li'),view=document.createElement('button'),name=document.createElement('span'),remove=document.createElement('button');
    name.className='photo-name';name.textContent=file.name;view.className='text-button';view.textContent='Ver';
    const orientation=document.createElement('small');orientation.className='photo-orientation';orientation.textContent={portrait:'Retrato',landscape:'Paisagem',square:'Quadrada',unknown:'A identificar'}[window.TelaoTiming.orientation(file)];
    view.addEventListener('click',async()=>{
      view.disabled=true;try{const photo=await loadFile({...file,source});const url=URL.createObjectURL(photo.blob),dialog=document.createElement('dialog'),image=new Image(),close=document.createElement('button');image.src=url;image.alt=file.name;close.textContent='Fechar';close.className='secondary';dialog.className='photo-dialog';dialog.append(image,close);document.body.append(dialog);close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);dialog.remove();},{once:true});dialog.showModal();}catch(error){player.status(error.message,true);}finally{view.disabled=false;}
    });
    remove.className='text-button photo-remove';remove.textContent='Excluir';remove.setAttribute('aria-label',`Excluir ${file.name}`);remove.onclick=()=>window.dispatchEvent(new CustomEvent('telao:exclude',{detail:{id:file.id}}));
    row.append(view,name,orientation,remove);fragment.append(row);
  }
  $('photoList').replaceChildren(fragment);
}
$('photoSearch').addEventListener('input',()=>{directoryPage=0;renderDirectory();});
$('directoryPrev').onclick=()=>{directoryPage--;renderDirectory();};$('directoryNext').onclick=()=>{directoryPage++;renderDirectory();};
let authorizedUser=false;
watchAuth(user=>{
  authorizedUser=authorized(user);$('authGate').hidden=authorizedUser;$('adminWorkspace').hidden=!authorizedUser;$('loginGoogle').hidden=!!user;
  if(stopWatch){stopWatch();stopWatch=null;}
  if(!authorizedUser){$('authStatus').textContent=user?'Esta conta não tem acesso. Entre com a conta autorizada.':'Entre com sua conta Google para administrar a apresentação.';$('loginGoogle').hidden=false;loaded=false;updatePublish();return;}
  $('adminIdentity').textContent=user.email;
  stopWatch=watchEvent(async published=>{
    if(dirty){$('publishStatus').textContent='Há ajustes na prévia. Publique para aplicar no telão.';return;}
    if(published){source={folderId:published.folderId,resourceKey:published.resourceKey,excludedIds:published.excludedIds};player.setConfig(published.settings);$('publishStatus').textContent='Ajustes publicados carregados.';}
    else $('publishStatus').textContent='Primeira configuração: confira a prévia e publique.';
    folderUI();loaded=true;updatePublish();await refresh();
  },error=>{$('publishStatus').textContent='Não foi possível carregar os ajustes: '+error.message;loaded=false;updatePublish();});
});
$('loginGoogle').addEventListener('click',async()=>{try{$('loginGoogle').disabled=true;await login();}catch(error){$('authStatus').textContent='Não foi possível entrar: '+error.message;}finally{$('loginGoogle').disabled=false;}});
$('logout').addEventListener('click',logout);
$('loadDrive').addEventListener('click',async()=>{try{const parsed=parseFolder($('driveFolder').value);if(parsed.folderId!==source.folderId)source.excludedIds=[];source={...source,...parsed};folderUI();changed();await refresh(true);}catch(error){player.status(error.message,true);}});
$('publish').addEventListener('click',async()=>{
  try {const parsed=parseFolder($('driveFolder').value);if(parsed.folderId!==source.folderId||parsed.resourceKey!==source.resourceKey){player.status('Carregue a pasta antes de publicar.',true);return;}
    publishing=true;updatePublish();$('publishStatus').textContent='Publicando…';await publishEvent({...source,settings:player.getConfig()});dirty=false;$('publishStatus').textContent='Publicado. O telão recebe os ajustes automaticamente.';
  }catch(error){$('publishStatus').textContent='Não foi possível publicar: '+error.message;}finally{publishing=false;updatePublish();}
});
window.addEventListener('telao:change',changed);
window.addEventListener('telao:exclude',async({detail})=>{lastExcluded=detail.id;source.excludedIds=[...new Set([...source.excludedIds,detail.id])];changed();await refresh();$('undoPhoto').hidden=false;});
$('undoPhoto').addEventListener('click',async()=>{if(!lastExcluded)return;source.excludedIds=source.excludedIds.filter(id=>id!==lastExcluded);lastExcluded=null;changed();await refresh();$('undoPhoto').hidden=true;});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
setInterval(()=>{if(authorizedUser&&loaded&&!loadingFolder&&!publishing)refresh();},60000);
