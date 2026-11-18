/* BX browser-side adapters. Protocol implementation is the credited Chiaki WASM. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.BXNativeCore=api;})(globalThis,()=>{
  const MAP=[0,1,2,3,8,9,-1,-1,13,12,10,11,6,7,4,5,15,14];
  function gamepad(pad){const out={buttons:0,l2:0,r2:0,axes:[0,0,0,0]};if(!pad || !pad.connected || pad.mapping!=='standard')return out;
    MAP.forEach((bit,i)=>{if(bit>=0&&pad.buttons[i]?.pressed)out.buttons|=1<<bit;});
    const value=i=>{const n=pad.buttons[i]?.value;return typeof n==='number'&&Number.isFinite(n)?Math.round(Math.max(0,Math.min(1,n))*255):0;};out.l2=value(6);out.r2=value(7);
    out.axes=out.axes.map((_,i)=>{const n=pad.axes[i];return typeof n==='number'&&Number.isFinite(n)?Math.round(Math.max(-1,Math.min(1,Math.abs(n)<0.12?0:n))*32767):0;});return out;
  }
  function videoProfile(name,options={}){
    const profiles={stable:{preset:1,height:360,fps:30,bitrate:800},balanced:{preset:2,height:540,fps:30,bitrate:1500},quality:{preset:3,height:720,fps:30,bitrate:3000},performance:{preset:3,height:720,fps:60,bitrate:0},pro:{preset:4,height:1080,fps:60,bitrate:0}};
    if(name!=='custom')return {...(profiles[name]||profiles.stable)};
    const height=Number(options.height),fps=Number(options.fps),bitrate=Number(options.bitrate??0),preset=[360,540,720,1080].indexOf(height)+1;
    if(!preset||![30,60].includes(fps)||!Number.isInteger(bitrate)||bitrate<0||bitrate>2147483647)throw new Error('invalid_video_profile');
    return {preset,height,fps,bitrate};
  }
  function connectedPads(device){try{return Array.from(device.getGamepads?.()??[]).filter(p=>p?.connected);}catch{return [];}}
  function registrationDiagnostic(message){
    if(typeof message!=='string')return null;
    const rules=[
      ['Regist timed out waiting for search response','R03','O serviço Uso remoto não respondeu à busca feita pelo payload.'],
      ['Regist failed to getaddrinfo','R02','Falhou a resolução do endereço interno do PS4.'],
      ['Regist failed to create socket for search','R01','Não foi possível abrir o socket de busca.'],
      ['Regist failed to bind socket','R01','Não foi possível preparar o socket de busca.'],
      ['Regist eventually failed to connect for search','R01','Falhou a preparação da busca no serviço Uso remoto.'],
      ['Regist eventually failed to connect for request','R04','Não foi possível abrir a conexão de registro no PS4.'],
      ['Regist failed to send search','R05','Falhou o envio da busca ao serviço Uso remoto.'],
      ['Regist failed to send request header','R05','Falhou o envio do pedido de registro.'],
      ['Regist failed to send payload','R05','Falhou o envio dos dados de registro.'],
      ['Regist failed to receive response HTTP header','R06','O PS4 não entregou um cabeçalho de resposta ao registro.'],
      ['Regist failed to parse response payload','R08','Não foi possível interpretar a resposta de registro.'],
      ['Regist starting search','S01','Buscando o serviço Uso remoto pelo payload…'],
      ['Regist received search response from','S02','O serviço respondeu à busca; abrindo o registro…'],
      ['Regist waiting for response','S03','Pedido enviado; aguardando resposta do serviço Uso remoto…']
    ];
    const http=/^Regist received HTTP code ([1-5][0-9]{2})$/.exec(message);
    if(http)return {code:'R07',text:'O serviço respondeu ao registro com HTTP '+http[1]+'.'};
    for(const [prefix,code,text]of rules)if(message.startsWith(prefix))return {code,text};
    return null; // Never return or retain raw logs, hostnames, PINs or key data.
  }
  function registration(value){if(!value||value.ps5||!(/^[0-9a-f]{32}$/i.test(value.registKey))||!(/^[0-9a-f]{32}$/i.test(value.morning)))throw new Error('Registro PS4 inválido');return {registKey:value.registKey,morning:value.morning,ps5:false};}
  function deviceProfile(value){if(!value||value.version!==1||!(/^[0-9a-f]{64}$/.test(value.playerKey)))throw new Error('invalid_device_profile');return {version:1,playerKey:value.playerKey,registration:registration(value.registration)};}
  function nals(bytes){const starts=[];for(let i=0;i+3<bytes.length;i++){if(bytes[i]===0&&bytes[i+1]===0&&((bytes[i+2]===1)||(bytes[i+2]===0&&bytes[i+3]===1))){const skip=bytes[i+2]===1?3:4;starts.push({at:i,data:i+skip});i+=skip-1;}}
    return starts.map((s,i)=>({type:bytes[s.data]&31,body:bytes.slice(s.data,i+1<starts.length?starts[i+1].at:bytes.length),packet:bytes.slice(s.at,i+1<starts.length?starts[i+1].at:bytes.length)}));}
  async function waitForPayload(readStatus,{now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=15000}={}){
    const deadline=now()+timeoutMs;
    while(now()<deadline){if((await readStatus()).nativeOnline===true)return;await sleep(500);}
    throw new Error('payload_offline');
  }
  return Object.freeze({gamepad,videoProfile,connectedPads,registrationDiagnostic,registration,deviceProfile,nals,waitForPayload});
});
