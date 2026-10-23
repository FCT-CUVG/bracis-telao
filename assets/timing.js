(function(root){
  'use strict';
  var order=['single','mixed','motion','pan'],roles=['landscape','portrait','square','unknown'];
  function output(settings,format){var result=Object.assign({},settings);if(format==='vertical'||format==='horizontal'){result.screenWidth=format==='horizontal'?1344:336;result.screenHeight=1008;result.fitScreen=false;}return result;}
  function horizontal(config){return Number(config&&config.screenWidth)>Number(config&&config.screenHeight);}
  function modes(value){var chosen=(value||order).map(function(mode){return mode==='triple'||mode==='quad'?'mixed':mode;});var result=order.filter(function(mode){return chosen.indexOf(mode)>=0;});return result.length?result:order.slice();}
  function orientation(photo){var w=Number(photo.width),h=Number(photo.height);if(!(w>0&&h>0))return 'unknown';return w>h?'landscape':h>w?'portrait':'square';}
  function available(photos,selected){var p=photos.filter(function(photo){return orientation(photo)==='portrait';}).length,l=photos.filter(function(photo){return orientation(photo)==='landscape';}).length;
    var result=modes(selected).filter(function(mode){return mode==='motion'||mode==='single'&&p>0||mode==='pan'&&l>0||mode==='mixed'&&p>0&&l>=2;});return result.length?result:[p?'single':l?'pan':'motion'];}
  function eligible(photos,selected){var active=available(photos,selected);return photos.map(function(photo,index){return {photo:photo,index:index};}).filter(function(item){var role=orientation(item.photo);return active.indexOf('motion')>=0||role==='portrait'&&(active.indexOf('single')>=0||active.indexOf('mixed')>=0)||role==='landscape'&&(active.indexOf('pan')>=0||active.indexOf('mixed')>=0);}).map(function(item){return item.index;});}
  function modeRoles(mode,config){return mode==='single'?(horizontal(config)?['portrait','portrait']:['portrait']):mode==='pan'?['landscape']:mode==='mixed'?['portrait','landscape','landscape']:(horizontal(config)?['any','any','any','any']:['any','any','any','any','any','any']);}
  function speed(config){return [0.25,0.5,1].indexOf(Number(config.motionSpeed))>=0?Number(config.motionSpeed):0.5;}
  function sceneSeconds(mode,config){return Number(config.duration||12)/speed(config);}
  function dominant(counts){return roles.reduce(function(best,role){return counts[role]>counts[best]?role:best;},roles[0]);}
  function nextMode(active,cursor,remaining,config){
    var chosen=-1;for(var step=0;step<active.length;step++){var index=(cursor+step)%active.length,need={portrait:0,landscape:0};modeRoles(active[index],config).forEach(function(role){if(role!=='any')need[role]++;});if((active[index]==='motion'&&Object.keys(remaining).some(function(role){return remaining[role]>0;}))||(active[index]!=='motion'&&remaining.portrait>=need.portrait&&remaining.landscape>=need.landscape)){chosen=index;break;}}
    if(chosen<0)chosen=cursor%active.length;return {mode:active[chosen],cursor:(chosen+1)%active.length};
  }
  function cycle(input,config){
    var photos=Array.isArray(input)?input:Array.from({length:input},function(_,i){return i%3===0?{width:2,height:3}:{width:3,height:2};}),active=available(photos,config.modes),indices=eligible(photos,config.modes),remaining={landscape:0,portrait:0,square:0,unknown:0};
    indices.forEach(function(index){remaining[orientation(photos[index])]++;});var total=indices.length,seconds=0,scenes=0,cursor=0;
    while(total>0){var next=nextMode(active,cursor,remaining,config),mode=next.mode;cursor=next.cursor;modeRoles(mode,config).forEach(function(role){var chosen=role==='any'?dominant(remaining):role;if(remaining[chosen]>0){remaining[chosen]--;total--;}});seconds+=sceneSeconds(mode,config);scenes++;}
    return {seconds:seconds,scenes:scenes,photos:indices.length};
  }
  function cover(w,h,containerWidth,containerHeight){var scale=Math.max(containerWidth/w,containerHeight/h)*1.025,width=w*scale,height=h*scale,dx=Math.max(0,width-containerWidth),dy=Math.max(0,height-containerHeight);return {width:width,height:height,startX:dy>dx?-dx/2:0,startY:dy>dx?0:-dy/2,endX:dy>dx?-dx/2:-dx,endY:dy>dx?-dy:-dy/2};}
  function signalStage(w,h,config){var width=h*Number(config.screenWidth)/Number(config.screenHeight);return {width:width,height:h,scaleX:w/width};}
  function frameArea(w,h,margins){
    var x=Number(margins.x)||0,top=Number(margins.top)||0,bottom=Number(margins.bottom)||0,availableWidth=w*(1-2*x/100),availableHeight=h*(1-(top+bottom)/100);
    var width=Math.min(availableWidth,availableHeight*16/9),height=width*9/16;
    return {left:(w-width)/2,top:h*top/100+(availableHeight-height)/2,width:width,height:height};
  }
  function imageSize(w,h,targetHeight){var limit=Math.max(100,Math.min(2016,Number(targetHeight)||1008)),scale=Math.min(1,2016/Math.max(w,h),limit/h);return {width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale))};}
  function format(seconds){var minutes=Math.floor(seconds/60),rest=Math.round(seconds%60);return (minutes?minutes+' min':'')+(minutes&&rest?' ':'')+(rest||!minutes?rest+' s':'');}
  root.TelaoTiming={output:output,horizontal:horizontal,modes:modes,orientation:orientation,available:available,eligible:eligible,modeRoles:modeRoles,dominant:dominant,nextMode:nextMode,sceneSeconds:sceneSeconds,cycle:cycle,cover:cover,imageSize:imageSize,frameArea:frameArea,signalStage:signalStage,format:format};
}(typeof window!=='undefined'?window:globalThis));
