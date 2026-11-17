const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),core=require('./www/core.js');
function harness(saved={value:null}){
  const elements=new Map(),events=new Map(),intervals=new Map(),calls=[],pads=[],requests=[];
  const classList=()=>{const names=new Set();return {contains:x=>names.has(x),toggle(x,on){if(on===undefined)on=!names.has(x);if(on)names.add(x);else names.delete(x);return on;}};};
  const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',classList:classList(),setAttribute(k,v){this[k]=v;},addEventListener(){},append(){}});return elements.get(id);};
  const document={body:{classList:classList()},hidden:false,hasFocus:()=>true,getElementById:element,createElement:()=>element(Symbol()),addEventListener:(name,fn)=>events.set('document:'+name,fn)};
  const window={addEventListener:(name,fn)=>events.set(name,fn),AudioContext:class{state="running";async resume(){this.state="running";}async close(){this.state="closed";}}};
  const navigator={getGamepads:()=>pads};
  const context=vm.createContext({window,document,navigator,BXNativeCore:core,BXDeviceStore:{create:()=>({read:async()=>saved.value,save:async value=>{if(saved.failSave)throw new Error();saved.value=core.deviceProfile(value);return saved.value;},clear:async()=>{saved.value=null;}})},Map,Array,Uint8Array,AbortController,SharedArrayBuffer,crossOriginIsolated:true,VideoDecoder:class{},location:{host:'example.test'},setInterval:(fn,ms)=>{intervals.set(ms,fn);return ms;},clearInterval:ms=>intervals.delete(ms),setTimeout,clearTimeout,fetch:async(path,options={})=>{requests.push({path,method:options.method||'GET'});return {ok:true,json:async()=>path==='/session'?{ticket:'test'}:{nativeOnline:true}};}});
  vm.runInContext(fs.readFileSync(__dirname+'/www/player.js','utf8'),context);
  context.Module.ccall=(name,type,types,args)=>{calls.push({name,args});return name==='chiaki_wasm_net_ready'?1:0;};
  context.Module.onRuntimeInitialized();
  return {element,document,events,intervals,calls,pads,context,requests,saved};
}
test('fullscreen enters native API and exits; CSS fallback remains escapable when unsupported or denied',async()=>{
  const h=harness(),area=h.element('playerArea'),button=h.element('fullscreen');let enters=0,exits=0;
  area.requestFullscreen=async()=>{enters++;h.document.fullscreenElement=area;};
  h.document.exitFullscreen=async()=>{exits++;h.document.fullscreenElement=null;};
  await button.onclick();assert.equal(enters,1);assert.equal(button['aria-pressed'],'true');
  await button.onclick();assert.equal(exits,1);assert.equal(button['aria-pressed'],'false');
  area.requestFullscreen=async()=>{throw new Error('denied');};await button.onclick();assert.equal(area.classList.contains('expanded'),true);assert.match(h.element('displayStatus').textContent,/barras/);
  h.events.get('document:keydown')({key:'Escape'});assert.equal(area.classList.contains('expanded'),false);
  delete area.requestFullscreen;await button.onclick();assert.equal(area.classList.contains('expanded'),true);await button.onclick();assert.equal(area.classList.contains('expanded'),false);
});
test('physical controller preview works before PS4 connection, and blur/disconnect neutralize transmitted input',async()=>{
  const h=harness(),buttons=Array.from({length:18},()=>({pressed:false,value:0}));buttons[0].pressed=true;buttons[6].value=.75;
  h.pads.push({connected:true,mapping:'standard',buttons,axes:[.5,0,0,0]});h.intervals.get(250)();assert.match(h.element('controllerStatus').textContent,/Entrada do controle detectada neste aparelho/);
  h.element('playerKey').value='a'.repeat(64);await h.element('connect').onclick();
  await h.element('import').onchange({target:{files:[{size:100,text:async()=>JSON.stringify({registKey:'a'.repeat(32),morning:'b'.repeat(32)})}]}});
  await h.element('play').onclick();const tick=h.intervals.get(33);assert.equal(typeof tick,'function');tick();
  const last=()=>h.calls.filter(c=>c.name==='chiaki_wasm_session_set_controller').at(-1).args;
  assert.equal(last()[0],1);assert.equal(last()[1],191);assert.equal(last()[3],16384);
  h.events.get('blur')();tick();assert.deepEqual(Array.from(last()),Array(10).fill(0));
  h.events.get('focus')();tick();assert.equal(last()[0],1);
  h.pads[0].connected=false;h.events.get('gamepaddisconnected')();tick();assert.deepEqual(Array.from(last()),Array(10).fill(0));
});

