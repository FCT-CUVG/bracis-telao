import {DriveAlbum} from './album.js';
function report(id,state,message){
  if(window.TelaoDiagnostic)window.TelaoDiagnostic.finish(id,state,message);
  else setTimeout(()=>report(id,state,message),50);
}
report('modules',typeof DriveAlbum==='function'?'ok':'fail','Os módulos usados pelo player foram carregados.');
import('./cloud.js').then(cloud=>{
  let stop;const timer=setTimeout(()=>{if(stop)stop();report('cloud','fail','As bibliotecas carregaram, mas a configuração não respondeu em 25 segundos.');},25000);
  stop=cloud.watchEvent(value=>{clearTimeout(timer);if(stop)stop();report('cloud',value?'ok':'warn',value?'A configuração publicada foi lida pelo mesmo serviço usado na exibição.':'A conexão funciona, mas ainda não há configuração publicada.');},()=>{clearTimeout(timer);if(stop)stop();report('cloud','fail','O navegador não conseguiu ler a configuração publicada.');});
}).catch(()=>report('cloud','fail','Falha ao carregar as bibliotecas do Google/Firebase. Verifique bloqueios de rede e a versão do navegador.'));
