import {listFolder,loadFile,signature,pruneCache} from './drive.js';
import './timing.js';
export class DriveAlbum {
  constructor(player,onStatus=()=>{},services={}){this.services={listFolder,loadFile,pruneCache,now:()=>Date.now(),...services};this.player=player;this.onStatus=onStatus;this.generation=0;this.loaded=new Map();this.currentSignature='';this.running=false;this.pending=null;this.offset=0;this.rotateAt=0;this.retryAt=Infinity;this.markSignature='';this.backgroundSignature='';}
  settings(){return this.player.getPlaybackConfig?this.player.getPlaybackConfig():this.player.getConfig();}
  async update(source,{force=false,onFiles=()=>{}}={}){
    if(this.running){this.pending={source,options:{force,onFiles}};return;}
    this.running=true;const generation=++this.generation;
    try {
      let files;const cacheKey=`bracis-folder:${source.folderId}`;
      try {files=await this.services.listFolder(source);try{localStorage.setItem(cacheKey,JSON.stringify(files));}catch{}}
      catch(error){try{files=JSON.parse(localStorage.getItem(cacheKey));}catch{}if(!files)throw error;this.onStatus('Drive indisponível. Usando as fotos já salvas neste navegador.',true);}
      onFiles(files);
      const needsBackground=globalThis.TelaoTiming.horizontal(this.settings())&&(this.settings().frameBackgroundSource||'drive')==='drive';
      const backgroundSignature=needsBackground&&files.background?`${files.background.id}:${files.background.modifiedTime}`:'none';
      if(this.player.setBackground&&backgroundSignature!==this.backgroundSignature){try{await this.player.setBackground(needsBackground&&files.background?await this.services.loadFile(files.background,false,1008,true):null);this.backgroundSignature=backgroundSignature;}catch{this.onStatus('Não foi possível abrir o fundo do Drive. Tentarei novamente.',true);}}
      const available=files.photos.filter(file=>!(source.excludedIds||[]).includes(file.id));
      const selected=globalThis.TelaoTiming.eligible(available,this.settings().modes);
      const allActive=available.filter((file,index)=>selected.includes(index)||!file.width||!file.height);
      const nextSignature=signature(source,{...files,photos:allActive})+`:height-${this.settings().screenHeight||1008}`;
      const progress=this.player.getPlaybackProgress?.();
      const rotating=allActive.length>60&&(progress?progress.total>0&&progress.completed>=progress.total:this.services.now()>=this.rotateAt);
      if(!force&&nextSignature===this.currentSignature&&!rotating&&this.services.now()<this.retryAt)return;
      const newWindow=nextSignature!==this.currentSignature||rotating;
      if(nextSignature!==this.currentSignature)this.offset=0;
      else if(rotating)this.offset=(this.offset+60)%allActive.length;
      const active=Array.from({length:Math.min(60,allActive.length)},(_,i)=>allActive[(this.offset+i)%allActive.length]);
      let failures=0,done=0,previewStarted=false;const loaded=new Map();
      const markSignature=files.watermark?`${files.watermark.id}:${files.watermark.modifiedTime}`:'none';
      if(markSignature!==this.markSignature){try{await this.player.setMark(files.watermark?await this.services.loadFile(files.watermark,true):null);this.markSignature=markSignature;}catch{failures++;}}
      const previous=this.loaded;
      // Keep existing scenes playing while the next album is prepared.
      const queue=[...active];
      const worker=async(workerIndex)=>{while(queue.length){if((this.loaded.size||previewStarted)&&workerIndex>0)return;const file=queue.shift();try{loaded.set(file.id,await this.services.loadFile(file,false,this.settings().screenHeight));}catch{failures++;if(previous.has(file.id))loaded.set(file.id,previous.get(file.id));}
        done++;this.onStatus(`Preparando fotos: ${done} / ${active.length}${files.ignored?` · ${files.ignored} HEIC ignorados`:''}`);
        if(!this.loaded.size&&!previewStarted&&loaded.size>=Math.min(3,active.length)){previewStarted=true;await this.player.setAlbum(active.filter(f=>loaded.has(f.id)).map(f=>loaded.get(f.id)));}
      }};
      await Promise.all(Array.from({length:Math.min(3,queue.length)},(_,index)=>worker(index)));
      if(generation!==this.generation)return;
      if(active.length&&!loaded.size)throw Error('Não foi possível abrir as fotos. Verifique se a pasta e as imagens estão públicas.');
      const changed=newWindow||[...loaded.keys()].sort().join(',')!==[...previous.keys()].sort().join(',');
      this.loaded=loaded;if(changed)await this.player.setAlbum(active.filter(f=>loaded.has(f.id)).map(f=>loaded.get(f.id)));
      this.player.message(active.length?'Nenhuma foto disponível':'Nenhuma foto selecionada');
      this.currentSignature=nextSignature;this.retryAt=failures?this.services.now()+60000:Infinity;
      await this.services.pruneCache([...files.photos.map(f=>f.id),...(files.watermark?[files.watermark.id]:[]),...(files.background?[files.background.id]:[])]);
      if(newWindow)this.rotateAt=this.services.now()+Math.max(180000,globalThis.TelaoTiming.cycle(active,this.settings()).seconds*1000);
      onFiles(files);
      this.onStatus(`${allActive.length} fotos na apresentação · ${loaded.size} preparadas neste lote${files.ignored?` · ${files.ignored} HEIC ignorados; use JPG`:''}${failures?` · ${failures} arquivo(s) não carregado(s); tentarei novamente`:''}.`,failures>0);
    }catch(error){this.onStatus(error.message,true);if(!this.loaded.size)this.player.message('Aguardando fotos.');}
    finally{this.running=false;if(this.pending){const next=this.pending;this.pending=null;await this.update(next.source,next.options);}}
  }
}