test('failed WASM session start closes audio and does not keep polling controls',async()=>{const h=harness();h.element('playerKey').value='a'.repeat(64);await h.element('connect').onclick();await h.element('import').onchange({target:{files:[{size:100,text:async()=>JSON.stringify({registKey:'a'.repeat(32),morning:'b'.repeat(32)})}]}});const original=h.context.Module.ccall;h.context.Module.ccall=(name,...args)=>name==='chiaki_wasm_session_start'?-1:original(name,...args);await h.element('play').onclick();assert.equal(h.intervals.has(33),false);assert.match(h.element('status').textContent,/Não foi possível iniciar/);});
test('registration prevents duplicate requests and shows sanitized stage after failure',async()=>{const h=harness();h.element('playerKey').value='a'.repeat(64);await h.element('connect').onclick();h.element('account').value='AAAAAAAAAAA=';h.element('pin').value='12345678';await h.element('register').onclick();assert.equal(h.element('register').disabled,true);await h.element('register').onclick();assert.equal(h.calls.filter(c=>c.name==='chiaki_wasm_regist').length,1);h.context.Module.onLog(1,'Regist timed out waiting for search response');h.context.Module.onLog(1,'Account-ID PRIVATE_SECRET');h.context.Module.onRegist({ok:false,error:'failed'});assert.equal(h.element('register').disabled,false);assert.match(h.element('status').textContent,/R03/);assert.doesNotMatch(h.element('status').textContent,/PRIVATE_SECRET|12345678|AAAAAAAAAAA/);});

async function beginPlayback(h){h.element('playerKey').value='a'.repeat(64);await h.element('connect').onclick();await h.element('import').onchange({target:{files:[{size:100,text:async()=>JSON.stringify({registKey:'a'.repeat(32),morning:'b'.repeat(32)})}]}});await h.element('play').onclick();}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('hidden and pagehide preserve live transport and playback but release all controls',async()=>{
 const h=harness();await beginPlayback(h);h.document.hidden=true;h.events.get('document:visibilitychange')();h.events.get('pagehide')({persisted:true});h.intervals.get(33)();await flush();
 assert.equal(h.calls.some(c=>c.name==='chiaki_wasm_session_stop'||c.name==='chiaki_wasm_fini'),false);assert.equal(h.requests.some(r=>r.method==='DELETE'),false);
 assert.equal(h.element('connect').disabled,true);assert.equal(h.element('play').disabled,true);
 const state=h.calls.filter(c=>c.name==='chiaki_wasm_session_set_controller').at(-1);assert.deepEqual(Array.from(state.args),Array(10).fill(0));
 h.document.hidden=false;h.events.get('document:visibilitychange')();await flush();assert.match(h.element('connectionNote').textContent,/Payload conectado/);assert.equal(h.requests.filter(r=>r.path==='/session'&&r.method==='POST').length,1);
});
test('stream quit preserves registration and authorization for retry; explicit disconnect still ends transport',async()=>{
 const h=harness();await beginPlayback(h);h.context.Module.onEvent('quit',7,'PRIVATE_RAW_REASON');await flush();assert.equal(h.element('connect').disabled,true);assert.equal(h.element('play').disabled,false);assert.equal(h.element('export').disabled,false);assert.match(h.element('status').textContent,/Q7/);assert.doesNotMatch(h.element('status').textContent,/PRIVATE_RAW_REASON/);
 assert.equal(h.requests.some(r=>r.method==='DELETE'),false);assert.equal(h.calls.some(c=>c.name==='chiaki_wasm_fini'),false);
 await h.element('play').onclick();assert.equal(h.calls.filter(c=>c.name==='chiaki_wasm_session_start').length,2);
 h.element('stop').onclick();await flush();assert.equal(h.requests.filter(r=>r.method==='DELETE').length,1);assert.equal(h.calls.filter(c=>c.name==='chiaki_wasm_fini').length,1);assert.equal(h.element('connect').disabled,false);
});

