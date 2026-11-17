const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),core=require('./www/core.js');
function harness(){
  const elements=new Map(),events=new Map(),intervals=new Map(),calls=[],pads=[],requests=[];
  const classList=()=>{const names=new Set();return {contains:x=>names.has(x),toggle(x,on){if(on===undefined)on=!names.has(x);if(on)names.add(x);else names.delete(x);return on;}};};
  const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',classList:classList(),setAttribute(k,v){this[k]=v;},addEventListener(){},append(){}});return elements.get(id);};
  const document={body:{classList:classList()},hidden:false,hasFocus:()=>true,getElementById:element,createElement:()=>element(Symbol()),addEventListener:(name,fn)=>events.set('document:'+name,fn)};
  const window={addEventListener:(name,fn)=>events.set(name,fn),AudioContext:class{state="running";async resume(){this.state="running";}async close(){this.state="closed";}}};
  const navigator={getGamepads:()=>pads};
  const context=vm.createContext({window,document,navigator,BXNativeCore:core,Map,Array,Uint8Array,AbortController,SharedArrayBuffer,crossOriginIsolated:true,VideoDecoder:class{},location:{host:'example.test'},setInterval:(fn,ms)=>{intervals.set(ms,fn);return ms;},clearInterval:ms=>intervals.delete(ms),setTimeout,clearTimeout,fetch:async(path,options={})=>{requests.push({path,method:options.method||'GET'});return {ok:true,json:async()=>path==='/session'?{ticket:'test'}:{nativeOnline:true}};}});
  vm.runInContext(fs.readFileSync(__dirname+'/www/player.js','utf8'),context);
  context.Module.ccall=(name,type,types,args)=>{calls.push({name,args});return name==='chiaki_wasm_net_ready'?1:0;};
  context.Module.onRuntimeInitialized();
  return {element,document,events,intervals,calls,pads,context,requests};
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
