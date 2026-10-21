(function () {
  'use strict';
  var labels={core:'Recursos básicos',modules:'Código da apresentação',cloud:'Conexão da configuração',album:'Lista do Drive',photo:'Foto real do álbum',motion:'Movimento das faixas',canvas:'Preparo de imagens',cache:'Cache local'};
  var results={},base='https://bracis-drive.bracis-drive-server.workers.dev';
  function fit(){
    var width=window.innerWidth||document.documentElement.clientWidth,height=window.innerHeight||document.documentElement.clientHeight,scale=Math.min(width/336,height/1008);
    document.getElementById('diagnosticBoard').style.transform='translate('+Math.max(0,(width-336*scale)/2)+'px,'+Math.max(0,(height-1008*scale)/2)+'px) scale('+scale+')';
  }
  fit();window.addEventListener('resize',function(){fit();summary();});
  function finish(id,state,detail){
    var row=document.getElementById('check-'+id);row.className=state;row.getElementsByTagName('strong')[0].textContent=labels[id]+': '+(state==='ok'?'OK':state==='warn'?'atenção':'falhou');row.getElementsByTagName('span')[0].textContent=detail;results[id]=state;summary();
  }
  function summary(){
    var count=0,failed=0,warnings=0,lines=['Navegador: '+navigator.userAgent,'Janela: '+window.innerWidth+' × '+window.innerHeight,'Tela informada: '+screen.width+' × '+screen.height+'; escala '+(window.devicePixelRatio||1),'Movimento reduzido: '+(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'sim':'não')];
    for(var id in labels){if(results[id]){count++;if(results[id]==='fail')failed++;if(results[id]==='warn')warnings++;}var row=document.getElementById('check-'+id);lines.push(row.getElementsByTagName('strong')[0].textContent+' — '+row.getElementsByTagName('span')[0].textContent);}
    document.getElementById('report').value=lines.join('\n');
    var browser=navigator.userAgent.match(/(Edg|Chrome|Firefox|Version)\/([\d.]+)/);
    document.getElementById('deviceInfo').textContent=(browser?browser[1]+' '+browser[2]:'Navegador não identificado')+' · janela '+window.innerWidth+' × '+window.innerHeight+' · escala '+(window.devicePixelRatio||1);
    document.getElementById('summary').textContent=count<8?'Testando… '+count+' de 8 verificações concluídas.':failed?'Há '+failed+' falha(s). Resolva antes de usar este navegador no evento.':warnings?'Testes concluídos com '+warnings+' aviso(s). Confira os detalhes e teste a exibição real.':'8 testes aprovados. Confira as faixas em movimento e teste a exibição real.';
  }
  window.TelaoDiagnostic={finish:finish};
  document.getElementById('repeat').onclick=function(){location.reload();};
  document.getElementById('copyReport').onclick=function(){
    var button=this,text=document.getElementById('report');
    function fallback(){text.focus();text.select();try{button.textContent=document.execCommand('copy')?'Copiado':'Fotografe a tela';}catch(error){button.textContent='Fotografe a tela';}button.focus();}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text.value).then(function(){button.textContent='Copiado';},fallback);else fallback();
  };
  var missing=[];
  if(!window.Promise)missing.push('Promise');if(!window.fetch)missing.push('conexões modernas');if(!window.Map||!window.Set)missing.push('Map/Set');if(!window.URL||!window.URL.createObjectURL)missing.push('imagens locais');if(!('noModule' in document.createElement('script')))missing.push('módulos JavaScript');
  if(!window.CSS||!CSS.supports||!CSS.supports('display','grid')||!CSS.supports('color','var(--test)'))missing.push('layout da apresentação');
  finish('core',missing.length?'fail':'ok',missing.length?'Recursos ausentes: '+missing.join(', '):'Recursos necessários ao player disponíveis.');
  var canvas=document.createElement('canvas'),context=canvas.getContext&&canvas.getContext('2d');canvas.width=320;canvas.height=180;
  if(context&&canvas.toBlob){context.fillStyle='#2864cf';context.fillRect(0,0,320,180);canvas.toBlob(function(blob){finish('canvas',blob&&blob.size?'ok':'fail',blob&&blob.size?'O navegador consegue preparar JPEG.':'Não foi possível criar a imagem.');},'image/jpeg',0.8);}else finish('canvas','fail','O navegador não consegue preparar as fotos em canvas.');
  var scene=document.getElementById('motionScene');
  if(context){
    for(var row=0;row<3;row++){var cell=document.createElement('div'),ribbon=document.createElement('div');cell.className='photo-cell';ribbon.className='ribbon'+(row%2?' reverse':'');
      for(var i=0;i<4;i++){context.fillStyle=i%2?'#e8b34d':'#2864cf';context.fillRect(0,0,320,180);context.fillStyle='white';context.font='bold 64px Arial';context.fillText(i%2?'2':'1',140,115);var image=new Image();image.src=canvas.toDataURL('image/jpeg');ribbon.appendChild(image);}cell.appendChild(ribbon);scene.appendChild(cell);}
    var first=scene.querySelector('.ribbon'),initial=window.getComputedStyle(first).transform;
    setTimeout(function(){var computed=window.getComputedStyle(first);finish('motion',computed.animationName!=='none'&&computed.transform!==initial?'ok':'fail',computed.animationName!=='none'&&computed.transform!==initial?'A posição das faixas mudou durante o teste. Confirme o movimento visualmente.':'As faixas estão paradas. Verifique bloqueio de animações ou pausa do navegador.');},1600);
  }else finish('motion','fail','Não foi possível gerar as imagens do teste.');
  if(!window.indexedDB)finish('cache','warn','Sem cache persistente: haverá mais downloads ao reabrir.');
  else try{
    var open=indexedDB.open('bracis-compatibility-check',1);
    open.onupgradeneeded=function(){open.result.createObjectStore('test');};
    open.onerror=function(){finish('cache','warn','O armazenamento local está bloqueado.');};
    open.onblocked=function(){finish('cache','warn','Outro teste está usando o armazenamento local.');};
    open.onsuccess=function(){var db=open.result,tx=db.transaction('test','readwrite');tx.objectStore('test').put('ok','probe');tx.oncomplete=function(){db.close();indexedDB.deleteDatabase('bracis-compatibility-check');finish('cache','ok','O navegador permite guardar fotos preparadas.');};tx.onerror=function(){db.close();finish('cache','warn','O navegador abriu o cache, mas não permitiu gravar.');};};
  }catch(error){finish('cache','warn','Armazenamento local indisponível.');}
  function json(url,done){var xhr=new XMLHttpRequest();xhr.open('GET',url,true);xhr.timeout=25000;xhr.onload=function(){if(xhr.status<200||xhr.status>=300){done(new Error('Resposta '+xhr.status));return;}try{done(null,JSON.parse(xhr.responseText));}catch(error){done(error);}};xhr.onerror=xhr.ontimeout=function(){done(new Error('Conexão bloqueada ou sem resposta.'));};xhr.send();}
  json(base+'/album',function(error,album){
    if(error){finish('album','fail',error.message);finish('photo','fail','A lista não carregou; não foi possível testar uma foto.');return;}
    finish('album','ok',(album.photos||[]).length+' fotos disponíveis no servidor.');
    if(!album.photos||!album.photos.length){finish('photo','warn','Não há fotos na apresentação para testar.');return;}
    var photo=document.getElementById('samplePhoto'),started=Date.now(),timer=setTimeout(function(){finish('photo','fail','A foto não terminou de carregar em 30 segundos.');},30000);
    photo.onload=function(){clearTimeout(timer);photo.hidden=false;finish('photo','ok',photo.naturalWidth+' × '+photo.naturalHeight+' pixels em '+((Date.now()-started)/1000).toFixed(1)+' s.');};photo.onerror=function(){clearTimeout(timer);finish('photo','fail','O navegador não conseguiu abrir a foto do servidor.');};photo.src=base+'/image/'+encodeURIComponent(album.photos[0].id);
  });
  setTimeout(function(){if(!results.modules)finish('modules','fail','O código moderno do player não carregou. O navegador pode ser antigo ou bloquear módulos.');if(!results.cloud)finish('cloud','fail','A biblioteca de configuração não carregou. Verifique acesso ao Google/Firebase e a versão do navegador.');if(!results.cache)finish('cache','warn','O armazenamento local não respondeu ao teste.');if(!results.canvas)finish('canvas','fail','O preparo de imagens não respondeu.');},35000);
  summary();
}());
