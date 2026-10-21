import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../assets/compat.js',import.meta.url),'utf8');
function setup(window={}){const timers=[];vm.runInNewContext(code,{window,Promise,Error,setTimeout:callback=>timers.push(callback)});return {compat:window.TelaoCompat,timers};}
test('Browsers without AbortSignal.timeout still cancel slow requests with AbortController',()=>{
  const controller={signal:{},abort(){this.aborted=true;}};const {compat,timers}=setup({AbortController:function(){return controller;}});
  assert.equal(compat.timeoutSignal(45000),controller.signal);assert.equal(controller.aborted,undefined);timers[0]();assert.equal(controller.aborted,true);
});
test('Browsers without cancellation APIs keep a usable request path',()=>{const {compat}=setup();assert.equal(compat.timeoutSignal(10),undefined);});
test('Images without decode load through events and release listeners',async()=>{
  const listeners=new Map(),image={complete:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const {compat}=setup();const pending=compat.decodeImage(image);listeners.get('load')();await pending;assert.equal(listeners.size,0);
  const broken=compat.decodeImage(image);listeners.get('error')();await assert.rejects(broken,/indisponível/);assert.equal(listeners.size,0);
});
test('Cached images without decode do not wait for an event that already fired',async()=>{const {compat}=setup();await compat.decodeImage({complete:true,naturalWidth:100});await assert.rejects(compat.decodeImage({complete:true,naturalWidth:0}),/indisponível/);});
