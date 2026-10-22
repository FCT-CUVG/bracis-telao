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
test('LED image sizing preserves travel width and reduces decoded pixels without upscaling',()=>{
 assert.deepEqual(timing.imageSize(6000,4000,1008),{width:1512,height:1008});
 assert.deepEqual(timing.imageSize(4000,6000,1008),{width:672,height:1008});
 assert.deepEqual(timing.imageSize(3840,2160,1008),{width:1792,height:1008});
 assert.deepEqual(timing.imageSize(320,240,1008),{width:320,height:240});
 const p=timing.imageSize(4000,6000,1008),l=timing.imageSize(6000,4000,1008);
 assert.ok(p.width*p.height/(1344*2016)<.251);assert.ok(l.width*l.height/(2016*1344)<.563);
});
test('Each display link fixes its own resolution without changing shared published settings',()=>{
 const published={screenWidth:1920,screenHeight:1080,fitScreen:true,duration:18,watermarkOffsetX:5,modes:['single','mixed','motion','pan']};
 const vertical=timing.output(published,'vertical'),horizontal=timing.output(published,'horizontal');
 assert.equal(vertical.screenWidth,336);assert.equal(vertical.screenHeight,1008);assert.equal(vertical.fitScreen,false);
 assert.equal(horizontal.screenWidth,1344);assert.equal(horizontal.screenHeight,1008);assert.equal(horizontal.fitScreen,false);
 assert.equal(horizontal.duration,published.duration);assert.equal(horizontal.watermarkOffsetX,5);
 assert.equal(published.screenWidth,1920);assert.equal(published.screenHeight,1080);assert.equal(published.fitScreen,true);
 assert.deepEqual(timing.output(published,'custom'),published);
});
test('Framed horizontal layouts use two portraits and two seamless photo ribbons',()=>{
 const horizontal={screenWidth:1344,screenHeight:1008,modes:['single','mixed','motion','pan'],duration:18,motionSpeed:.5};
 assert.deepEqual(timing.modeRoles('single',horizontal),['portrait','portrait']);assert.equal(timing.modeRoles('motion',horizontal).length,4);
 assert.equal(timing.modeRoles('motion',{screenWidth:336,screenHeight:1008}).length,6);
 const photos=[...Array(6).fill(portrait),...Array(54).fill(landscape)],estimate=timing.cycle(photos,horizontal);
 assert.equal(estimate.photos,60);assert.ok(estimate.seconds>0&&estimate.seconds<2200);
 for(const [w,h] of [[6000,4000],[4000,6000]])for(const [cw,ch] of [[1344*.94,1008*.82],[1344*.94/2,1008*.82],[1344*.94/3,1008*.82],[1344*.94*2/3,1008*.82/2]]){
  const g=timing.cover(w,h,cw,ch);for(const t of [0,.5,1]){const x=g.startX+(g.endX-g.startX)*t,y=g.startY+(g.endY-g.startY)*t;assert.ok(x<=0&&y<=0&&x+g.width>=cw-1e-6&&y+g.height>=ch-1e-6);}
 }
});

test('Horizontal photo area keeps 16:9 centered within the frame margins at every viewport size',()=>{
 for(const [w,h] of [[1344,1008],[768,576],[403.5,302.625]])for(const margins of [{x:10,top:10,bottom:10},{x:0,top:0,bottom:0},{x:30,top:35,bottom:35},{x:0,top:35,bottom:0},{x:3,top:14,bottom:4}]){
  const a=timing.frameArea(w,h,margins);
  assert.ok(Math.abs(a.width/a.height-16/9)<1e-10);
  assert.ok(Math.abs(a.left+a.width/2-w/2)<1e-9);
  assert.ok(Math.abs(a.top+a.height/2-h*(1+(margins.top-margins.bottom)/100)/2)<1e-9);
  assert.ok(a.left>=w*margins.x/100-1e-9&&a.left+a.width<=w*(1-margins.x/100)+1e-9);
  assert.ok(a.top>=h*margins.top/100-1e-9&&a.top+a.height<=h*(1-margins.bottom/100)+1e-9);
 }
 const area=timing.frameArea(1344,1008,{x:10,top:10,bottom:10});
 assert.ok(Math.abs(area.width-1075.2)<1e-9);assert.ok(Math.abs(area.height-604.8)<1e-9);
});
