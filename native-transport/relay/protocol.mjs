/* Framing for idempotent native HTTPS exchanges; opaque Remote Play packets. */
export const MAX_BATCH=256*1024;
export function frame(epoch,seq,packets=[]){
  let size=16;for(const p of packets)size+=4+p.byteLength;
  if(size>MAX_BATCH)throw new Error('batch_limit');
  const b=new Uint8Array(size),v=new DataView(b.buffer);b.set([66,88,78,49]);v.setUint32(4,epoch,true);v.setUint32(8,seq,true);v.setUint32(12,packets.length,true);
  let at=16;for(const packet of packets){v.setUint32(at,packet.byteLength,true);at+=4;b.set(new Uint8Array(packet.buffer??packet,packet.byteOffset??0,packet.byteLength),at);at+=packet.byteLength;}return b;
}
export function parse(raw){
  const b=raw instanceof Uint8Array?raw:new Uint8Array(raw);
  if(b.length<16 || b.length>MAX_BATCH || b[0]!==66||b[1]!==88||b[2]!==78||b[3]!==49)throw new Error('bad_envelope');
  const v=new DataView(b.buffer,b.byteOffset,b.byteLength),count=v.getUint32(12,true),packets=[];let at=16;
  if(count>1024)throw new Error('packet_limit');
  for(let i=0;i<count;i++){if(at+4>b.length)throw new Error('truncated');const n=v.getUint32(at,true);at+=4;if(n<28||n>65535||at+n>b.length)throw new Error('bad_packet');const p=new Uint8Array(b.subarray(at,at+n)),h=new DataView(p.buffer);if(h.getUint32(24,true)!==n-28)throw new Error('bad_packet_length');packets.push(p);at+=n;}
  if(at!==b.length)throw new Error('trailing_data');return {epoch:v.getUint32(4,true),seq:v.getUint32(8,true),packets};
}
export class Exchange {
  constructor(epoch){if(!epoch)throw new Error('bad_epoch');this.epoch=epoch;this.seq=0;this.queue=[];this.bytes=0;this.cached=null;this.previous=null;}
  enqueue(packet){const b=new Uint8Array(packet);if(b.length<28||b.length>65535||new DataView(b.buffer,b.byteOffset).getUint32(24,true)!==b.length-28)throw new Error('bad_packet');if(this.bytes+4+b.length>MAX_BATCH-16||this.queue.length>=1024)throw new Error('queue_limit');this.queue.push(b.slice());this.bytes+=4+b.length;}
  takeQueued(){const packets=this.queue;this.queue=[];this.bytes=0;return packets;}
  exchange(raw,deliver){if(this.closed)throw new Error("exchange_closed");const packet=parse(raw);if(packet.epoch!==this.epoch && !(packet.epoch===0&&packet.seq===1&&packet.packets.length===0))throw new Error('epoch_changed');
    if(packet.seq===this.seq){const old=this.previous,b=new Uint8Array(raw);if(!old||old.length!==b.length||old.some((x,i)=>x!==b[i]))throw new Error('conflicting_retry');return this.cached.slice();}
    if(packet.seq!==this.seq+1)throw new Error('sequence_gap');
    /* Validate all framing before delivering any packet. A retry reuses the
       response, so a lost HTTPS reply never replays a TCP write. */
    try{for(const p of packet.packets)deliver(p);}catch(error){this.closed=true;throw error;}
    const result=frame(this.epoch,packet.seq,this.queue);this.seq=packet.seq;this.previous=new Uint8Array(raw).slice();this.cached=result;this.queue=[];this.bytes=0;return result.slice();
  }
}
