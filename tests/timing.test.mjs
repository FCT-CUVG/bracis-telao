import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../assets/timing.js';
const timing=globalThis.TelaoTiming,portrait={width:4000,height:6000},landscape={width:6000,height:4000};
test('Legacy stacked layouts migrate to the new moving portrait and landscape composition',()=>{assert.deepEqual(timing.modes(['single','triple','quad','motion','pan']),['single','mixed','motion','pan']);});
test('Portrait, panorama and mixed modes use only the required orientations',()=>{
 const photos=[portrait,landscape,landscape,{width:100,height:100}];
 assert.deepEqual(timing.eligible(photos,['single']),[0]);assert.deepEqual(timing.eligible(photos,['pan']),[1,2]);assert.deepEqual(timing.eligible(photos,['mixed']),[0,1,2]);assert.deepEqual(timing.modeRoles('mixed'),['portrait','landscape','landscape']);
 assert.ok(!timing.available([landscape,landscape],['single','mixed','motion','pan']).includes('single'));assert.ok(!timing.available([portrait],['single','mixed']).includes('mixed'));
});
test('Cover motion preserves aspect ratio and covers every point throughout horizontal and vertical travel',()=>{
 for(const [w,h] of [[6000,4000],[4000,6000],[1000,1000],[1000,5000],[5000,1000]])for(const [cw,ch] of [[336,1008],[336,504],[336,252],[336,336]]){
  const geometry=timing.cover(w,h,cw,ch);assert.ok(Math.abs(geometry.width/geometry.height-w/h)<1e-9);
  for(const t of [0,.25,.5,.75,1]){const x=geometry.startX+(geometry.endX-geometry.startX)*t,y=geometry.startY+(geometry.endY-geometry.startY)*t;assert.ok(x<=0&&y<=0);assert.ok(x+geometry.width>=cw-1e-6);assert.ok(y+geometry.height>=ch-1e-6);}
 }
});
test('Cycle timing accounts for slow speed, orientation pools and photos per scene',()=>{
 assert.equal(timing.cycle(Array(60).fill(portrait),{modes:['single'],duration:18,motionSpeed:.5}).seconds,2160);
 assert.equal(timing.cycle(Array(60).fill(landscape),{modes:['motion'],duration:18,motionSpeed:.5}).seconds,360);
 assert.equal(timing.cycle([...Array(6).fill(portrait),...Array(12).fill(landscape)],{modes:['mixed'],duration:18,motionSpeed:.5}).seconds,216);
 assert.equal(timing.sceneSeconds('mixed',{duration:18,motionSpeed:.25}),72);
});

test('The cycle avoids repeating exhausted portrait roles while unshown landscapes remain',()=>{
 const remaining={portrait:0,landscape:10,square:0,unknown:0};assert.equal(timing.nextMode(['single','mixed','motion','pan'],0,remaining).mode,'motion');
 const photos=[...Array(6).fill(portrait),...Array(54).fill(landscape)];assert.equal(timing.cycle(photos,{modes:['single','mixed','motion','pan'],duration:18,motionSpeed:.5}).seconds,684);
});
