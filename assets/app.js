(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const modeNames = { single:'1 FOTO · ALTURA INTEIRA', triple:'3 FOTOS', quad:'4 FOTOS', motion:'MOTION · FAIXAS LATERAIS', pan:'PANORAMA · MOVIMENTO' };
  const availableModes = ['single','triple','quad','motion','pan'];
  const configDefaults = { modes:availableModes, duration:12, shuffle:true, watermarkPosition:'bottom-right', watermarkOpacity:65, watermarkSize:30, watermarkFade:false, fadeColor:'#ffffff', fadeOpacity:90, fadeSize:25, fadePosition:'auto', screenWidth:336, screenHeight:1008, fitScreen:false };
  let config = { ...configDefaults }, photos = [], mark = null, markURL = null, db = null;
  let history = [], historyIndex = -1, bag = [], cursor = 0, sequenceCursor = 0, playing = true, busy = false, sceneVersion = 0;
  let timer, sceneStarted = 0, remaining = 12000, currentScene = null, uiTimer, wakeLock = null;
  const displayName = name => name.replace(/\\/g, '/').split('/').pop();
  const isMark = name => /^watermark\.(png|jpe?g|webp|avif)$/i.test(displayName(name));
  const isPhoto = name => /\.(jpe?g|png|webp|avif)$/i.test(name);
  const ignored = name => /(^|\/)(__MACOSX|\.[^/]*)(\/|$)/.test(name) || name.endsWith('/');
  function status(message, warning = false) { $('status').textContent = message; $('status').classList.toggle('warning', warning); }
  function enabled() {
    const loaded = photos.length > 0;
    for (const id of ['launch','pause','next','previous','exportAlbum','clearAlbum']) $(id).disabled = !loaded || busy;
    $('zipInput').disabled = busy; $('watermarkInput').disabled = busy;
    $('photoCount').textContent = loaded ? `${photos.length} FOTO${photos.length === 1 ? '' : 'S'}` : 'SEM ÁLBUM';
    $('dropTitle').textContent = loaded ? 'Trocar o álbum' : 'Solte seu ZIP aqui';
  }
  async function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('vert-local-album', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('album', { keyPath:'id' }); request.result.createObjectStore('settings'); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  function readStore(name) {
    return new Promise((resolve, reject) => { const req = db.transaction(name).objectStore(name).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  }
  async function persistAlbum() {
    if (!db) return false;
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['album','settings'], 'readwrite'); const store = tx.objectStore('album'); store.clear();
        photos.forEach((p, id) => store.put({ id, name:p.name, blob:p.blob }));
        const settings = tx.objectStore('settings'); settings.put(config, 'config');
        if (mark) settings.put(mark, 'watermark'); else settings.delete('watermark');
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch { return false; }
  }
  function saveConfig() {
    if (!db) return;
    try { const tx = db.transaction('settings','readwrite'); tx.objectStore('settings').put(config,'config'); tx.onerror = () => {}; } catch {}
  }
  function syncConfig() {
    for (const key of Object.keys(configDefaults)) {
      const el = $(key); if (!el) continue;
      if (el.type === 'checkbox') el.checked = config[key]; else el.value = config[key];
    }
    document.querySelectorAll('.mode').forEach(button => {
      const active = button.dataset.mode === 'mix' ? config.modes.length === availableModes.length : config.modes.includes(button.dataset.mode);
      button.classList.toggle('selected',active); button.setAttribute('aria-pressed',String(active));
    });
    document.documentElement.style.setProperty('--stage-ratio',`${config.screenWidth}/${config.screenHeight}`);
    document.documentElement.style.setProperty('--screen-w', config.screenWidth);
    document.documentElement.style.setProperty('--screen-h', config.screenHeight);
    $('resolutionLabel').textContent = `${config.screenWidth} × ${config.screenHeight} PX`;
    $('opacityValue').textContent = `${config.watermarkOpacity}%`; $('sizeValue').textContent = `${config.watermarkSize}%`;
    document.body.classList.toggle('fill-output', config.fitScreen);
    const image = $('watermark'); image.dataset.position = config.watermarkPosition; image.style.opacity = config.watermarkOpacity / 100; image.style.width = config.watermarkSize + '%';
    renderWatermarkFade();
  }
  function renderWatermarkFade() {
    const layer=$('watermarkFadeLayer');
    $('fadeControls').hidden=!config.watermarkFade;
    $('fadeOpacityValue').textContent=`${config.fadeOpacity}%`;
    $('fadeSizeValue').textContent=`${config.fadeSize}%`;
    layer.hidden=!config.watermarkFade||!mark;
    const hex=/^#[0-9a-f]{6}$/i.test(config.fadeColor)?config.fadeColor:'#ffffff';
    const rgb=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)).join(',');
    const color=`rgba(${rgb},${config.fadeOpacity/100})`;
    const clear=`rgba(${rgb},0)`;
    const position=config.fadePosition==='auto' ? config.watermarkPosition.startsWith('bottom')?'bottom':config.watermarkPosition==='center'?'center':'top' : config.fadePosition;
    layer.style.height=`${config.fadeSize}%`;
    layer.style.top=position==='bottom'?'auto':position==='center'?'50%':'0';
    layer.style.bottom=position==='bottom'?'0':'auto';
    layer.style.transform=position==='center'?'translateY(-50%)':'none';
    layer.style.background=position==='center' ? `linear-gradient(to bottom,${clear},${color} 35%,${color} 65%,${clear})` : `linear-gradient(to ${position==='bottom'?'top':'bottom'},${color} 0%,${color} 30%,${clear} 100%)`;
  }
  function setWatermark(value) {
    if (markURL) URL.revokeObjectURL(markURL);
    mark = value; markURL = value ? URL.createObjectURL(value.blob) : null;
    $('watermark').hidden = !value;
    if (value) $('watermark').src = markURL; else $('watermark').removeAttribute('src');
    $('watermarkName').textContent = value ? value.name : 'Nenhuma marca carregada';
    renderWatermarkFade();
  }
  async function adoptWatermark(value) {
    const image=await loadImage(value.blob);
    const ratio=image.naturalWidth/image.naturalHeight;
    const screenRatio=config.screenWidth/config.screenHeight;
    if(Math.abs(ratio/screenRatio-1)<.05)config.watermarkPosition='overlay';
    else if(config.watermarkPosition==='overlay')config.watermarkPosition='bottom-right';
    setWatermark(value);syncConfig();
  }
  async function loadImage(blob) {
    const url = URL.createObjectURL(blob); const img = new Image();
    try { img.src = url; await img.decode(); return img; }
    finally { URL.revokeObjectURL(url); }
  }
  async function optimize(blob, watermark = false) {
    if (blob.size > 80 * 1024 * 1024) throw Error('Uma imagem excede o limite de 80 MB.');
    const img = await loadImage(blob);
    if (img.naturalWidth * img.naturalHeight > 85000000) throw Error('Imagem grande demais para processar neste navegador.');
    const ratio = Math.min(1, 2016 / Math.max(img.naturalWidth,img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw Error('Não foi possível preparar a imagem.');
    if (!watermark) { context.fillStyle = '#111'; context.fillRect(0,0,canvas.width,canvas.height); }
    context.drawImage(img,0,0,canvas.width,canvas.height);
    const result = await new Promise(resolve => canvas.toBlob(resolve,watermark ? 'image/png' : 'image/jpeg',.86));
    canvas.width = canvas.height = 1;
    if (!result) throw Error('Falha ao otimizar imagem.');
    return result;
  }
  async function importFiles(files) {
    if (busy || !files.length) return;
    busy = true; enabled(); $('importProgress').hidden = false; $('progress').value = 0;
    const wasPlaying = playing; if (playing && photos.length) togglePause();
    const prepared = []; const warnings = []; let incomingMark, totalBytes = 0, rejected = 0, duplicates = 0;
    try {
      let entries = [];
      for (const file of files) {
        if (/\.zip$/i.test(file.name)) entries.push(...await AlbumZip.open(file));
        else entries.push({ name:file.name, size:file.size, read:async () => file });
      }
      entries = entries.filter(entry => !ignored(entry.name));
      const heic = entries.filter(entry => /\.(heic|heif)$/i.test(entry.name)).length;
      if (heic) warnings.push(`${heic} arquivo(s) HEIC/HEIF ignorado(s); converta para JPG`);
      entries = entries.filter(entry => isPhoto(entry.name));
      if (entries.filter(entry => !isMark(entry.name)).length > 600) throw Error('O limite é de 600 fotos por álbum. Divida o ZIP.');
      if (entries.reduce((sum, entry) => sum + entry.size,0) > 2 * 1024 ** 3) throw Error('O álbum descompactado passa de 2 GB. Divida o ZIP.');
      const seen = new Set();
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]; const name = displayName(entry.name);
        $('progressLabel').textContent = `${i + 1} / ${entries.length} · ${name}`;
        try {
          const blob = await entry.read();
          if (isMark(name)) {
            incomingMark = { name:'watermark.png', blob:await optimize(blob,true) };
          } else {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            // A digest identifies duplicate image bytes even when file names differ.
            let fingerprint;
            if (crypto.subtle) fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).join(',');
            else fingerprint = `${entry.name}:${blob.size}`;
            if (seen.has(fingerprint)) { duplicates++; continue; }
            seen.add(fingerprint);
            const optimized = await optimize(blob);
            totalBytes += blob.size; prepared.push({ name:name.replace(/\.[^.]+$/,'.jpg'), blob:optimized });
          }
        } catch (error) { rejected++; if (warnings.length < 4) warnings.push(`${name}: ${error.message}`); }
        $('progress').value = Math.round((i + 1) / Math.max(1,entries.length) * 100);
        await new Promise(resolve => setTimeout(resolve,0));
      }
      if (!prepared.length && !incomingMark) throw Error(warnings.join(' · ') || 'Nenhuma foto compatível encontrada. Use JPG, PNG, WEBP ou AVIF.');
      if (prepared.length) {
        sceneVersion++; clearTimeout(timer); $('scenes').replaceChildren(); currentScene = null;
        photos.forEach(p => URL.revokeObjectURL(p.url));
        photos = prepared.map(p => ({ ...p,url:URL.createObjectURL(p.blob) }));
        history = []; historyIndex = -1; bag = []; cursor = 0; sequenceCursor = 0;
        $('emptyStage').hidden = true; playing = true; $('stage').classList.remove('paused'); $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label','Pausar apresentação');
        await nextScene();
      } else if (wasPlaying && !playing) togglePause();
      if (incomingMark) await adoptWatermark(incomingMark);
      const saved = await persistAlbum();
      const optimizedBytes = prepared.reduce((sum,p) => sum+p.blob.size,0);
      let message = prepared.length ? `${prepared.length} fotos prontas · ${(optimizedBytes/1024/1024).toFixed(1)} MB` : 'Marca d’água aplicada';
      if (prepared.length && totalBytes > optimizedBytes) message += ` · ${Math.round((1-optimizedBytes/totalBytes)*100)}% menor`;
      if (duplicates) message += ` · ${duplicates} repetida(s) removida(s)`;
      if (saved) message += ' · salvo neste navegador.';
      else message += ' · Não foi possível salvar neste navegador. Baixe o ZIP otimizado antes de fechar.';
      if (warnings.length) message += ' Atenção: ' + warnings.join(' · ');
      if (rejected > 4) message += ` (${rejected} arquivos não carregados)`;
      status(message, warnings.length > 0 || !saved);
    } catch (error) {
      status(error.message,true);
      if (wasPlaying && !playing && photos.length) togglePause();
    } finally { busy = false; $('importProgress').hidden = true; $('zipInput').value = ''; enabled(); }
  }
  function takePhoto() {
    if (!config.shuffle) return cursor++ % photos.length;
    if (!bag.length) {
      bag = photos.map((_,i) => i);
      for (let i=bag.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
    }
    return bag.pop();
  }
  function makeSpec() {
    const mode = config.modes[sequenceCursor++ % config.modes.length];
    const count = {single:1,triple:3,quad:4,motion:6,pan:1}[mode];
    return { mode, indices:Array.from({length:count},takePhoto) };
  }
  function makeImage(url, className) { const img = new Image(); img.alt = ''; img.src = url; img.className = className; img.draggable = false; return img; }
  async function showScene(spec) {
    const version = ++sceneVersion; clearTimeout(timer);
    const scene = document.createElement('div'); scene.className = `scene ${spec.mode}`; scene.style.setProperty('--scene-duration',`${config.duration}s`);
    const loads = [];
    if (spec.mode === 'motion') {
      for (let row=0;row<3;row++) {
        const cell=document.createElement('div'); cell.className='photo-cell';
        const ribbon=document.createElement('div'); ribbon.className='ribbon'+(row%2?' reverse':'');
        const pair=spec.indices.slice(row*2,row*2+2);
        for (const index of [...pair,...pair]) { const img=makeImage(photos[index].url,''); ribbon.append(img); loads.push(img.decode().catch(()=>{})); }
        cell.append(ribbon);scene.append(cell);
      }
    } else {
      for (const index of spec.indices) {
        const cell=document.createElement('div');cell.className='photo-cell';
        const background=makeImage(photos[index].url,'photo-backdrop'); const foreground=makeImage(photos[index].url,'photo-main');
        cell.append(background,foreground);scene.append(cell);loads.push(foreground.decode().catch(()=>{}));
      }
    }
    await Promise.all(loads);
    if (version !== sceneVersion) return;
    const old=currentScene; $('scenes').append(scene); currentScene=scene;
    scene.getBoundingClientRect(); scene.classList.add('visible');
    if(old) setTimeout(()=>old.remove(),900);
    $('sceneLabel').textContent=modeNames[spec.mode]; $('sceneCounter').textContent=String(historyIndex+1).padStart(2,'0');
    remaining=config.duration*1000;
    if(playing) schedule();
  }
  function schedule() { clearTimeout(timer);sceneStarted=performance.now();timer=setTimeout(()=>nextScene(),remaining); }
  async function nextScene() {
    if(!photos.length)return;
    if(historyIndex<history.length-1) historyIndex++;
    else { history.push(makeSpec());if(history.length>80)history.shift();historyIndex=history.length-1; }
    await showScene(history[historyIndex]);
  }
  function previousScene() { if(historyIndex>0) {historyIndex--;showScene(history[historyIndex]);} }
  function togglePause() {
    if(!photos.length)return;
    playing=!playing;
    if(playing) schedule();else {clearTimeout(timer);remaining=Math.max(100,remaining-(performance.now()-sceneStarted));}
    $('stage').classList.toggle('paused',!playing); $('pause').textContent=playing?'Ⅱ':'▶';$('pause').setAttribute('aria-label',playing?'Pausar apresentação':'Retomar apresentação');
    if(document.body.classList.contains('presentation')) notice(playing?'Reproduzindo':'Pausado');
  }
  function notice(text) { $('screenNotice').textContent=text;$('screenNotice').hidden=false;setTimeout(()=>$('screenNotice').hidden=true,1600); }
  async function requestWakeLock() { try {if('wakeLock' in navigator)wakeLock=await navigator.wakeLock.request('screen');}catch{} }
  async function present() {
    if(!photos.length)return;
    document.body.classList.add('presentation');$('exitPresentation').hidden=false;showControls();
    try {if(!document.fullscreenElement)await document.documentElement.requestFullscreen();}catch{notice('Use a opção Tela cheia do navegador para ocultar as barras.');}
    await requestWakeLock();
  }
  function exitPresentation() {
    document.body.classList.remove('presentation','controls-visible');$('exitPresentation').hidden=true;
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    if(wakeLock) {wakeLock.release().catch(()=>{});wakeLock=null;}
  }
  function showControls() {if(!document.body.classList.contains('presentation'))return;document.body.classList.add('controls-visible');clearTimeout(uiTimer);uiTimer=setTimeout(()=>document.body.classList.remove('controls-visible'),2400);}
  async function exportAlbum() {
    if(!photos.length||busy)return;
    busy=true;enabled();status('Preparando o ZIP otimizado…');
    try {
      const files=photos.map((p,i)=>({name:`fotos/${String(i+1).padStart(4,'0')}-${p.name}`,blob:p.blob}));if(mark)files.push({name:'watermark.png',blob:mark.blob});
      const blob=await AlbumZip.pack(files);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='album-telao-otimizado.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status('ZIP otimizado preparado. Ele inclui as fotos e a marca d’água, quando carregada.');
    }catch(error){status('Não foi possível exportar: '+error.message,true);}finally{busy=false;enabled();}
  }
  $('zipInput').addEventListener('change',event=>importFiles([...event.target.files]));
  $('dropzone').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('zipInput').click();}});
  for(const type of ['dragenter','dragover'])$('dropzone').addEventListener(type,event=>{event.preventDefault();$('dropzone').classList.add('dragging');});
  for(const type of ['dragleave','drop'])$('dropzone').addEventListener(type,event=>{event.preventDefault();$('dropzone').classList.remove('dragging');});
  $('dropzone').addEventListener('drop',event=>importFiles([...event.dataTransfer.files]));
  $('watermarkInput').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file||busy)return;
    try {const blob=await optimize(file,true);await adoptWatermark({name:file.name,blob});const saved=await persistAlbum();status(saved?'Marca d’água aplicada e salva.':'Marca aplicada nesta sessão. Não foi possível salvá-la.',!saved);}catch{status('Não foi possível abrir a marca. Use PNG, JPG ou WEBP.',true);}event.target.value='';
  });
  $('removeWatermark').addEventListener('click',async()=>{setWatermark(null);await persistAlbum();});
  document.querySelectorAll('.mode').forEach(button=>button.addEventListener('click',()=>{
    const mode=button.dataset.mode;
    if(mode==='mix') config.modes=[...availableModes];
    else if(config.modes.includes(mode)) {
      if(config.modes.length===1) { status('Mantenha pelo menos um tipo de apresentação selecionado.');return; }
      config.modes=config.modes.filter(value=>value!==mode);
    } else config.modes=availableModes.filter(value=>value===mode||config.modes.includes(value));
    history=[];historyIndex=-1;sequenceCursor=0;syncConfig();saveConfig();nextScene();
    status(config.modes.length===1 ? 'Um tipo de apresentação selecionado.' : `${config.modes.length} tipos selecionados. A apresentação alterna entre eles.`);
  }));
  for(const key of Object.keys(configDefaults)) {
    const el=$(key);if(!el)continue;
    el.addEventListener('change',()=>{
      if(el.type==='checkbox')config[key]=el.checked;
      else if(['screenWidth','screenHeight'].includes(key)){if(!el.checkValidity()||!el.value)return;config[key]=Number(el.value);}
      else if(['duration','watermarkOpacity','watermarkSize','fadeOpacity','fadeSize'].includes(key))config[key]=Number(el.value);
      else config[key]=el.value;
      syncConfig();saveConfig();if(key==='duration'&&photos.length)showScene(history[historyIndex]);if(key==='shuffle')bag=[];
    });
    if(el.type==='range'||el.type==='color')el.addEventListener('input',()=>{config[key]=el.type==='range'?Number(el.value):el.value;syncConfig();});
  }
  $('next').addEventListener('click',nextScene);$('previous').addEventListener('click',previousScene);$('pause').addEventListener('click',togglePause);$('launch').addEventListener('click',present);$('exitPresentation').addEventListener('click',exitPresentation);$('exportAlbum').addEventListener('click',exportAlbum);
  $('clearAlbum').addEventListener('click',async()=>{
    if(!confirm('Apagar o álbum salvo neste navegador? Os arquivos originais e os ZIPs permanecem no computador.'))return;
    clearTimeout(timer);sceneVersion++;photos.forEach(p=>URL.revokeObjectURL(p.url));photos=[];history=[];historyIndex=-1;currentScene=null;$('scenes').replaceChildren();$('emptyStage').hidden=false;$('sceneLabel').textContent='TELÃO VERTICAL · 1:3';$('sceneCounter').textContent='—';await persistAlbum();enabled();status('Álbum apagado deste navegador.');
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){exitPresentation();return;}
    if(/^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(event.target.tagName)||event.target.closest('[role=button]')||busy)return;
    if(event.code==='Space'){event.preventDefault();togglePause();}if(event.key==='ArrowRight'){event.preventDefault();nextScene();}if(event.key==='ArrowLeft'){event.preventDefault();previousScene();}
  });
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.body.classList.contains('presentation'))exitPresentation();});
  document.addEventListener('pointermove',showControls);document.addEventListener('pointerdown',showControls);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&document.body.classList.contains('presentation'))requestWakeLock();});
  async function initialize() {
    busy=true;enabled();status('Verificando se há um álbum salvo…');
    try {
      db=await openDatabase();
      const readKey=key=>new Promise((resolve,reject)=>{const req=db.transaction('settings').objectStore('settings').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      const [stored,storedConfig,storedMark]=await Promise.all([readStore('album'),readKey('config'),readKey('watermark')]);
      if(storedConfig) {
        config={...configDefaults,...storedConfig};
        const selected=Array.isArray(storedConfig.modes) ? availableModes.filter(mode=>storedConfig.modes.includes(mode)) : availableModes.includes(storedConfig.mode) ? [storedConfig.mode] : availableModes;
        config.modes=selected.length ? selected : [...availableModes];
        delete config.mode;
      }
      syncConfig();if(storedMark)setWatermark(storedMark);
      photos=stored.sort((a,b)=>a.id-b.id).map(p=>({...p,url:URL.createObjectURL(p.blob)}));
      if(photos.length){$('emptyStage').hidden=true;await nextScene();status(`${photos.length} fotos restauradas deste navegador. Pronto para exibir.`);}else status('As fotos são otimizadas ao importar. Nenhum arquivo é enviado para um servidor.');
    }catch{status('Armazenamento local indisponível. Você pode importar e exibir; salve o ZIP otimizado antes de fechar.',true);syncConfig();}
    finally{busy=false;enabled();}
  }
  initialize();
})();