test('stream startup uses selected bitrate and real resolution preset rather than pixel height',async()=>{const h=harness();h.element('quality').value='stable';await beginPlayback(h);const first=h.calls.find(c=>c.name==='chiaki_wasm_session_start');assert.equal(first.args[4],1);assert.equal(first.args[5],30);assert.equal(first.args[7],800);h.context.Module.onEvent('quit',0);await flush();h.element('quality').value='balanced';await h.element('play').onclick();const second=h.calls.filter(c=>c.name==='chiaki_wasm_session_start').at(-1);assert.equal(second.args[4],2);assert.equal(second.args[7],1500);});
test('decoder backlog waits for a keyframe before accepting more dependent frames',async()=>{const h=harness();let decoder;h.context.VideoDecoder=class{decodeQueueSize=0;decoded=[];resets=0;constructor(){decoder=this;}configure(){}decode(frame){this.decoded.push(frame.type);}reset(){this.resets++;this.decodeQueueSize=0;}close(){}};h.context.EncodedVideoChunk=class{constructor(value){Object.assign(this,value);}};h.context.Module.HEAPU8=new Uint8Array(128);await beginPlayback(h);const feed=bytes=>{h.context.Module.HEAPU8.fill(0);h.context.Module.HEAPU8.set(bytes);h.context.Module.onVideo(0,bytes.length);};const key=[0,0,1,0x67,100,0,40,0,0,1,0x68,1,0,0,1,0x65,2],delta=[0,0,1,0x41,2];feed(key);assert.deepEqual(decoder.decoded,['key']);decoder.decodeQueueSize=5;feed(delta);decoder.decodeQueueSize=0;feed(delta);assert.deepEqual(decoder.decoded,['key']);feed(key);assert.equal(decoder.resets,1);feed(delta);assert.deepEqual(decoder.decoded,['key','key','delta']);});

test('saved device profile reconnects and starts playback after page reload without file import or PIN',async()=>{
 const saved={value:null};const first=harness(saved);await beginPlayback(first);first.element('pin').value='12345678';first.element('account').value='PRIVATE_ACCOUNT';await first.element('saveDevice').onclick();assert.deepEqual(Object.keys(saved.value).sort(),['playerKey','registration','version']);assert.doesNotMatch(JSON.stringify(saved.value),/12345678|PRIVATE_ACCOUNT/);
 const next=harness(saved);await flush();assert.equal(next.element('connectPlay').disabled,false);assert.equal(next.element('playerKey').value,'');await next.element('connectPlay').onclick();assert.equal(next.calls.filter(c=>c.name==='chiaki_wasm_session_start').length,1);assert.equal(next.calls.filter(c=>c.name==='chiaki_wasm_regist').length,0);
 await next.element('forgetDevice').onclick();assert.equal(saved.value,null);assert.equal(next.element('connect').disabled,true);assert.equal(next.requests.some(r=>r.method==='DELETE'),false);
});
test('storage failure preserves manual import and active connection',async()=>{const h=harness({value:null,failSave:true});await beginPlayback(h);await h.element('saveDevice').onclick();assert.match(h.element('savedStatus').textContent,/Não foi possível salvar/);assert.equal(h.element('connect').disabled,true);assert.equal(h.element('export').disabled,false);});

