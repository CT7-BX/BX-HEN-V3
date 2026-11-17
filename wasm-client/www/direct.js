/* Free experimental LAN route. HTTPS carries SDP only; socket bytes use DTLS.
 * A WebSocket-compatible facade lets the existing Chiaki WASM stay unchanged.
 * No third-party STUN/TURN or paid relay is used by this LAN mode.
 */
(function(root){
 'use strict';const NativeSocket=root.WebSocket;let options=null,current=null;
 class PeerSocket{
  constructor(url){this.url=String(url);this.readyState=0;this.binaryType='arraybuffer';this.protocol='binary';this.extensions='';this.listeners=new Map();this.controller=new AbortController();this.key=options?.key;this.rttMs=null;this.sequence=0;this.pings=new Map();this.timer=null;current=this;this.open().catch(()=>{if(this.readyState!==3){this.dispatch('error');this.close(4000,'direct_connection_failed');}});}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  dispatch(name,detail={}){const e={type:name,target:this,currentTarget:this,...detail};this['on'+name]?.(e);for(const fn of this.listeners.get(name)??[])fn(e);}
  get bufferedAmount(){return this.channel?.bufferedAmount??0;}
  async request(path,body){const r=await fetch(path,{method:'POST',headers:{Authorization:'Bearer '+this.key},body,cache:'no-store',signal:this.controller.signal});if(!r.ok)throw new Error('direct_signaling_failed');return r.json();}
  async open(){
   if(!options||typeof root.RTCPeerConnection!=='function')throw new Error('direct_unavailable');
   this.peer=new root.RTCPeerConnection({iceServers:[]});this.channel=this.peer.createDataChannel('bx-native',{negotiated:true,id:0,ordered:true});this.channel.binaryType='arraybuffer';
   this.channel.onmessage=e=>{const b=new Uint8Array(e.data);if(b.length===8&&b[0]===66&&b[1]===88&&b[2]===80&&b[3]===49){const seq=new DataView(b.buffer).getUint32(4,true),sent=this.pings.get(seq);if(sent!==undefined){this.rttMs=Math.round(performance.now()-sent);this.pings.delete(seq);}return;}this.dispatch('message',{data:e.data});};
   this.channel.onopen=()=>{if(this.readyState===3)return;this.readyState=1;clearTimeout(this.setupTimer);this.dispatch('open');this.ping();this.timer=setInterval(()=>this.ping(),2000);};
   this.channel.onclose=()=>this.close(1000,'direct_closed');this.channel.onerror=()=>this.close(4000,'direct_channel_error');
   this.peer.onconnectionstatechange=()=>{if(['failed','closed'].includes(this.peer.connectionState))this.close(4000,'direct_path_lost');};
   this.setupTimer=setTimeout(()=>this.close(4000,'direct_setup_timeout'),20000);
   try{
    await this.peer.setLocalDescription(await this.peer.createOffer());
    await new Promise((resolve,reject)=>{if(this.controller.signal.aborted){reject(new Error('cancelled'));return;}if(this.peer.iceGatheringState==='complete'){resolve();return;}const stop=()=>reject(new Error('cancelled'));this.controller.signal.addEventListener('abort',stop,{once:true});this.peer.onicegatheringstatechange=()=>{if(this.peer.iceGatheringState==='complete'){this.controller.signal.removeEventListener('abort',stop);resolve();}};});
    const {id}=await this.request('/direct-offer',this.peer.localDescription.sdp);if(!/^[a-f0-9]{64}$/.test(id))throw new Error('invalid_offer_id');
    while(this.readyState!==3){const response=await this.request('/direct-result',id);if(response.ready){await this.peer.setRemoteDescription({type:'answer',sdp:response.answer});return;}await new Promise(resolve=>setTimeout(resolve,200));}
   }finally{if(this.readyState===3)clearTimeout(this.setupTimer);}
  }
  ping(){if(this.readyState!==1)return;if(this.pings.size>=4){this.close(4000,'direct_ping_timeout');return;}const b=new Uint8Array(8);b.set([66,88,80,49]);new DataView(b.buffer).setUint32(4,++this.sequence,true);this.pings.set(this.sequence,performance.now());try{this.channel.send(b);}catch{this.close(4000,'direct_channel_error');}}
  send(data){if(this.readyState!==1)throw new Error('direct_not_open');const n=data.byteLength;if(!Number.isInteger(n)||n<1||n>65535||this.bufferedAmount>256*1024){this.close(4000,'direct_backpressure');throw new Error('direct_buffer_limit');}this.channel.send(data);}
  close(code=1000,reason=''){if(this.readyState===3)return;this.readyState=3;clearInterval(this.timer);clearTimeout(this.setupTimer);this.controller.abort();try{this.channel?.close();}catch{}try{this.peer?.close();}catch{}this.pings.clear();this.dispatch('close',{code,reason,wasClean:code===1000});}
 }
 function Socket(url,protocols){const parsed=new URL(url,root.location?.href);if(parsed.origin==='wss://'+root.location.host&&parsed.pathname==='/rtc-socket'&&!parsed.search)return new PeerSocket(url);return new NativeSocket(url,protocols);}
 if(NativeSocket){Socket.prototype=NativeSocket.prototype;for(const [key,value]of Object.entries({CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3}))Socket[key]=value;root.WebSocket=Socket;}
 root.BXDirectTransport=Object.freeze({configure(key){if(!/^[a-f0-9]{64}$/.test(key))throw new Error('invalid_player_key');current?.close();options={key};},clear(){current?.close();options=null;},active(){return current?.readyState===1;},stats(){return current?.readyState===1?{rttMs:current.rttMs,bufferedBytes:current.bufferedAmount}:null;}});
})(globalThis);
