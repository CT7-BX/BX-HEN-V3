/* Experimental regional host for the existing BX native relay protocol.
 * No PS4 listener, no recording, no shell execution, no credential logging.
 * Deploy behind verified HTTPS/WSS; publicOrigin must match the player site.
 */
import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import worker,{BXNativeRoom} from '../native-transport/relay/worker.mjs';
const NativeResponse=globalThis.Response;
class UpgradeResponse extends NativeResponse {
 constructor(body,options){if(options?.status===101){super(null,{status:200});this.upgrade=options.webSocket;}else super(body,options);}
}
class SocketPair {
 constructor(){
  const listeners=new Map();let ws=null,accepted=false,closed=false;
  const server={binaryType:'blob',get readyState(){return closed?3:ws?ws.readyState:accepted?1:0;},get bufferedAmount(){return ws?.bufferedAmount??0;},accept(){accepted=true;},addEventListener(name,fn){listeners.set(name,fn);},send(data){if(!ws||ws.readyState!==1)throw new Error('socket_unavailable');ws.send(data,{binary:true});},close(code=1000,reason='closed'){closed=true;ws?.close(code,reason);}};
  const client={attach(value){ws=value;ws.on('message',(data,binary)=>listeners.get('message')?.({data:binary?data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength):data.toString()}));ws.on('close',()=>{closed=true;listeners.get('close')?.({});});ws.on('error',()=>listeners.get('error')?.({}));}};
  return {0:client,1:server};
 }
}
// Platform adapters are fixed process-wide. Each request gets its own pair.
globalThis.Response=UpgradeResponse;globalThis.WebSocketPair=SocketPair;
export function createNativeStreamServer({consoleKey,playerKey,publicOrigin}){
 const origin=new URL(publicOrigin);if(origin.protocol!=='https:'||origin.origin!==publicOrigin)throw new Error('canonical_https_origin_required');
 if(!/^[a-f0-9]{64}$/.test(consoleKey??'')||!/^[a-f0-9]{64}$/.test(playerKey??'')||consoleKey===playerKey)throw new Error('distinct_keys_required');
 const env={BX_CONSOLE_KEY:consoleKey,BX_PLAYER_KEY:playerKey};const room=new BXNativeRoom({},env);env.NATIVE_ROOM={idFromName:n=>n,get:()=>room};
 const sockets=new Set(),wss=new WebSocketServer({noServer:true,maxPayload:256*1024,perMessageDeflate:false,handleProtocols:protocols=>protocols.has('binary')?'binary':false});
 function request(req,body){return new Request(publicOrigin+req.url,{method:req.method,headers:req.headers,...(body?.length?{body}:{} )});}
 const server=createServer({maxHeaderSize:16384},async(req,res)=>{
  let bytes=0,overflow=false;const chunks=[];
  try{
   for await(const chunk of req){bytes+=chunk.length;if(bytes>256*1024){overflow=true;chunks.length=0;}else if(!overflow)chunks.push(chunk);}
   if(overflow){res.writeHead(413).end();return;}
   const response=await worker.fetch(request(req,Buffer.concat(chunks)),env);
   if(response.upgrade){res.writeHead(426).end();return;}
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{if(!res.headersSent)res.writeHead(400);res.end();}
 });
 server.requestTimeout=10000;server.headersTimeout=5000;
 server.on('upgrade',async(req,socket,head)=>{
  socket.on('error',()=>{});
  try{
   const response=await worker.fetch(request(req),env);
   if(!response.upgrade){socket.end(`HTTP/1.1 ${response.status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);return;}
   wss.handleUpgrade(req,socket,head,ws=>{ws._socket?.setNoDelay(true);sockets.add(ws);ws.on('close',()=>sockets.delete(ws));response.upgrade.attach(ws);});
  }catch{socket.destroy();}
 });
 return {server,room,async close(){room.close();room.consoleSocket?.close(1000,'shutdown');for(const ws of sockets)ws.terminate();wss.close();await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const app=createNativeStreamServer({consoleKey:process.env.BX_CONSOLE_KEY,playerKey:process.env.BX_PLAYER_KEY,publicOrigin:process.env.BX_PUBLIC_ORIGIN});
 const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('invalid_port');
 app.server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log('BX regional native relay listening'));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
}
