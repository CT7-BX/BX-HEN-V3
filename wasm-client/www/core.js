/* BX browser-side adapters. Protocol implementation is the credited Chiaki WASM. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.BXNativeCore=api;})(globalThis,()=>{
  const MAP=[0,1,2,3,8,9,-1,-1,13,12,10,11,6,7,4,5,15,14];
  function gamepad(pad){const out={buttons:0,l2:0,r2:0,axes:[0,0,0,0]};if(!pad || !pad.connected || pad.mapping!=='standard')return out;
    MAP.forEach((bit,i)=>{if(bit>=0&&pad.buttons[i]?.pressed)out.buttons|=1<<bit;});
    const value=i=>{const n=pad.buttons[i]?.value;return typeof n==='number'&&Number.isFinite(n)?Math.round(Math.max(0,Math.min(1,n))*255):0;};out.l2=value(6);out.r2=value(7);
    out.axes=out.axes.map((_,i)=>{const n=pad.axes[i];return typeof n==='number'&&Number.isFinite(n)?Math.round(Math.max(-1,Math.min(1,Math.abs(n)<0.12?0:n))*32767):0;});return out;
  }
  function registration(value){if(!value||value.ps5||!(/^[0-9a-f]{32}$/i.test(value.registKey))||!(/^[0-9a-f]{32}$/i.test(value.morning)))throw new Error('Registro PS4 inválido');return {registKey:value.registKey,morning:value.morning,ps5:false};}
  function nals(bytes){const starts=[];for(let i=0;i+3<bytes.length;i++){if(bytes[i]===0&&bytes[i+1]===0&&((bytes[i+2]===1)||(bytes[i+2]===0&&bytes[i+3]===1))){const skip=bytes[i+2]===1?3:4;starts.push({at:i,data:i+skip});i+=skip-1;}}
    return starts.map((s,i)=>({type:bytes[s.data]&31,body:bytes.slice(s.data,i+1<starts.length?starts[i+1].at:bytes.length),packet:bytes.slice(s.at,i+1<starts.length?starts[i+1].at:bytes.length)}));}
  return Object.freeze({gamepad,registration,nals});
});
