/* BX input transport v1 — small bounded controller frames for WebRTC.
 * This transport DOES NOT inject PS4 input. It carries user-authorized
 * touch/gamepad state to a paired peer (Mac test, future Android/PS4 bridge).
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.BXInputTransport=api;
})(typeof globalThis==="object"?globalThis:this,function(){
  "use strict";
  const LABEL="bx-gamepad-v1";
  const MAX_BYTES=512;
  const BUTTON_COUNT=18;
  const WATCHDOG_MS=450;

  function finite(value,min,max){
    return typeof value==="number"&&Number.isFinite(value)&&value>=min&&value<=max;
  }
  function normalized(state){
    if(!state||typeof state!=="object"||Array.isArray(state))return null;
    if(!Array.isArray(state.buttons)||state.buttons.length>BUTTON_COUNT||
       !Array.isArray(state.axes)||state.axes.length!==4||
       !Array.isArray(state.triggers)||state.triggers.length!==2)return null;
    const set=new Set();
    for(const id of state.buttons){
      if(!Number.isInteger(id)||id<0||id>=BUTTON_COUNT||set.has(id))return null;
      set.add(id);
    }
    if(!state.axes.every(x=>finite(x,-1,1))||
       !state.triggers.every(x=>finite(x,0,1)))return null;
    return Object.freeze({
      buttons:Object.freeze(Array.from(set).sort((a,b)=>a-b)),
      axes:Object.freeze(state.axes.map(n=>Math.round(n*100)/100)),
      triggers:Object.freeze(state.triggers.map(n=>Math.round(n*100)/100))
    });
  }
  function neutral(){
    return normalized({buttons:[],axes:[0,0,0,0],triggers:[0,0]});
  }
  function encode(input,seq){
    const state=normalized(input);
    if(!state||!Number.isSafeInteger(seq)||seq<1||seq>Number.MAX_SAFE_INTEGER)
      throw new TypeError("Invalid input frame");
    const result=JSON.stringify({v:1,type:"input",seq,
      buttons:state.buttons,axes:state.axes,triggers:state.triggers});
    if(result.length>MAX_BYTES)throw new RangeError("Input frame too large");
    return result;
  }
  function decode(raw){
    if(typeof raw!=="string"||raw.length>MAX_BYTES||raw.length<16)return null;
    let obj;
    try{obj=JSON.parse(raw);}catch{return null;}
    if(!obj||Array.isArray(obj)||obj.v!==1||obj.type!=="input"||
       !Number.isSafeInteger(obj.seq)||obj.seq<1)return null;
    const state=normalized(obj);
    return state?Object.freeze({seq:obj.seq,state}):null;
  }
  function isNeutral(state){
    return Boolean(state && !state.buttons.length &&
      state.axes.every(x=>x===0)&&state.triggers.every(x=>x===0));
  }
  function createReceiver({onInput=()=>{},onStatus=()=>{},
      setTimeoutFn=setTimeout,clearTimeoutFn=clearTimeout,
      watchdogMs=WATCHDOG_MS}={}){
    let lastSeq=0,active=true,timer=null,hasInput=false;
    const timeout=Number.isFinite(watchdogMs)?
      Math.max(150,Math.min(3000,watchdogMs)):WATCHDOG_MS;
    const clear=()=>{if(timer!==null){clearTimeoutFn(timer);timer=null;}};
    const neutralize=(reason)=>{
      clear();
      if(hasInput){hasInput=false;onInput(neutral(),{reason,seq:lastSeq});}
      onStatus(reason);
    };
    const arm=()=>{
      clear();
      timer=setTimeoutFn(()=>{
        timer=null;
        if(active)neutralize("input_timeout");
      },timeout);
    };
    function receive(raw){
      if(!active)return false;
      const frame=decode(raw);
      if(!frame||frame.seq<=lastSeq)return false;
      lastSeq=frame.seq;
      hasInput=true;
      onInput(frame.state,{reason:"received",seq:lastSeq});
      arm();
      return true;
    }
    function stop(){
      if(!active)return;
      active=false;
      neutralize("input_closed");
    }
    return Object.freeze({receive,stop,lastSequence:()=>lastSeq});
  }
  return Object.freeze({LABEL,MAX_BYTES,WATCHDOG_MS,normalized,neutral,
    isNeutral,encode,decode,createReceiver});
});
