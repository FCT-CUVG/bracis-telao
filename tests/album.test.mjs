import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DriveAlbum} from '../assets/album.js';
function setup({failFirst=false}={}){
  let clock=1000000;const seen=new Set(),batches=[],requests=[];
  const photos=Array.from({length:626},(_,i)=>({id:`photo-${i}`,name:`foto-${i}.jpg`,modifiedTime:'fixed'}));
  const player={getConfig:()=>({duration:12}),setMark:async()=>{},message:()=>{},setAlbum:async items=>{batches.push(items);items.forEach(item=>seen.add(item.id));}};
  const album=new DriveAlbum(player,()=>{},{now:()=>clock,listFolder:async()=>({photos,watermark:null,ignored:0}),loadFile:async file=>{requests.push(file.id);if(failFirst&&file.id==='photo-0')throw Error('indisponível');return {...file,blob:new Blob(['foto'])};},pruneCache:async()=>{}});
  return {album,seen,batches,requests,advance:ms=>clock+=ms};
}
test('Every photo in a large album is reached while limiting each batch to 60',async()=>{const {album,seen,batches,advance}=setup();for(let i=0;i<11;i++){await album.update({folderId:'folder'});advance(361000);}assert.equal(seen.size,626);assert.ok(batches.every(batch=>batch.length<=60));});
test('One failed image cannot keep playback stuck in the first batch',async()=>{const {album,seen,advance}=setup({failFirst:true});await album.update({folderId:'folder'});for(let i=0;i<6;i++){advance(61000);await album.update({folderId:'folder'});}assert.ok(seen.has('photo-60'));assert.ok(!seen.has('photo-0'));});
test('Excluded images are not downloaded by the player',async()=>{const {album,requests}=setup();await album.update({folderId:'folder',excludedIds:['photo-0','photo-2']});assert.ok(!requests.includes('photo-0'));assert.ok(!requests.includes('photo-2'));assert.equal(requests.length,60);});
