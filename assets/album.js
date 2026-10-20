import {listFolder,loadFile,signature,pruneCache} from './drive.js';
export class DriveAlbum {
  constructor(player,onStatus=()=>{},services={}){this.services={listFolder,loadFile,pruneCache,now:()=>Date.now(),...services};this.player=player;this.onStatus=onStatus;this.generation=0;this.loaded=new Map();this.currentSignature='';this.running=false;this.pending=null;this.offset=0;this.rotateAt=0;this.retryAt=Infinity;}
  async update(source,{force=false,onFiles=()=>{}}={}){
    if(this.running){this.pending={source,options:{force,onFiles}};return;}
    this.running=true;const generation=++this.generation;
    try {
      let files;const cacheKey=`bracis-folder:${source.folderId}`;
      try {files=await this.services.listFolder(source);try{localStorage.setItem(cacheKey,JSON.stringify(files));}catch{}}
      catch(error){try{files=JSON.parse(localStorage.getItem(cacheKey));}catch{}if(!files)throw error;this.onStatus('Drive indisponível. Usando as fotos já salvas neste navegador.',true);}
      onFiles(files);
      const allActive=files.photos.filter(file=>!(source.excludedIds||[]).includes(file.id));
      const nextSignature=signature(source,{...files,photos:allActive});
      const rotating=allActive.length>60&&this.services.now()>=this.rotateAt;
      if(!force&&nextSignature===this.currentSignature&&!rotating&&this.services.now()<this.retryAt)return;
      const newWindow=nextSignature!==this.currentSignature||rotating;
      if(nextSignature!==this.currentSignature)this.offset=0;
      else if(rotating)this.offset=(this.offset+60)%allActive.length;
      const active=Array.from({length:Math.min(60,allActive.length)},(_,i)=>allActive[(this.offset+i)%allActive.length]);
      let failures=0,done=0,previewStarted=false;const loaded=new Map();
      if(files.watermark){try{await this.player.setMark(await this.services.loadFile(files.watermark,true));}catch{failures++;}}
      else await this.player.setMark(null);
      const previous=this.loaded;
      // Keep existing scenes playing while the next album is prepared.
      const queue=[...active];
      const worker=async()=>{while(queue.length){const file=queue.shift();try{loaded.set(file.id,await this.services.loadFile(file));}catch{failures++;if(previous.has(file.id))loaded.set(file.id,previous.get(file.id));}
        done++;this.onStatus(`Preparando fotos: ${done} / ${active.length}${files.ignored?` · ${files.ignored} HEIC ignorados`:''}`);
        if(!this.loaded.size&&!previewStarted&&loaded.size>=Math.min(3,active.length)){previewStarted=true;await this.player.setAlbum(active.filter(f=>loaded.has(f.id)).map(f=>loaded.get(f.id)));}
      }};
      await Promise.all(Array.from({length:Math.min(3,queue.length)},worker));
      if(generation!==this.generation)return;
      if(active.length&&!loaded.size)throw Error('Não foi possível abrir as fotos. Verifique se a pasta e as imagens estão públicas.');
      this.loaded=loaded;await this.player.setAlbum(active.filter(f=>loaded.has(f.id)).map(f=>loaded.get(f.id)));
      this.player.message(active.length?'Nenhuma foto disponível':'Nenhuma foto selecionada');
      this.currentSignature=nextSignature;this.retryAt=failures?this.services.now()+60000:Infinity;
      await this.services.pruneCache([...files.photos.map(f=>f.id),...(files.watermark?[files.watermark.id]:[])]);
      if(newWindow)this.rotateAt=this.services.now()+Math.max(180000,Math.ceil(active.length/2)*this.player.getConfig().duration*1000);
      onFiles(files);
      this.onStatus(`${allActive.length} fotos na apresentação · ${loaded.size} preparadas neste lote${files.ignored?` · ${files.ignored} HEIC ignorados; use JPG`:''}${failures?` · ${failures} arquivo(s) não carregado(s); tentarei novamente`:''}.`,failures>0);
    }catch(error){this.onStatus(error.message,true);if(!this.loaded.size)this.player.message('Aguardando fotos.');}
    finally{this.running=false;if(this.pending){const next=this.pending;this.pending=null;await this.update(next.source,next.options);}}
  }
}
