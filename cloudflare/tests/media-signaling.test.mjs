import test from "node:test";
import assert from "node:assert/strict";
import worker, { BXPairingRoom } from "../pairing-worker.mjs";

const SITE = "https://ct7-bx.github.io";
const SERVER = "https://bx-remote-link.example.workers.dev";
const OFFER = "v=0\r\no=- 123 1 IN IP4 127.0.0.1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n";
const ANSWER = "v=0\r\no=- 321 1 IN IP4 127.0.0.1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n";
function room() {
  const contents = new Map();
  const storage = {
    get: async k => contents.get(k),
    put: async (k,v) => {contents.set(k,structuredClone(v));},
    delete: async k => contents.delete(k)
  };
  let durable = new BXPairingRoom({storage}, {BX_RELAY_CONSOLE_TOKEN:"a".repeat(64)});
  const env = {
    BX_RELAY_CONSOLE_TOKEN: "a".repeat(64),
    PAIRING_ROOM: {
      idFromName: name => name,
      get: () => ({fetch: request => durable.fetch(request)})
    }
  };
  return { env, contents, restart: () => {durable=new BXPairingRoom({storage},env);} };
}
async function request(env,path,{method="GET",code,body,origin=SITE,ip="198.51.100.8"}={}) {
  const res=await worker.fetch(new Request(SERVER+path,{
    method,
    headers:{
      ...(origin?{Origin:origin}:{}),
      ...(code?{Authorization:"Bearer "+code}:{}),
      ...(body?{"Content-Type":"application/json"}:{}),
      "CF-Connecting-IP":ip
    },
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:res.status,body:await res.json(),headers:res.headers};
}
test("streaming P2P signaling never reports PS4 source nor receives media itself",async()=>{
  const {env}=room();
  const health=await request(env,"/health");
  assert.equal(health.body.video,false);
  assert.equal(health.body.ps4Control,false);
  assert.equal(health.body.mediaSignaling,true);
  const started=await request(env,"/v1/media/offer",{method:"POST",body:{type:"offer",sdp:OFFER}});
  assert.equal(started.status,200);
  assert.match(started.body.code,/^[0-9a-f]{64}$/);
  assert.equal(started.body.transport,"peer-webrtc");
  assert.equal(started.body.ps4SourceVerified,false);
  assert.equal(started.body.expiresInSeconds,180);
  const code=started.body.code;
  assert.equal((await request(env,"/v1/media/offer",{code:"0".repeat(64)})).status,401);
  const watcher=await request(env,"/v1/media/offer",{code});
  assert.deepEqual(watcher.body,{type:"offer",sdp:OFFER});
  assert.equal((await request(env,"/v1/media/offer",{code})).status,409);
  const confirmation=await request(env,"/v1/media/answer",{method:"POST",code,body:{type:"answer",sdp:ANSWER}});
  assert.equal(confirmation.status,200);
  const reply=await request(env,"/v1/media/answer",{code});
  assert.deepEqual(reply.body,{status:"ready",type:"answer",sdp:ANSWER});
  assert.equal((await request(env,"/v1/media/answer",{method:"POST",code,body:{type:"answer",sdp:ANSWER}})).status,409);
  assert.equal((await request(env,"/v1/media/close",{method:"POST",code,body:{}})).status,200);
  assert.equal((await request(env,"/v1/media/answer",{code})).status,401);
});

test("room is single-owner and safe under bad tokens, origins, private URLs and malformed SDP",async()=>{
  const {env}=room();
  assert.equal((await request(env,"/v1/media/offer",{method:"POST",origin:"https://evil.example",body:{type:"offer",sdp:OFFER}})).status,403);
  assert.equal((await request(env,"/v1/media/offer",{method:"POST",body:{type:"offer",sdp:"fake"}})).status,400);
  const created=await request(env,"/v1/media/offer",{method:"POST",body:{type:"offer",sdp:OFFER}});
  const code=created.body.code;
  assert.equal((await request(env,"/v1/media/offer",{method:"POST",body:{type:"offer",sdp:OFFER}})).status,409);
  assert.equal((await request(env,"/v1/media/answer",{method:"POST",code,body:{type:"answer",sdp:ANSWER}})).status,409);
  assert.equal((await request(env,"/v1/media/answer",{code})).body.status,"waiting");
  assert.equal((await request(env,"/v1/media/answer",{code,origin:"https://evil.example"})).status,403);
  assert.equal((await request(env,"/v1/media/answer?code="+code)).status,403);
  assert.equal((await request(env,"/v1/media/close",{method:"POST",code:"bad",body:{}})).status,401);
  assert.equal((await request(env,"/v1/media/close",{method:"POST",code,body:{}})).status,200);
});

test("room is temporary, data is stored without bearer and survives durable object eviction",async()=>{
  const {env,contents,restart}=room();
  const one=await request(env,"/v1/media/offer",{method:"POST",body:{type:"offer",sdp:OFFER}});
  assert.equal(one.status,200);
  const saved=contents.get("bx-media-signal-v1");
  assert.ok(saved);
  assert.equal(saved.hash.length,64);
  assert.notEqual(saved.hash,one.body.code);
  assert.equal(saved.code,undefined);
  assert.ok(saved.expiresAt>Date.now());
  restart();
  const found=await request(env,"/v1/media/offer",{code:one.body.code});
  assert.equal(found.status,200);
  contents.get("bx-media-signal-v1").expiresAt=Date.now()-1;
  const expired=await request(env,"/v1/media/answer",{code:one.body.code});
  assert.equal(expired.status,401);
  assert.equal(contents.has("bx-media-signal-v1"),false);
});
