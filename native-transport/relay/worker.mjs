/* Isolated BX native transport. Does not modify bx-remote-link or BX-HEN.
 * No media is decoded/stored here; encrypted Remote Play bytes stay opaque.
 */
import {ASSETS,SOURCE_URL} from './assets.mjs';
import {Exchange,frame,parse,MAX_BATCH} from './protocol.mjs';
const TTL=60*60*1000,MAX_SOCKET_BUFFER=512*1024;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
async function authorized(request,secret){
  if(!/^[0-9a-f]{64}$/.test(secret??''))return false;
  const supplied=request.headers.get('Authorization')??'';
  if(!/^Bearer [0-9a-f]{64}$/.test(supplied))return false;
  const [a,b]=await Promise.all([supplied.slice(7),secret].map(v=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))));
  const x=new Uint8Array(a),y=new Uint8Array(b);let different=0;for(let i=0;i<32;i++)different|=x[i]^y[i];return different===0;
}
function ticket(){const b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');}
async function boundedBody(request){const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks=[];try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BATCH)throw new Error('body_limit');chunks.push(value);}const all=new Uint8Array(size);let at=0;for(const chunk of chunks){all.set(chunk,at);at+=chunk.length;}return all;}finally{try{await reader.cancel();}catch{}}}
export class BXNativeRoom {
  constructor(ctx,env){this.ctx=ctx;this.env=env;this.session=null;this.queue=Promise.resolve();this.consoleSocket=null;this.directSeenAt=0;this.consolePush=false;this.consoleEpoch=0;}
  close(reason='session_ended'){this.consoleEpoch=0;const s=this.session;this.session=null;if(s){clearTimeout(s.timer);try{s.socket?.close(1000,reason);}catch{}}}
  touch(s){if(this.session===s)s.expiresAt=Date.now()+TTL;}
  armExpiry(s){s.timer=setTimeout(()=>{if(this.session!==s)return;if(Date.now()>=s.expiresAt)this.close();else this.armExpiry(s);},Math.max(1,s.expiresAt-Date.now()));}
  exchangeResult(raw){
    const s=this.session;
    if(!s||Date.now()>=s.expiresAt){this.close();return {status:200,body:frame(0,0)};}
    try{const body=s.exchange.exchange(raw,packet=>{
      if(!s.socket||s.socket.readyState!==1||(s.socket.bufferedAmount??0)>MAX_SOCKET_BUFFER)throw new Error('player_unavailable');s.socket.send(packet);
    });s.readyAt=Date.now();this.touch(s);return {status:200,body};}
    catch(error){if(error.message==='epoch_changed')return {status:409,error:'epoch_changed'};this.close();return {status:400,error:'transport_closed'};}
  }
  async fetch(request){const next=this.queue.then(()=>this.handle(request));this.queue=next.catch(()=>{});return next;}
  async handle(request){
    const url=new URL(request.url),path=url.pathname;
    if(path.startsWith('/direct-') && request.method==='POST'){
      const consoleRoute=path==='/direct-poll'||path==='/direct-answer';
      if(!await authorized(request,consoleRoute?this.env.BX_CONSOLE_KEY:this.env.BX_PLAYER_KEY))return json({error:'unauthorized'},401);
      const now=Date.now(),s=this.session;
      if(path==='/direct-status')return json({available:this.directSeenAt>0&&now-this.directSeenAt<5000,scope:'lan',relayAvailable:this.consoleSocket?.readyState===1||Boolean(s&&s.readyAt>0&&now-s.readyAt<15000)});
      if(path==='/direct-poll'){
        this.directSeenAt=now;
        const offer=s?.directOffer;if(offer&&offer.expiresAt>now&&s.expiresAt>now)this.touch(s);
        return new Response(offer&&s.expiresAt>now&&offer.expiresAt>now?offer.id+'\n'+offer.sdp:'',{headers:{'Content-Type':'application/sdp','Cache-Control':'no-store'}});
      }
      if(!s||s.expiresAt<=now)return json({error:'session_required'},409);
      const bytes=await boundedBody(request);if(bytes.length>16449)return json({error:'signal_limit'},413);
      let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return json({error:'invalid_signal'},400);}
      const validSdp=value=>value.length<=16384&&/^v=0\r?\n/.test(value)&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
      if(path==='/direct-offer'){
        if(!validSdp(text))return json({error:'invalid_offer'},400);
        s.directOffer={id:ticket(),sdp:text,answer:null,expiresAt:now+30000};return json({id:s.directOffer.id});
      }
      const offer=s.directOffer;
      if(!offer||offer.expiresAt<=now)return json({error:'offer_expired'},410);
      if(path==='/direct-answer'){
        if(text.slice(0,64)!==offer.id||text[64]!=='\n')return json({error:'offer_changed'},409);
        const answer=text.slice(65);if(!validSdp(answer))return json({error:'invalid_answer'},400);
        if(offer.answer&&offer.answer!==answer)return json({error:'answer_already_set'},409);
        offer.answer=answer;return json({accepted:true});
      }
      if(path==='/direct-result'){
        if(text!==offer.id)return json({error:'offer_changed'},409);
        return json(offer.answer?{ready:true,answer:offer.answer}:{ready:false});
      }
      return json({error:'not_found'},404);
    }
    if(path==='/session' && request.method==='POST'){
      if(!await authorized(request,this.env.BX_PLAYER_KEY))return json({error:'unauthorized'},401);
      this.close();let epoch=0;while(!epoch){epoch=crypto.getRandomValues(new Uint32Array(1))[0];}
      const s={epoch,ticket:ticket(),exchange:new Exchange(epoch),socket:null,opened:false,expiresAt:Date.now()+TTL,readyAt:0};
      this.session=s;this.armExpiry(s);
      return json({ticket:s.ticket,epoch,expiresAt:s.expiresAt});
    }
    if(path==='/session' && request.method==='DELETE'){
      if(!await authorized(request,this.env.BX_PLAYER_KEY))return json({error:'unauthorized'},401);
      this.close();return json({stopped:true});
    }
    if(path==='/session-status' && request.method==='GET'){
      if(!await authorized(request,this.env.BX_PLAYER_KEY))return json({error:'unauthorized'},401);
      const s=this.session,now=Date.now();
      return json({nativeOnline:Boolean(s && s.expiresAt>now && s.readyAt>0 && now-s.readyAt<15000)});
    }
    if(path==='/exchange' && request.method==='POST'){
      if(!await authorized(request,this.env.BX_CONSOLE_KEY))return json({error:'unauthorized'},401);
      if(this.consoleSocket?.readyState===1)return json({error:'persistent_transport_active'},409);
      const result=this.exchangeResult(await boundedBody(request));
      return result.status===200?new Response(result.body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store'}}):json({error:result.error},result.status);
    }
    if(path==='/console-stream' && request.method==='GET'){
      if(!await authorized(request,this.env.BX_CONSOLE_KEY))return json({error:'unauthorized'},401);
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'websocket_required'},426);
      const pair=new WebSocketPair(),client=pair[0],socket=pair[1];socket.binaryType='arraybuffer';socket.accept();
      const old=this.consoleSocket;this.consoleSocket=socket;this.consolePush=request.headers.get('X-BX-Downlink')==='push-v1';try{old?.close(1000,'replaced');}catch{}this.close('native_reconnected');
      let resetPending=false;
      socket.addEventListener('message',event=>{
        if(this.consoleSocket!==socket)return;
        try{
          if(!(event.data instanceof ArrayBuffer)||event.data.byteLength>MAX_BATCH)throw new Error('invalid_message');
          if((socket.bufferedAmount??0)>MAX_SOCKET_BUFFER)throw new Error('backpressure');
          const raw=new Uint8Array(event.data),packet=parse(raw),hello=packet.epoch===0&&packet.seq===1&&packet.packets.length===0;
          if(resetPending&&!hello)return; // Drop old in-flight data until the reset barrier is acknowledged.
          if(hello)resetPending=false;
          const result=this.exchangeResult(raw);
          if(result.status===200){const response=parse(result.body);this.consoleEpoch=response.epoch;if(response.epoch===0)resetPending=true;socket.send(result.body);}
          else if(result.status===409){resetPending=true;socket.send(frame(0,0));}
          else throw new Error('transport_closed');
        }catch{try{socket.close(1008,'transport_closed');}catch{}if(this.consoleSocket===socket){this.consoleSocket=null;this.close('native_disconnected');}}
      });
      const lost=()=>{if(this.consoleSocket===socket){this.consoleSocket=null;this.close('native_disconnected');}};
      socket.addEventListener('close',lost);socket.addEventListener('error',lost);
      return new Response(null,{status:101,webSocket:client});
    }
    if(path==='/socket' && request.method==='GET'){
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'websocket_required'},426);
      if(request.headers.get('Origin')!==url.origin)return json({error:'origin'},403);
      const s=this.session,protocols=(request.headers.get('Sec-WebSocket-Protocol')??'').split(',').map(x=>x.trim());
      if(!s || Date.now()>=s.expiresAt || s.opened || !protocols.includes('bx.'+s.ticket) || !protocols.includes('binary'))return json({error:'unauthorized'},401);
      const pair=new WebSocketPair(),client=pair[0],socket=pair[1];socket.binaryType='arraybuffer';socket.accept();s.socket=socket;s.opened=true;
      socket.addEventListener('message',event=>{if(this.session!==s)return;try{if(!(event.data instanceof ArrayBuffer))throw new Error('binary_required');s.exchange.enqueue(event.data);this.touch(s);
        // Opt-in v13 downlink: do not wait for the next console poll/ACK.
        if(this.consolePush&&this.consoleEpoch===s.epoch&&this.consoleSocket?.readyState===1){
          if((this.consoleSocket.bufferedAmount??0)>MAX_SOCKET_BUFFER)throw new Error('queue_limit');
          this.consoleSocket.send(frame(s.epoch,0,s.exchange.takeQueued()));
        }}catch(error){const reason=['binary_required','bad_packet','queue_limit'].includes(error.message)?error.message:'invalid_message';this.close(reason);}});
      socket.addEventListener('close',()=>{if(this.session===s)this.close('socket_closed');});socket.addEventListener('error',()=>{if(this.session===s)this.close('socket_error');});
      return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'binary'}});
    }
    return json({error:'not_found'},404);
  }
}
export default {
  async fetch(request,env){const url=new URL(request.url);
    if(url.protocol!=='https:' || url.search || url.hash)return json({error:'forbidden'},403);
    if(['/session','/session-status','/exchange','/socket','/console-stream','/direct-status','/direct-offer','/direct-poll','/direct-answer','/direct-result'].includes(url.pathname)){
      const origin=request.headers.get('Origin');if(origin && origin!==url.origin)return json({error:'origin'},403);
      if(!env.NATIVE_ROOM || !env.BX_PLAYER_KEY || !env.BX_CONSOLE_KEY)return json({error:'not_configured'},503);
      // Opt-in regional backend: all transport endpoints move together. Static
      // assets and the existing DO path remain unchanged unless configured.
      if(env.BX_REGIONAL_ORIGIN){
        let regional;try{regional=new URL(env.BX_REGIONAL_ORIGIN);}catch{return json({error:'invalid_regional_backend'},503);}
        if(regional.protocol!=='https:'||regional.origin!==env.BX_REGIONAL_ORIGIN||regional.origin===url.origin)return json({error:'invalid_regional_backend'},503);
        const destination=new URL(url.pathname,regional);
        return fetch(new Request(destination,request),{redirect:'manual'});
      }
      return env.NATIVE_ROOM.get(env.NATIVE_ROOM.idFromName('owner-console')).fetch(request);
    }
    if(url.pathname==='/health')return json({transport:'experimental',physicalValidation:false,sessionRequired:true});
    let response;
    if(env.ASSETS)response=await env.ASSETS.fetch(request);
    else if(url.pathname==='/chiaki-corresponding-source.tar.gz' && SOURCE_URL)response=Response.redirect(SOURCE_URL,302);
    else {const asset=ASSETS[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return json({error:'client_not_deployed'},503);const data=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));response=new Response(data,{headers:{'Content-Type':asset.type,'Cache-Control':'no-store'}});}
    const headers=new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy','same-origin');headers.set('Cross-Origin-Embedder-Policy','require-corp');headers.set('Cross-Origin-Resource-Policy','same-origin');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');
    return new Response(response.body,{status:response.status,headers});
  }
};
