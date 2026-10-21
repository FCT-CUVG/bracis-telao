import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../assets/playback.js';
function setup(advance){
 let clock=100,playing=true;const timers=new Map(),reports=[];let id=0,guard;
 guard=globalThis.TelaoPlayback.create({now:()=>clock,setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),shouldRun:()=>playing,advance:()=>advance(guard),report:reason=>reports.push(reason)});
 return {guard,timers,reports,advance:ms=>clock+=ms,pause:()=>playing=false};
}
test('A dropped scene timer is recovered once, then normal timing resumes',async()=>{
 let scenes=0;const {guard,timers,reports,advance}=setup(g=>{scenes++;g.arm(36000);});guard.arm(36000);advance(46001);await guard.check();
 assert.equal(scenes,1);assert.deepEqual(reports,['late-transition']);assert.equal(timers.size,1);await guard.check();assert.equal(scenes,1);
});
test('An error during a scene transition schedules a retry instead of ending the loop',async()=>{
 let calls=0;const {guard,timers,reports}=setup(()=>{calls++;throw Error('decode failed');});guard.arm(1);await [...timers.values()][0]();assert.equal(calls,1);assert.deepEqual(reports,['scene-error']);assert.ok(timers.size>0);
});
test('Paused playback is never resumed by the recovery guard',async()=>{
 let calls=0;const {guard,advance,pause,reports}=setup(()=>calls++);guard.arm(100);pause();advance(20000);await guard.check();assert.equal(calls,0);assert.equal(reports.length,0);
});
test('Cancelled and stale timers cannot advance the sequence twice',async()=>{
 let calls=0;const {guard,timers}=setup(()=>calls++);guard.arm(100);const stale=[...timers.values()][0];guard.arm(100);await stale();assert.equal(calls,0);const latest=[...timers.values()][0];guard.cancel();await latest();assert.equal(calls,0);assert.equal(timers.size,0);
});
