import test from 'node:test';import assert from 'node:assert/strict';import worker,{BXNativeRoom} from './worker.mjs';import {frame,parse} from './protocol.mjs';
const CONSOLE='a'.repeat(64),PLAYER='b'.repeat(64),BASE='https://native.example.workers.dev';
function room(){const env={BX_PLAYER_KEY:PLAYER,BX_CONSOLE_KEY:CONSOLE};const r=new BXNativeRoom({},env);env.NATIVE_ROOM={idFromName:n=>n,get:()=>r};return {r,call:(path,method,key,body)=>worker.fetch(new Request(BASE+path,{method,headers:{Authorization:'Bearer '+key,Origin:BASE},body}),env)};}
test('player and console credentials have separate capabilities',async()=>{const {r,call}=room();try{assert.equal((await call('/session','POST',CONSOLE)).status,401);assert.equal((await call('/exchange','POST',PLAYER,frame(0,1))).status,401);assert.equal((await call('/session','POST',PLAYER)).status,200);assert.equal((await call('/session','DELETE',CONSOLE)).status,401);}finally{r.close();}});
test('native retry forwards opaque bytes to the same player only once',async()=>{const {r,call}=room();try{const session=await (await call('/session','POST',PLAYER)).json();const delivered=[];r.session.socket={readyState:1,send:p=>delivered.push(p),close(){}};await call('/exchange','POST',CONSOLE,frame(0,1));const p=new Uint8Array(28);p[0]=129;const body=frame(session.epoch,2,[p]);for(let i=0;i<2;i++){const response=await call('/exchange','POST',CONSOLE,body);assert.equal(response.status,200);assert.equal(parse(await response.arrayBuffer()).seq,2);}assert.equal(delivered.length,1);await call('/session','DELETE',PLAYER);assert.equal(r.session,null);const idle=await call('/exchange','POST',CONSOLE,frame(session.epoch,3));assert.equal(parse(await idle.arrayBuffer()).epoch,0);}finally{r.close();}});
test('origin and URL credentials cannot bypass authentication',async()=>{const env={};const response=await worker.fetch(new Request(BASE+'/exchange?token='+CONSOLE),env);assert.equal(response.status,403);});
test('WebSocket opts into ArrayBuffer before accept on current compatibility dates',async()=>{
 const originalPair=globalThis.WebSocketPair,OriginalResponse=globalThis.Response;const {r,call}=room();
 try{await call('/session','POST',PLAYER);let server;
  globalThis.WebSocketPair=class{constructor(){server={binaryType:'blob',events:{},accept(){assert.equal(this.binaryType,'arraybuffer');},addEventListener(name,fn){this.events[name]=fn;},close(){}};return {0:{},1:server};}};
  globalThis.Response=class extends OriginalResponse{constructor(body,options){if(options?.status===101){super(null,{status:200});this.upgraded=true;return;}super(body,options);}};
  const response=await r.fetch(new Request(BASE+'/socket',{headers:{Upgrade:'websocket',Origin:BASE,'Sec-WebSocket-Protocol':'binary,bx.'+r.session.ticket}}));assert.equal(response.upgraded,true);
  const p=new Uint8Array(28);p[0]=1;server.events.message({data:p.buffer});assert.equal(r.session.exchange.queue.length,1);
 }finally{r.close();globalThis.WebSocketPair=originalPair;globalThis.Response=OriginalResponse;}
});
test('relay socket alone does not prove payload presence; authenticated exchanges expire from status',async()=>{const {r,call}=room();try{
 assert.equal((await call('/session-status','GET',CONSOLE)).status,401);
 await call('/session','POST',PLAYER);
 assert.deepEqual(await (await call('/session-status','GET',PLAYER)).json(),{nativeOnline:false});
 await call('/exchange','POST',CONSOLE,frame(0,1));
 assert.deepEqual(await (await call('/session-status','GET',PLAYER)).json(),{nativeOnline:true});
 r.session.readyAt=Date.now()-16000;
 assert.deepEqual(await (await call('/session-status','GET',PLAYER)).json(),{nativeOnline:false});
 }finally{r.close();}});