test('duplicate start is ignored and stop cancels an audio resume still in progress',async()=>{
 const h=harness();let resume,closed=0;
 h.context.window.AudioContext=class{state='suspended';resume(){return new Promise(resolve=>{resume=resolve;});}async close(){closed++;}};
 h.element('playerKey').value='a'.repeat(64);await h.element('connect').onclick();
 await h.element('import').onchange({target:{files:[{size:100,text:async()=>JSON.stringify({registKey:'a'.repeat(32),morning:'b'.repeat(32)})}]}});
 const pending=h.element('play').onclick();assert.equal(h.element('play').disabled,true);
 await h.element('play').onclick();h.element('stop').onclick();await flush();resume();await pending;
 assert.equal(h.calls.filter(c=>c.name==='chiaki_wasm_session_start').length,0);assert.equal(h.intervals.has(33),false);assert.equal(closed,1);
});
function videoHarness(h){
 const decoders=[];h.context.VideoDecoder=class{decodeQueueSize=0;constructor(callbacks){this.callbacks=callbacks;decoders.push(this);}configure(){}decode(){}reset(){}close(){}};
 h.context.EncodedVideoChunk=class{constructor(value){Object.assign(this,value);}};h.context.Module.HEAPU8=new Uint8Array(128);
 const key=[0,0,1,0x67,100,0,40,0,0,1,0x68,1,0,0,1,0x65,2];
 return {decoders,feed(){h.context.Module.HEAPU8.set(key);h.context.Module.onVideo(0,key.length);}};
}
test('late decoder callbacks from an ended session cannot draw or terminate the new session',async()=>{
 const h=harness(),v=videoHarness(h);await beginPlayback(h);v.feed();const old=v.decoders[0];
 h.context.Module.onEvent('quit',0);await flush();await h.element('play').onclick();v.feed();let closed=0;
 old.callbacks.output({displayWidth:640,displayHeight:360,close(){closed++;}});old.callbacks.error(new Error('old decoder'));
 await flush();assert.equal(closed,1);assert.equal(h.intervals.has(33),true);assert.equal(h.calls.filter(c=>c.name==='chiaki_wasm_session_stop').length,1);
});
test('video reuses the canvas dimensions and always releases decoded frames',async()=>{
 const h=harness(),v=videoHarness(h);await beginPlayback(h);v.feed();const canvas=h.element('screen');let width=0,height=0,resizes=0,draws=0,closed=0;
 Object.defineProperty(canvas,'width',{get:()=>width,set:x=>{width=x;resizes++;}});Object.defineProperty(canvas,'height',{get:()=>height,set:x=>{height=x;resizes++;}});canvas.getContext=()=>({drawImage(){draws++;}});
 for(let i=0;i<3;i++)v.decoders[0].callbacks.output({displayWidth:640,displayHeight:360,close(){closed++;}});
 assert.equal(resizes,2);assert.equal(draws,3);assert.equal(closed,3);
 h.document.hidden=true;v.decoders[0].callbacks.output({close(){closed++;}});assert.equal(closed,4);assert.equal(draws,3);
});
test('background and playback end stop and disconnect all scheduled audio sources',async()=>{
 const h=harness(),sources=[];
 h.context.window.AudioContext=class{state='running';currentTime=0;destination={};async resume(){}async close(){}createBuffer(){return {getChannelData:()=>new Float32Array(2)};}createBufferSource(){const s={stops:0,disconnects:0,connect(){},start(){},stop(){this.stops++;},disconnect(){this.disconnects++;}};sources.push(s);return s;}};
 h.context.Module.HEAPU8=new Uint8Array(16);h.context.Module.HEAP16=new Int16Array(8);
 await beginPlayback(h);h.context.Module.onAudio(0,2);assert.equal(sources.length,1);
 h.document.hidden=true;h.events.get('document:visibilitychange')();assert.equal(sources[0].stops,1);assert.equal(sources[0].disconnects,1);
 h.document.hidden=false;h.context.Module.onAudio(0,2);h.context.Module.onEvent('quit',0);await flush();assert.equal(sources[1].stops,1);assert.equal(sources[1].disconnects,1);
});

