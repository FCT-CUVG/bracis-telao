import {ready,watchEvent} from './cloud.js';
import {DriveAlbum} from './album.js';
async function start(){
const player=await ready();let published=null;
const query=new URLSearchParams(location.search),testMode=query.get('medir')==='1'&&['single','mixed','motion','pan'].includes(query.get('modo'))?query.get('modo'):null;
const album=new DriveAlbum(player,(message,warning)=>{if(warning)console.warn(message);});
function apply(value){
  if(!value)return;
  published=value;player.setConfig(testMode?{...value.settings,modes:[testMode]}:value.settings);
  try{localStorage.setItem('bracis-last-published',JSON.stringify(value));}catch{}
  return album.update(value);
}
try{const cached=JSON.parse(localStorage.getItem('bracis-last-published'));if(cached)apply(cached);}catch{}
watchEvent(value=>{if(value)apply(value);else if(!published)player.message('Aguardando publicação da apresentação.');},()=>{if(!published)player.message('Não foi possível conectar. Tentando novamente…');});
setInterval(()=>{if(published)album.update(published);},60000);
}
start().catch(()=>{const message=document.querySelector("#emptyStage p");if(message)message.textContent="Não foi possível iniciar. Abra /diagnostico neste navegador.";});
