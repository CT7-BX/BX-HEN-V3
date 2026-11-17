'use strict';
var Module={};
(()=>{
  const $=id=>document.getElementById(id),core=BXNativeCore;
  let ready=false,linked=false,running=false,reg=null,secret='',decoder=null,audio=null,channels=2,rate=48000,nextAudio=0,frames=0,audioFrames=0,time=0,codec='',savedSps=null,savedPps=null,ticker=null;
  let inputFocused=document.hasFocus(),registering=false,registrationDiagnostic=null;
  let waitForKeyframe=false,lastMetricsAt=Date.now(),lastMetricsFrames=0;
  const deviceStore=BXDeviceStore.create(globalThis.indexedDB);
  let savedProfile=null,linking=false,oneClickBusy=false,starting=false,playbackGeneration=0,connectionGeneration=0,stopping=false,stopTask=null;
  const audioSources=new Set();
  function clearAudio(){for(const source of audioSources){try{source.stop();}catch{}try{source.disconnect();}catch{}}audioSources.clear();nextAudio=0;}
  const fingers=new Map(),stickValues={left:[0,0],right:[0,0]},stickOwners=new Map();
  const status=text=>{$('status').textContent=text;};
  const call=(name,types,args)=>Module.ccall(name,'number',types,args);
  function controls(neutral=false){if(!ready||!running)return;neutral=neutral||!inputFocused||document.hidden;let state=core.gamepad(neutral?null:core.connectedPads(navigator).find(p=>p.mapping==='standard'));
    if(!neutral){for(const id of fingers.values()){if(id<16)state.buttons|=1<<id;else if(id===16)state.l2=255;else state.r2=255;}for(let i=0;i<2;i++){const a=stickValues.left[i],b=stickValues.right[i];if(a)state.axes[i]=Math.round(a*32767);if(b)state.axes[i+2]=Math.round(b*32767);}}
    call('chiaki_wasm_session_set_controller',Array(10).fill('number'),[state.buttons,state.l2,state.r2,...state.axes,0,0,0]);
  }
  function clearInput(){fingers.clear();stickValues.left=[0,0];stickValues.right=[0,0];stickOwners.clear();controls(true);}
  async function request(path,options={},json=false,timeout=5000){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try{const response=await fetch(path,{...options,signal:controller.signal});if(!response.ok)throw new Error('request_failed');return json?await response.json():response;}
    finally{clearTimeout(timer);}
  }
  function payloadStatus(){return request('/session-status',{headers:{Authorization:'Bearer '+secret},cache:'no-store'},true,3000);}
  function refresh(){$('connect').disabled=!ready||linked||linking||stopping||oneClickBusy;$('register').disabled=!linked||stopping||registering;$('play').disabled=!linked||stopping||!reg||running||starting||registering;$('export').disabled=!reg;$('resumeAudio').hidden=!running||!audio||audio.state!=='suspended';$('connectPlay').disabled=!ready||!savedProfile||running||starting||stopping||registering||linking||oneClickBusy;$('saveDevice').disabled=!linked||!reg||!secret||linking||oneClickBusy;$('forgetDevice').disabled=!savedProfile;}
  async function endPlayback(message){
    playbackGeneration++;starting=false;clearAudio();clearInput();const active=running;running=false;clearInterval(ticker);ticker=null;
    const oldDecoder=decoder,oldAudio=audio;decoder=null;audio=null;nextAudio=0;
    try{oldDecoder?.close();}catch{}if(ready&&active)call('chiaki_wasm_session_stop',[],[]);
    try{await oldAudio?.close();}catch{}refresh();if(message)status(message);
  }
  function stop(message='Sessão encerrada.'){
    if(stopTask)return stopTask;
    connectionGeneration++;registering=false;linked=false;stopping=true;const key=secret;secret='';refresh();
    stopTask=(async()=>{
      try{await endPlayback();if(key){try{await request('/session',{method:'DELETE',headers:{Authorization:'Bearer '+key},keepalive:true},false,3000);}catch{}}}
      finally{if(ready)call('chiaki_wasm_fini',[],[]);stopping=false;stopTask=null;refresh();status(message);}
    })();return stopTask;
  }
  function metrics(){const now=Date.now(),elapsed=now-lastMetricsAt;if(elapsed<400)return;const fps=Math.round((frames-lastMetricsFrames)*1000/elapsed);lastMetricsAt=now;lastMetricsFrames=frames;$('metrics').textContent=`Vídeo: ${fps} fps observados · ${frames} quadros decodificados · Áudio: ${audioFrames} blocos PCM recebidos`;}
  Module.onRuntimeInitialized=()=>{ready=true;if(!crossOriginIsolated||typeof SharedArrayBuffer==='undefined'||typeof VideoDecoder==='undefined'){ready=false;status('Este navegador não oferece os recursos necessários para o cliente Native.');return;}refresh();status('Cliente carregado. Autorize o celular para conectar ao payload.');};
  Module.onLog=(level,message)=>{if(!registering)return;const diagnostic=core.registrationDiagnostic(message);if(diagnostic){registrationDiagnostic=diagnostic;$('registrationDiagnostic').textContent=diagnostic.code+' — '+diagnostic.text;}}; // Raw upstream logs never leave this callback or enter the DOM.
  Module.onRegist=value=>{registering=false;try{if(!value.ok)throw new Error();reg=core.registration(value);$('pin').value='';$('account').value='';status('Registro Remote Play recebido. Inicie a sessão e confirme imagem, som e controle no PS4.');refresh();}catch{status(registrationDiagnostic?('Registro não concluído. '+registrationDiagnostic.code+' — '+registrationDiagnostic.text):'Registro não concluído (R00). A causa ainda não foi identificada; nenhum jogo foi confirmado.');}refresh();};
  Module.onEvent=(event,reason)=>{if(event==='connected'){status('Protocolo conectado; aguardando vídeo decodificado e áudio.');}else if(event==='quit'){if(linked){const code=Number.isInteger(reason)&&reason>=0&&reason<=255?' Q'+reason:'';void endPlayback('A transmissão terminou'+code+'. A conexão com o payload foi preservada; tente iniciar novamente.');}}else if(event==='pin'){void endPlayback('O PS4 pediu um PIN de login; esta versão ainda não atende esse fluxo. A conexão com o payload foi preservada.');}};
  Module.onAudioSettings=(ch,hz)=>{if((ch===1||ch===2)&&hz>=8000&&hz<=96000){channels=ch;rate=hz;}};
  Module.onAudio=(ptr,samples)=>{if(!running||!audio||document.hidden||audio.state!=='running'||!Number.isInteger(samples)||samples<1||samples>5760)return;const total=samples*channels;if(ptr<0||ptr+total*2>Module.HEAPU8.length)return;const pcm=Module.HEAP16.slice(ptr>>1,(ptr>>1)+total);if(nextAudio-audio.currentTime>0.25)return;const buffer=audio.createBuffer(channels,samples,rate);for(let c=0;c<channels;c++){const out=buffer.getChannelData(c);for(let i=0;i<samples;i++)out[i]=pcm[i*channels+c]/32768;}const source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);audioSources.add(source);source.onended=()=>{audioSources.delete(source);try{source.disconnect();}catch{}};nextAudio=Math.max(audio.currentTime+0.02,nextAudio);source.start(nextAudio);nextAudio+=samples/rate;audioFrames++;metrics();};
  Module.onVideo=(ptr,length)=>{if(!running||length<1||length>2*1024*1024||ptr<0||ptr+length>Module.HEAPU8.length)return;try{let bytes=Module.HEAPU8.slice(ptr,ptr+length);const nals=core.nals(bytes),key=nals.some(n=>n.type===5);for(const nal of nals){if(nal.type===7){savedSps=nal.packet;const s=nal.body;if(s.length>=4)codec='avc1.'+Array.from(s.slice(1,4),n=>n.toString(16).padStart(2,'0')).join('');}if(nal.type===8)savedPps=nal.packet;}
    if(!decoder){if(!key||!savedSps||!savedPps||!codec)return;const generation=playbackGeneration;
      decoder=new VideoDecoder({output:frame=>{try{if(!running||generation!==playbackGeneration||document.hidden)return;const canvas=$('screen');if(canvas.width!==frame.displayWidth)canvas.width=frame.displayWidth;if(canvas.height!==frame.displayHeight)canvas.height=frame.displayHeight;canvas.getContext('2d').drawImage(frame,0,0);frames++;metrics();if(frames===1)status('Vídeo decodificado recebido. Confirme no aparelho a origem PS4, o som e os controles.');}finally{frame.close();}},error:()=>{if(generation===playbackGeneration)void endPlayback('Falha ao decodificar H.264 neste aparelho. A conexão com o payload foi preservada.');}});decoder.configure({codec,optimizeForLatency:true});}
    if(decoder.decodeQueueSize>4)waitForKeyframe=true;
    if(waitForKeyframe){if(!key)return;decoder.reset();decoder.configure({codec,optimizeForLatency:true});waitForKeyframe=false;}
    if(key&&savedSps&&savedPps){const combined=new Uint8Array(savedSps.length+savedPps.length+bytes.length);combined.set(savedSps);combined.set(savedPps,savedSps.length);combined.set(bytes,savedSps.length+savedPps.length);bytes=combined;}
    decoder.decode(new EncodedVideoChunk({type:key?'key':'delta',timestamp:time,data:bytes}));time+=33333;
  }catch{void endPlayback('O fluxo de vídeo não pôde ser decodificado. A conexão com o payload foi preservada.');}};
  async function connect(key){
    if(linked)return true;if(linking||stopping)return false;
    if(!/^[0-9a-f]{64}$/.test(key)){status('Informe a chave de jogador gerada para este payload.');return false;}
    const generation=++connectionGeneration,current=()=>generation===connectionGeneration;
    const check=()=>{if(!current())throw new Error('connection_cancelled');};
    linking=true;refresh();
    try{
      const session=await request('/session',{method:'POST',headers:{Authorization:'Bearer '+key}},true);check();
      secret=key;$('playerKey').value='';
      if(call('bx_remote_set_ticket',['string'],[session.ticket])!==0)throw new Error();
      if(call('chiaki_wasm_init',['string'],['wss://'+location.host+'/socket'])!==0)throw new Error();
      const deadline=Date.now()+15000;while(!call('chiaki_wasm_net_ready',[],[])){check();if(Date.now()>deadline)throw new Error();await new Promise(r=>setTimeout(r,100));}
      check();status('Servidor conectado. Aguardando resposta do payload no PS4…');
      await core.waitForPayload(async()=>{check();const result=await payloadStatus();check();return result;});check();
      linked=true;status('Payload respondeu ao servidor. Registre ou importe o PS4; nenhum jogo foi confirmado ainda.');refresh();return true;
    }catch(error){if(current())await stop(error.message==='payload_offline'?'O payload do PS4 não respondeu. Confira /data/bx-rp-transport-report.txt antes de registrar.':'Não foi possível abrir o transporte. Confira a chave, o relay e o payload.');return false;}
    finally{linking=false;refresh();}
  }
  $('connect').onclick=()=>connect($('playerKey').value.trim());
  $('register').onclick=async()=>{if(registering)return;const pin=$('pin').value,account=$('account').value.trim();if(!/^\d{8}$/.test(pin)||!/^[A-Za-z0-9+/]{11}=$/.test(account)){status('Use o PIN de oito dígitos e o Account-ID de oito bytes em Base64.');return;}registering=true;registrationDiagnostic=null;$('registrationDiagnostic').textContent='Iniciando diagnóstico de registro…';refresh();
    try{if(!(await payloadStatus()).nativeOnline){registering=false;status('O payload parou de responder ao servidor. Confira o relatório no PS4 antes de registrar.');return;}
      const result=call('chiaki_wasm_regist',['string','number','string','number','number'],['127.0.0.1',Number(pin),account,0,0]);
      if(result!==0)registering=false;status(result===0?'Registrando no serviço Uso remoto do PS4…':'Não foi possível iniciar o pedido de registro neste navegador.');
    }catch{registering=false;status('Não foi possível verificar a conexão do payload. Tente conectar novamente.');}
    finally{refresh();}};
  async function startPlayback(preparedAudio=null){
    if(!linked||stopping||!reg||running||starting){try{await preparedAudio?.close();}catch{}return;}
    const generation=++playbackGeneration;starting=true;refresh();let candidate=null;
    try{
      candidate=preparedAudio||new (window.AudioContext||window.webkitAudioContext)();await candidate.resume();
      if(generation!==playbackGeneration||!linked){try{await candidate.close();}catch{}return;}
      audio=candidate;audio.onstatechange=refresh;nextAudio=0;frames=audioFrames=time=0;lastMetricsAt=Date.now();lastMetricsFrames=0;waitForKeyframe=false;savedSps=savedPps=null;codec='';const profile=core.videoProfile($('quality').value);running=true;
      if(call('chiaki_wasm_session_start',['string','string','string','number','number','number','number','number'],['127.0.0.1',reg.registKey,reg.morning,0,profile.preset,profile.fps,0,profile.bitrate])!==0)throw new Error('session_start_failed');
      if(generation!==playbackGeneration||!running)return;
      ticker=setInterval(()=>controls(),33);status('Solicitando sessão real do PS4 em '+profile.height+'p / '+profile.bitrate+' kbps…');
    }catch{
      if(generation===playbackGeneration){if(candidate!==audio){try{await candidate?.close();}catch{}}await endPlayback('Não foi possível iniciar áudio e sessão. A conexão com o payload foi preservada.');}
      else{try{await candidate?.close();}catch{}}
    }finally{if(generation===playbackGeneration){starting=false;refresh();}}
  }
  $('play').onclick=()=>startPlayback();
  $('stop').onclick=()=>{void stop();};
  $('export').onclick=()=>{if(!reg)return;const url=URL.createObjectURL(new Blob([JSON.stringify(reg)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='bx-ps4-registro-privado.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('import').onchange=async event=>{try{const file=event.target.files[0];if(!file||file.size>2048)throw new Error();reg=core.registration(JSON.parse((await file.text()).replace(/^\uFEFF/,'')));status('Registro importado somente neste aparelho.');refresh();}catch{status('Arquivo de registro inválido.');}event.target.value='';};
  deviceStore.read().then(value=>{savedProfile=value;$('savedStatus').textContent=value?'PS4 salvo neste navegador. Use Conectar e jogar.':'Nenhum PS4 salvo neste navegador. Conecte e registre ou importe uma vez.';refresh();}).catch(()=>{$('savedStatus').textContent='O navegador não disponibilizou o registro salvo. Você pode conectar e importar normalmente.';refresh();});
  $('saveDevice').onclick=async()=>{if(!linked||!reg||!secret)return;try{savedProfile=await deviceStore.save({version:1,playerKey:secret,registration:reg});$('savedStatus').textContent='PS4 salvo somente neste navegador. Na próxima visita, use Conectar e jogar.';}catch{$('savedStatus').textContent='Não foi possível salvar neste navegador. A sessão atual e a exportação continuam disponíveis.';}refresh();};
  $('forgetDevice').onclick=async()=>{try{await deviceStore.clear();savedProfile=null;$('savedStatus').textContent='Dados salvos apagados deste navegador.';}catch{$('savedStatus').textContent='Não foi possível apagar os dados salvos. Tente novamente.';}refresh();};
  $('connectPlay').onclick=async()=>{
    if(!savedProfile||oneClickBusy||running||!ready)return;const profile=core.deviceProfile(savedProfile),generation=playbackGeneration;let primed=null;oneClickBusy=true;refresh();
    try{
      // Resume audio during the tap, before waiting for network authorization.
      primed=new (window.AudioContext||window.webkitAudioContext)();await primed.resume();
      if(generation!==playbackGeneration||stopping)return;
      if(!await connect(profile.playerKey))return;
      reg=profile.registration;refresh();const prepared=primed;primed=null;await startPlayback(prepared);
    }catch{status('Não foi possível conectar e iniciar. O registro salvo foi preservado.');}
    finally{try{await primed?.close();}catch{}oneClickBusy=false;refresh();}
  };
  const buttons=[['×',0],['○',1],['□',2],['△',3],['←',4],['→',5],['↑',6],['↓',7],['L1',8],['R1',9],['L3',10],['R3',11],['OPTIONS',12],['SHARE',13],['Touchpad',14],['PS',15],['L2',16],['R2',17]];
  for(const [label,bit] of buttons){const button=document.createElement('button');button.textContent=label;button.onpointerdown=event=>{event.preventDefault();button.setPointerCapture(event.pointerId);fingers.set(event.pointerId,bit);controls();};for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{fingers.delete(event.pointerId);controls();});$('keys').append(button);}
  for(const side of ['left','right']){const element=$(side+'Stick');const update=event=>{const r=element.getBoundingClientRect(),x=(event.clientX-r.left-r.width/2)/(r.width/2),y=(event.clientY-r.top-r.height/2)/(r.height/2),scale=Math.max(1,Math.hypot(x,y));stickValues[side]=[x/scale,y/scale];controls();};element.onpointerdown=e=>{if(stickOwners.has(side))return;e.preventDefault();stickOwners.set(side,e.pointerId);element.setPointerCapture(e.pointerId);update(e);};element.onpointermove=e=>{if(stickOwners.get(side)===e.pointerId)update(e);};for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,e=>{if(stickOwners.get(side)===e.pointerId){stickOwners.delete(side);stickValues[side]=[0,0];controls();}});}
  function controllerStatus(){
    const pads=core.connectedPads(navigator),pad=pads.find(p=>p.mapping==='standard');
    let text='Conecte o controle ao aparelho por Bluetooth ou USB e pressione um botão.';
    if(typeof navigator.getGamepads!=='function')text='Este navegador não disponibiliza controle físico. Use os controles de toque.';
    else if(pad){const state=core.gamepad(pad),active=state.buttons||state.l2||state.r2||state.axes.some(Boolean);text=active?'Entrada do controle detectada neste aparelho. A resposta no PS4 precisa ser confirmada durante o jogo.':'Controle reconhecido neste aparelho. Pressione um botão ou mova um analógico para testar.';}
    else if(pads.length)text='Controle detectado sem mapeamento padrão. Use os controles de toque neste navegador.';
    if($('controllerStatus').textContent!==text)$('controllerStatus').textContent=text;
  }
  const area=$('playerArea');
  const nativeFullscreen=()=>document.fullscreenElement||document.webkitFullscreenElement;
  function displayState(){const expanded=!!nativeFullscreen()||area.classList.contains('expanded');area.classList.toggle('game-view',expanded);$('fullscreen').textContent=expanded?'Sair da tela cheia':'Tela cheia';$('fullscreen').setAttribute('aria-pressed',String(expanded));}
  function expandedFallback(value){area.classList.toggle('expanded',value);document.body.classList.toggle('game-expanded',value);displayState();}
  $('fullscreen').onclick=async()=>{
    try{
      if(nativeFullscreen()){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document);}
      else if(area.classList.contains('expanded'))expandedFallback(false);
      else {const enter=area.requestFullscreen||area.webkitRequestFullscreen;if(enter){try{await enter.call(area);}catch{expandedFallback(true);}}else expandedFallback(true);}
      $('displayStatus').textContent=area.classList.contains('expanded')?'Modo ampliado: este navegador pode manter suas barras visíveis.':'';
    }catch{$('displayStatus').textContent='Não foi possível alterar a tela. Tente novamente.';}
    displayState();
  };
  document.addEventListener('fullscreenchange',displayState);document.addEventListener('webkitfullscreenchange',displayState);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){expandedFallback(false);$('displayStatus').textContent='';}});
  window.addEventListener('gamepadconnected',controllerStatus);window.addEventListener('gamepaddisconnected',()=>{clearInput();controllerStatus();});
  setInterval(controllerStatus,250);controllerStatus();
  setInterval(()=>{if(ready&&linked&&!linking&&!stopping&&!call('chiaki_wasm_net_ready',[],[]))void stop('A conexão caiu. O registro foi preservado; use Conectar e jogar para tentar novamente.');},1000);
  window.addEventListener('focus',()=>{inputFocused=true;});
  window.addEventListener('blur',()=>{inputFocused=false;clearInput();});
  function background(){inputFocused=false;clearInput();clearAudio();if(running)waitForKeyframe=true;if(linked)$('connectionNote').textContent='Sessão mantida ao trocar de tela. O navegador pode suspender vídeo e áudio em segundo plano.';}
  async function foreground(){
    inputFocused=document.hasFocus();nextAudio=0;if(!linked)return;
    if(audio){try{await audio.resume();}catch{}refresh();}
    try{const state=await payloadStatus();if(linked)$('connectionNote').textContent=state.nativeOnline?'Payload conectado. A página voltou ao primeiro plano.':'O payload não respondeu à verificação. Se o navegador suspendeu a conexão, desconecte e conecte novamente.';}
    catch{if(linked)$('connectionNote').textContent='Não foi possível verificar a conexão ao voltar. Tente novamente mantendo esta tela aberta.';}
  }
  window.addEventListener('pagehide',background);window.addEventListener('pageshow',()=>{void foreground();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)background();else void foreground();});
  $('resumeAudio').onclick=async()=>{if(!audio)return;try{await audio.resume();nextAudio=0;}catch{$('connectionNote').textContent='O navegador não liberou o áudio. Toque em Retomar áudio novamente.';}refresh();};
})();