test('stop during pending authorization cannot initialize a transport after cancellation',async()=>{
 const h=harness();let release;
 h.context.fetch=()=>new Promise(resolve=>{release=resolve;});h.element('playerKey').value='a'.repeat(64);
 const pending=h.element('connect').onclick();h.element('stop').onclick();await flush();
 release({ok:true,json:async()=>({ticket:'late'})});await pending;
 assert.equal(h.calls.some(c=>c.name==='chiaki_wasm_init'),false);assert.equal(h.element('connect').disabled,false);assert.match(h.element('status').textContent,/Sessão encerrada/);
});
test('disconnect is serialized and blocks a new connection until cleanup completes',async()=>{
 const h=harness();await beginPlayback(h);const original=h.context.fetch;let release,deletes=0;
 h.context.fetch=(path,options)=>{if(options?.method==='DELETE'){deletes++;return new Promise(resolve=>{release=resolve;});}return original(path,options);};
 h.element('stop').onclick();h.element('stop').onclick();await flush();assert.equal(h.element('connect').disabled,true);
 h.element('playerKey').value='a'.repeat(64);await h.element('connect').onclick();assert.equal(h.requests.filter(r=>r.method==='POST').length,1);assert.equal(deletes,1);
 release({ok:true});await flush();assert.equal(h.element('connect').disabled,false);
});
test('closed WASM transport releases playback and permits saved-profile reconnect without registering again',async()=>{
 const h=harness();await beginPlayback(h);await h.element('saveDevice').onclick();const original=h.context.Module.ccall;
 h.context.Module.ccall=(name,...args)=>name==='chiaki_wasm_net_ready'?0:original(name,...args);
 h.intervals.get(1000)();await flush();assert.equal(h.intervals.has(33),false);assert.equal(h.element('connectPlay').disabled,false);assert.match(h.element('status').textContent,/conexão caiu/);assert.ok(h.saved.value);
 h.context.Module.ccall=original;await h.element('connectPlay').onclick();assert.equal(h.calls.filter(c=>c.name==='chiaki_wasm_session_start').length,2);assert.equal(h.calls.filter(c=>c.name==='chiaki_wasm_regist').length,0);
});
test('authorization request times out and restores connect controls',async()=>{
 const h=harness();let timeout;
 h.context.setTimeout=(fn,ms)=>{if(ms===5000)timeout=fn;return 123;};h.context.clearTimeout=()=>{};
 h.context.fetch=(path,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
 h.element('playerKey').value='a'.repeat(64);const pending=h.element('connect').onclick();assert.equal(typeof timeout,'function');timeout();await pending;assert.equal(h.element('connect').disabled,false);assert.equal(h.calls.some(c=>c.name==='chiaki_wasm_init'),false);
});

test('direct LAN mode initializes the RTC socket only when the direct payload is available',async()=>{
 const h=harness();let configured='',cleared=0;h.context.BXDirectTransport={configure:key=>{configured=key;},clear:()=>{cleared++;},stats:()=>null,active:()=>false};const original=h.context.fetch;
 h.context.fetch=(path,options)=>path==='/direct-status'?Promise.resolve({ok:true,json:async()=>({available:true,scope:'lan'})}):original(path,options);
 h.element('transport').value='direct';await beginPlayback(h);assert.equal(configured,'a'.repeat(64));assert.equal(h.calls.find(c=>c.name==='chiaki_wasm_init').args[0],'wss://example.test/rtc-socket');
 h.element('stop').onclick();await flush();assert.equal(cleared,1);
 const missing=harness();missing.element('transport').value='direct';missing.element('playerKey').value='a'.repeat(64);await missing.element('connect').onclick();assert.match(missing.element('status').textContent,/bx-rp-direct-v11/);assert.equal(missing.calls.some(c=>c.name==='chiaki_wasm_init'),false);
});
