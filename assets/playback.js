(function(root){
  'use strict';
  root.TelaoPlayback={create:function(options){
    var now=options.now||function(){return performance.now();},later=options.setTimeout||setTimeout,clear=options.clearTimeout||clearTimeout;
    var timer=null,deadline=0,generation=0,running=false;
    function cancel(){if(timer!==null)clear(timer);timer=null;deadline=0;generation++;}
    function arm(milliseconds){cancel();deadline=now()+milliseconds;var version=generation;timer=later(function(){return advance(version);},milliseconds);}
    function report(reason,error){if(options.report)options.report(reason,error);}
    async function advance(version){
      if(version!==generation||running||!options.shouldRun())return;
      timer=null;deadline=0;running=true;
      try{await options.advance();}
      catch(error){report('scene-error',error);if(options.shouldRun()&&!deadline)arm(2000);}
      finally{running=false;}
    }
    function check(){
      if(!running&&deadline&&now()>deadline+10000&&options.shouldRun()){
        report('late-transition');if(timer!==null)clear(timer);return advance(generation);
      }
    }
    return {arm:arm,cancel:cancel,check:check};
  }};
}(typeof window!=='undefined'?window:globalThis));
