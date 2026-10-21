(function(){
  'use strict';
  if(!/(?:\?|&)medir=1(?:&|$)/.test(location.search))return;
  var stage=document.getElementById('stage'),badge=document.createElement('div');
  badge.className='frame-meter';badge.setAttribute('role','status');badge.textContent='Teste real · aguardando as fotos…';stage.appendChild(badge);
  if(!window.requestAnimationFrame){badge.textContent='Este navegador não permite medir o ritmo.';return;}
  var last=0,frames=0,elapsed=0,gaps=0,maxGap=0,updated=0,modes={},finished=false;
  function result(){return {at:new Date().toISOString(),userAgent:navigator.userAgent,frames:frames,elapsed:elapsed,rate:elapsed?Math.round(frames*1000/elapsed):0,gaps:gaps,maxGap:Math.round(maxGap),modes:modes,note:'Amostra de callbacks requestAnimationFrame no player real. Não mede quadros efetivamente pintados nem a taxa física do LED.'};}
  function paint(done){var sample=result();badge.textContent='Teste real '+(done?90:Math.min(90,Math.round(elapsed/1000)))+'/90 s · ritmo ~'+sample.rate+'/s\nPausas >50 ms: '+gaps+' · maior '+sample.maxGap+' ms\nEstimativa do navegador; não é a taxa física do LED.'+(done?'\nConcluído. O relatório está no diagnóstico.':'');try{localStorage.setItem('bracis-motion-sample',JSON.stringify(sample));}catch{}}
  function tick(time){
    if(finished)return;
    var scenes=stage.querySelectorAll('.scene.visible'),scene=scenes[scenes.length-1];
    if(document.hidden||!scene||stage.classList.contains('paused')){last=0;requestAnimationFrame(tick);return;}
    if(last){var delta=time-last,mode=(scene.className.match(/\b(single|mixed|motion|pan)\b/)||[])[1]||'unknown';
      frames++;elapsed+=delta;if(delta>50)gaps++;maxGap=Math.max(maxGap,delta);
      if(!modes[mode])modes[mode]={frames:0,elapsed:0,gaps:0};modes[mode].frames++;modes[mode].elapsed+=delta;if(delta>50)modes[mode].gaps++;
    }
    last=time;
    if(time-updated>1000){updated=time;paint(false);}
    if(elapsed>=90000){finished=true;paint(true);return;}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}());
