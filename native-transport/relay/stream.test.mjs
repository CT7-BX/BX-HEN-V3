import test from 'node:test';
import assert from 'node:assert/strict';
import {BXNativeRoom} from './worker.mjs';
import {frame,parse} from './protocol.mjs';
const KEY='a'.repeat(64),PLAYER='b'.repeat(64),BASE='https://native.example';
function setup(){
 const OriginalResponse=globalThis.Response,OriginalPair=globalThis.WebSocketPair;
 let socket;const r=new BXNativeRoom({}, {BX_CONSOLE_KEY:KEY,BX_PLAYER_KEY:PLAYER});
 globalThis.WebSocketPair=class{constructor(){socket={readyState:1,bufferedAmount:0,binaryType:'blob',events:{},sent:[],accept(){assert.equal(this.binaryType,'arraybuffer');},addEventListener(k,f){this.events[k]=f;},send(p){this.sent.push(parse(p));},close(){this.readyState=3;}};return {0:{},1:socket};}};
 globalThis.Response=class extends OriginalResponse{constructor(body,options){if(options?.status===101){super(null,{status:200});this.upgraded=true;}else super(body,options);}};
 const call=(path,method='GET',key=KEY,body)=>r.fetch(new Request(BASE+path,{method,headers:{Authorization:'Bearer '+key,Upgrade:'websocket'},body}));
 return {r,call,get socket(){return socket;},send(p){socket.events.message({data:p.buffer.slice(p.byteOffset,p.byteOffset+p.byteLength)});},cleanup(){r.close();globalThis.Response=OriginalResponse;globalThis.WebSocketPair=OriginalPair;}};
}
test('persistent console authenticates independently and pipelines ordered batches',async()=>{const t=setup();try{
 assert.equal((await t.call('/console-stream','GET',PLAYER)).status,401);
 assert.equal((await t.call('/console-stream')).upgraded,true);
 const s=await (await t.call('/session','POST',PLAYER)).json();
 t.r.session.socket={readyState:1,send(){},close(){}};
 t.send(frame(0,1));for(let i=2;i<=65;i++)t.send(frame(s.epoch,i));
 assert.deepEqual(t.socket.sent.map(p=>p.seq),Array.from({length:65},(_,i)=>i+1));
 assert.equal((await t.call('/exchange','POST',KEY,frame(s.epoch,66))).status,409);
 t.socket.events.close();assert.equal(t.r.session,null);assert.equal(t.r.consoleSocket,null);
 }finally{t.cleanup();}});
test('reset barrier discards stale in-flight batches until fresh hello',async()=>{const t=setup();try{
 await t.call('/console-stream');const old=await (await t.call('/session','POST',PLAYER)).json();t.send(frame(0,1));
 const fresh=await (await t.call('/session','POST',PLAYER)).json();
 t.send(frame(old.epoch,2));assert.equal(t.socket.sent.at(-1).epoch,0);
 const length=t.socket.sent.length;t.send(frame(old.epoch,3));t.send(frame(old.epoch,4));assert.equal(t.socket.sent.length,length);
 t.send(frame(0,1));assert.equal(t.socket.sent.at(-1).epoch,fresh.epoch);assert.equal(t.socket.sent.at(-1).seq,1);
 }finally{t.cleanup();}});
test('persistent console rejects oversized, text and backed-up traffic',async()=>{
 for(const invalid of ['text','large','backpressure']){const t=setup();try{await t.call('/console-stream');await t.call('/session','POST',PLAYER);
 if(invalid==='backpressure')t.socket.bufferedAmount=1024*1024;
 if(invalid==='text')t.socket.events.message({data:'not binary'});else t.send(invalid==='large'?new Uint8Array(256*1024+1):frame(0,1));
 assert.equal(t.r.consoleSocket,null);assert.equal(t.r.session,null);assert.equal(t.socket.readyState,3);
 }finally{t.cleanup();}}
});
