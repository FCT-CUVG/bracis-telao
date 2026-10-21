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

test('A batch is retained until playback confirms that its eligible photos finished',async()=>{
 const {album,seen,advance}=setup();let progress={completed:0,total:60};album.player.getPlaybackProgress=()=>progress;
 await album.update({folderId:'folder'});advance(3600000);await album.update({folderId:'folder'});assert.ok(!seen.has('photo-60'));
 progress={completed:60,total:60};await album.update({folderId:'folder'});assert.ok(seen.has('photo-60'));
});
test('Retrying an unchanged partial batch does not restart playback',async()=>{
 const {album,batches,advance}=setup({failFirst:true});await album.update({folderId:'folder'});const initial=batches.length;
 advance(61000);await album.update({folderId:'folder'});assert.equal(batches.length,initial);
});
test('Changing the LED height rebuilds the image profile even with an unchanged Drive folder',async()=>{
 const {album,batches}=setup();let height=1008;const heights=[];
 album.player.getConfig=()=>({duration:12,screenHeight:height});
 album.services.loadFile=async(file,watermark,targetHeight)=>{if(!watermark)heights.push(targetHeight);return {...file,blob:new Blob(['foto'])};};
 await album.update({folderId:'folder'});const before=batches.length;assert.ok(heights.every(h=>h===1008));
 heights.length=0;height=720;await album.update({folderId:'folder'});assert.ok(batches.length>before);assert.ok(heights.every(h=>h===720));
});
