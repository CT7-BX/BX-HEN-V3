import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import WebSocket from 'ws';
import {createNativeStreamServer} from '../native-stream-server.mjs';import {frame,parse} from '../../native-transport/relay/protocol.mjs';
const CONSOLE='a'.repeat(64),PLAYER='b'.repeat(64),ORIGIN='https://native.example';
async function setup(){const app=createNativeStreamServer({consoleKey:CONSOLE,playerKey:PLAYER,publicOrigin:ORIGIN});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const port=app.server.address().port;return {...app,base:'http://127.0.0.1:'+port,ws:'ws://127.0.0.1:'+port};}
async function open(url,options={},protocols=[]){const ws=new WebSocket(url,protocols,options);await once(ws,'open');return ws;}
test('regional host preserves console/player auth and roundtrips real binary sockets without polling wait',async()=>{
 const a=await setup();try{
  const denied=await fetch(a.base+'/session',{method:'POST',headers:{Authorization:'Bearer '+CONSOLE}});assert.equal(denied.status,401);
  const consoleSocket=await open(a.ws+'/console-stream',{headers:{Authorization:'Bearer '+CONSOLE}});
  const s=await (await fetch(a.base+'/session',{method:'POST',headers:{Authorization:'Bearer '+PLAYER}})).json();
  const player=await open(a.ws+'/socket',{headers:{Origin:ORIGIN}},['binary','bx.'+s.ticket]);
  const packet=new Uint8Array(28);packet[0]=1;const received=once(consoleSocket,'message');player.send(packet);
  await new Promise(resolve=>setTimeout(resolve,10));consoleSocket.send(frame(0,1));const first=parse((await received)[0]);assert.equal(first.epoch,s.epoch);assert.deepEqual(first.packets,[packet]);
  const pushed=once(player,'message'),ack=once(consoleSocket,'message');packet[0]=129;consoleSocket.send(frame(s.epoch,2,[packet]));assert.deepEqual(new Uint8Array((await pushed)[0]),packet);assert.equal(parse((await ack)[0]).seq,2);
  const closed=once(player,'close');consoleSocket.close();await closed;assert.equal(a.room.session,null);
 }finally{await a.close();}
});
test('regional host rejects cross-origin and oversized HTTP bodies',async()=>{const a=await setup();try{
 assert.equal((await fetch(a.base+'/session',{method:'POST',headers:{Authorization:'Bearer '+PLAYER,Origin:'https://wrong.example'}})).status,403);
 assert.equal((await fetch(a.base+'/exchange',{method:'POST',headers:{Authorization:'Bearer '+CONSOLE},body:Buffer.alloc(256*1024+1)})).status,413);
 }finally{await a.close();}});
