const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),core=require('./www/core.js');
function harness(){
  const elements=new Map(),events=new Map(),intervals=new Map(),calls=[],pads=[];
  const classList=()=>{const names=new Set();return {contains:x=>names.has(x),toggle(x,on){if(on===undefined)on=!names.has(x);if(on)names.add(x);else names.delete(x);return on;}};};
  const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',classList:classList(),setAttribute(k,v){this[k]=v;},addEventListener(){},append(){}});return elements.get(id);};
  const document={body:{classList:classList()},hidden:false,hasFocus:()=>true,getElementById:element,createElement:()=>element(Symbol()),addEventListener:(name,fn)=>events.set('document:'+name,fn)};
  const window={addEventListener:(name,fn)=>events.set(name,fn),AudioContext:class{async resume(){}async close(){}}};
  const navigator={getGamepads:()=>pads};
  const context=vm.createContext({window,document,navigator,BXNativeCore:core,Map,Array,Uint8Array,AbortController,SharedArrayBuffer,crossOriginIsolated:true,VideoDecoder:class{},location:{host:'example.test'},setInterval:(fn,ms)=>{intervals.set(ms,fn);return ms;},clearInterval:ms=>intervals.delete(ms),setTimeout,clearTimeout,fetch:async path=>({ok:true,json:async()=>path==='/session'?{ticket:'test'}:{nativeOnline:true}})});
  vm.runInContext(fs.readFileSync(__dirname+'/www/player.js','utf8'),context);
  context.Module.ccall=(name,type,types,args)=>{calls.push({name,args});return name==='chiaki_wasm_net_ready'?1:0;};
  context.Module.onRuntimeInitialized();
  return {element,document,events,intervals,calls,pads,context};
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
