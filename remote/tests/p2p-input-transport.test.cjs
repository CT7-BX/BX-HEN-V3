const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const protocol = require("../input-transport.js");
const {createBroadcast,createViewer} = require("../bridge-p2p.js");

const code = "a".repeat(64);
const offerSdp = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n";
const answerSdp = "v=0\r\no=- 2 1 IN IP4 127.0.0.1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n";
const neutral = () => ({buttons:[],axes:[0,0,0,0],triggers:[0,0]});

test("versioned bounded input frames, ACKs and strict rejection of malformed states",()=>{
  const frame=protocol.normalized({buttons:[7,0,7],axes:[0,0,0,0],triggers:[0,0]});
  assert.equal(frame,null,"Duplicate pressed buttons must be rejected");
  const payload={buttons:[7,0],axes:[0.444,0,-0.51,1],triggers:[0.9,0]};
  const raw=protocol.encode(payload,1);
  const decoded=protocol.decode(raw);
  assert.deepEqual(decoded.state.buttons,[0,7]);
  assert.deepEqual(decoded.state.axes,[0.44,0,-0.51,1]);
  assert.equal(decoded.seq,1);
  assert.equal(protocol.decodeAck(protocol.encodeAck(1)),1);
  assert.equal(protocol.decodeAck(protocol.encodeAck(5)),5);
  assert.equal(protocol.decodeAck('{"v":1,"type":"ack","seq":-1}'),null);
  for(const malformed of [
    {},{buttons:[],axes:[],triggers:[]},
    {buttons:[18],axes:[0,0,0,0],triggers:[0,0]},
    {buttons:[1,1],axes:[0,0,0,0],triggers:[0,0]},
    {buttons:[],axes:[0,2,0,0],triggers:[0,0]},
    {buttons:[],axes:[0,0,0,0],triggers:[0,Number.NaN]}
  ])assert.equal(protocol.normalized(malformed),null);
  assert.equal(protocol.decode("x".repeat(600)),null);
  assert.equal(protocol.decode(JSON.stringify({v:1,type:"shell",seq:1,...payload})),null);
  assert.equal(protocol.isNeutral(protocol.neutral()),true);
  assert.throws(()=>protocol.encode(payload,0),/Invalid/);
});

test("receiver rejects replays and neutralizes held buttons when packets stop",()=>{
  const input=[],messages=[],timers=new Map();
  let count=0;
  const receiver=protocol.createReceiver({
    onInput:(frame,info)=>input.push({frame,info}),
    onStatus:state=>messages.push(state),
    setTimeoutFn:fn=>{const key=++count;timers.set(key,fn);return key;},
    clearTimeoutFn:id=>timers.delete(id)
  });
  const pressed={buttons:[0,7],axes:[0.4,0,0,0],triggers:[0,1]};
  assert.equal(receiver.receive(protocol.encode(pressed,1)),true);
  assert.equal(receiver.receive(protocol.encode(pressed,1)),false);
  assert.equal(receiver.receive(protocol.encode(pressed,2)),true);
  assert.equal(timers.size,1);
  const clock=[...timers.values()][0];
  clock();
  assert.equal(input.length,3);
  assert.equal(protocol.isNeutral(input.at(-1).frame),true);
  assert.equal(input.at(-1).info.reason,"input_timeout");
  assert.ok(messages.includes("input_timeout"));
  receiver.stop();
  assert.equal(timers.size,0);
  assert.equal(receiver.receive(protocol.encode(pressed,3)),false);
});

