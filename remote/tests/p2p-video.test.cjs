const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { SIGNALING_ORIGIN, validCode, validSdp, client, createBroadcast, createViewer } =
  require("../bridge-p2p.js");

const code = "a".repeat(64);
const offerSdp = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n";
const answerSdp = "v=0\r\no=- 2 1 IN IP4 127.0.0.1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n";
class FakeTrack {
  kind = "video"; id = "track-1"; stopped = false;
  addEventListener(name,fn) { if(name==="ended")this.ended=fn; }
  stop() {this.stopped=true;}
}
class FakeStream {
  constructor() {this.tracks=[];}
  getVideoTracks() {return this.tracks.filter(t=>t.kind==="video");}
  getAudioTracks() {return this.tracks.filter(t=>t.kind==="audio");}
  getTracks() {return this.tracks;}
  addTrack(t) {this.tracks.push(t);}
}
class FakePeer {
  iceGatheringState="complete";
  connectionState="new";
  closed=false;
  sent=[];
  addTrack(track) {this.sent.push(track);}
  createOffer() {return Promise.resolve({type:"offer",sdp:offerSdp});}
  createAnswer() {return Promise.resolve({type:"answer",sdp:answerSdp});}
  async setLocalDescription(d) {this.localDescription=d;}
  async setRemoteDescription(d) {this.remoteDescription=d;}
  close() {this.closed=true;}
}
test("P2P session secrets are strong and never embedded in URLs",async()=>{
  assert.equal(validCode(code.toUpperCase()),code);
  assert.equal(validCode("12345678"),null);
  assert.equal(validSdp(offerSdp),true);
  assert.equal(validSdp("fake video"),false);
  const calls=[];
  const net=client({fetcher:async(url,opts)=>{
    calls.push({url,opts});
    return {status:200,json:async()=>({code})};
  }});
  assert.equal((await net.create(offerSdp)).code,code);
  assert.equal((await net.offer(code)).code,code);
  assert.equal((await net.answer(code,answerSdp)).code,code);
  assert.equal(calls.length,3);
  for(const item of calls){
    assert.match(item.url,/^https:\/\//);
    assert.ok(item.url.startsWith(SIGNALING_ORIGIN+"/v1/media/"));
    assert.equal(item.url.includes(code),false);
    assert.equal(item.opts.credentials,"omit");
    assert.equal(item.opts.redirect,"error");
    assert.equal(item.opts.cache,"no-store");
  }
  assert.equal(calls[0].opts.method,"POST");
  assert.equal(calls[0].opts.headers.Authorization,undefined);
  assert.equal(calls[1].opts.headers.Authorization,"Bearer "+code);
  assert.equal(calls[2].opts.headers.Authorization,"Bearer "+code);
  await assert.rejects(net.offer("bad-code"),/invalid_code/);
});

test("publisher captures only when explicitly invoked; authenticates room and stops tracks",async()=>{
  const peer=new FakePeer(),track=new FakeTrack(),stream=new FakeStream();
  stream.addTrack(track);
  let captures=0, created=null, removed=null, output=null;
  const publisher=createBroadcast({
    getScreen:async()=>{captures++;return stream;},
    peerFactory:()=>peer,
    signaling:{
      create:async(sdp)=>{created=sdp;return {code};},
      poll:async()=>({status:"ready",type:"answer",sdp:answerSdp}),
      close:async(value)=>{removed=value;}
    },
    setDelay:async()=>{},
    onCode:value=>{output=value;}
  });
  assert.equal(captures,0);
  assert.equal(await publisher.start(),true);
  assert.equal(captures,1);
  assert.equal(created,offerSdp);
  assert.equal(peer.remoteDescription.type,"answer");
  assert.equal(output,code);
  publisher.stop();
  assert.equal(peer.closed,true);
  assert.equal(track.stopped,true);
  assert.equal(output,null);
  await Promise.resolve();
  assert.equal(removed,code);
});

test("viewer accepts only an authorized session offer and attaches real media tracks",async()=>{
  const peer=new FakePeer(),received=[];
  const viewer=createViewer({
    peerFactory:()=>peer,
    streamFactory:()=>new FakeStream(),
    signaling:{
      offer:async(value)=>{assert.equal(value,code);return {type:"offer",sdp:offerSdp};},
      answer:async(value,sdp)=>{assert.equal(value,code);assert.equal(sdp,answerSdp);}
    },
    onStream:stream=>received.push(stream)
  });
  assert.equal(await viewer.start(code),true);
  assert.equal(peer.remoteDescription.type,"offer");
  const t=new FakeTrack();
  peer.ontrack({track:t});
  assert.equal(received[0].getVideoTracks()[0],t);
  viewer.stop();
  assert.equal(peer.closed,true);
  assert.equal(received.at(-1),null);
});

test("both interfaces make capture and sharing restrictions explicit; no secret in URL",()=>{
  const base=path.resolve(__dirname,"..");
  const html=fs.readFileSync(path.join(base,"index.html"),"utf8");
  const sender=fs.readFileSync(path.join(base,"bridge.html"),"utf8");
  const sendScript=fs.readFileSync(path.join(base,"p2p-sender.js"),"utf8");
  const pages=fs.readFileSync(path.resolve(base,"../.github/scripts/build-pages.sh"),"utf8");
  assert.match(html,/id="p2pSection"/);
  assert.match(html,/id="p2pRoomCode"/);
  assert.match(html,/id="p2pJoin"/);
  assert.match(html,/src="\.\/bridge-p2p\.js\?v=0\.27"/);
  assert.match(html,/src="\.\/p2p-viewer\.js\?v=0\.27"/);
  assert.match(sender,/id="startShare"/);
  assert.match(sender,/id="stopShare"/);
  assert.match(sender,/id="roomCode"/);
  assert.match(sendScript,/navigator\.mediaDevices\?\.getDisplayMedia/);
  assert.match(sender,/Não selecione sua área de trabalho inteira/);
  assert.match(sender,/não dispensa o Mac/);
  for(const name of ["bridge.html","bridge-p2p.js","p2p-sender.js","p2p-viewer.js"])
    assert.ok(pages.includes("  "+name+"\n"));
});