class Channel {
  constructor(label){this.label=label;this.readyState="open";this.bufferedAmount=0;this.messages=[];}
  send(data){
    if(this.readyState!=="open")throw new Error("closed");
    this.messages.push(data);
    this.partner?.onmessage?.({data});
  }
  close(){
    if(this.readyState!=="open")return;
    this.readyState="closed";
    this.onclose?.();
    if(this.partner?.readyState==="open") {
      this.partner.readyState="closed";
      this.partner.onclose?.();
    }
  }
}
class Peer {
  constructor(side){this.side=side;this.iceGatheringState="complete";this.connectionState="new";}
  addTrack(track){this.tracks=(this.tracks||[]).concat(track);}
  createDataChannel(label,options){
    assert.equal(this.side,"sender");
    assert.deepEqual(options,{ordered:false,maxRetransmits:0});
    this.channel = new Channel(label);
    const remote=new Channel(label);
    this.channel.partner=remote;remote.partner=this.channel;
    this.other.pending=remote;
    return this.channel;
  }
  createOffer(){return Promise.resolve({type:"offer",sdp:offerSdp});}
  createAnswer(){return Promise.resolve({type:"answer",sdp:answerSdp});}
  async setLocalDescription(d){this.localDescription=d;}
  async setRemoteDescription(d){
    this.remoteDescription=d;
    if(this.pending)queueMicrotask(()=>this.ondatachannel?.({channel:this.pending}));
  }
  close(){this.closed=true;this.channel?.close();}
}
class Stream {
  constructor(){this.tracks=[];}
  getTracks(){return this.tracks;}
  getVideoTracks(){return this.tracks.filter(x=>x.kind==="video");}
  addTrack(t){this.tracks.push(t);}
}
test("actual WebRTC input round-trip between test peers with explicit per-packet ACK",async()=>{
  const senderPeer=new Peer("sender"),viewerPeer=new Peer("viewer");
  senderPeer.other=viewerPeer;viewerPeer.other=senderPeer;
  const track={kind:"video",id:"video-1",stop(){this.stopped=true;},addEventListener(){}};
  const stream=new Stream();stream.addTrack(track);
  let offer=null,answer=null,roomClose=null;
  const signaling={
    create:async sdp=>{offer=sdp;return {code};},
    offer:async()=>({type:"offer",sdp:offer}),
    answer:async(_code,sdp)=>{answer=sdp;return {status:"ok"};},
    poll:async()=>answer?{status:"ready",type:"answer",sdp:answer}:{status:"waiting"},
    close:async value=>{roomClose=value;}
  };
  const received=[],ack=[],senderStatus=[],viewerStatus=[];
  const broadcaster=createBroadcast({
    signaling,peerFactory:()=>senderPeer,getScreen:async()=>stream,
    inputProtocol:protocol,onInput:(f,m)=>received.push({f,m}),
    onInputStatus:s=>senderStatus.push(s),
    setDelay:()=>new Promise(resolve=>setImmediate(resolve))
  });
  const receiver=createViewer({
    signaling,peerFactory:()=>viewerPeer,streamFactory:()=>new Stream(),
    inputProtocol:protocol,onInputStatus:s=>viewerStatus.push(s),
    onInputAck:n=>ack.push(n)
  });
  assert.equal(receiver.sendInput(neutral()),false);
  const started=broadcaster.start();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(offer,offerSdp);
  assert.equal(await receiver.start(code),true);
  assert.equal(await started,true);
  assert.ok(viewerStatus.includes("channel_open"));
  const pressed={buttons:[0,6],axes:[0.55,0,0,0],triggers:[1,0]};
  assert.equal(receiver.sendInput(pressed),true);
  assert.equal(received[0].m.reason,"received");
  assert.deepEqual(received[0].f.buttons,[0,6]);
  assert.deepEqual(ack,[1]);
  assert.equal(receiver.sendInput(neutral()),true);
  assert.deepEqual(ack,[1,2]);
  assert.equal(protocol.isNeutral(received.at(-1).f),true);
  // Once viewer leaves, inputs neutralize and cannot be sent after closure.
  receiver.stop();
  assert.equal(receiver.inputConnected(),false);
  assert.equal(receiver.sendInput(pressed),false);
  broadcaster.stop();
  assert.equal(senderPeer.closed,true);
  assert.equal(track.stopped,true);
  await Promise.resolve();
  assert.equal(roomClose,code);
});

test("pages expose opt-in controls without claiming PS4 controls, and load protocol before bridge",()=>{
  const base=path.resolve(__dirname,"..");
  const page=fs.readFileSync(path.join(base,"index.html"),"utf8");
  const mac=fs.readFileSync(path.join(base,"bridge.html"),"utf8");
  const viewer=fs.readFileSync(path.join(base,"p2p-viewer.js"),"utf8");
  const source=fs.readFileSync(path.join(base,"p2p-sender.js"),"utf8");
  const pages=fs.readFileSync(path.resolve(base,"../.github/scripts/build-pages.sh"),"utf8");
  assert.ok(page.indexOf("input-transport.js")<page.indexOf("bridge-p2p.js"));
  assert.ok(mac.indexOf("input-transport.js")<mac.indexOf("bridge-p2p.js"));
  for(const id of ["p2pInputEnable","p2pInputStatus"])assert.ok(page.includes('id="'+id+'"'));
  for(const id of ["senderControlStatus","senderControlInput"])assert.ok(mac.includes('id="'+id+'"'));
  assert.match(page,/id="streamVideo"/);
  assert.match(viewer,/getInputSnapshot/);
  assert.match(viewer,/inputTimer = setInterval\(sendCurrentInput, 40\)/);
  assert.match(source,/onInput: \(frame, meta\)/);
  assert.match(mac,/não envia esses comandos ao Chiaki nem ao PS4/);
  for(const file of ["input-transport.js","bridge-p2p.js"])
    assert.ok(pages.includes("  "+file+"\n"));
});
