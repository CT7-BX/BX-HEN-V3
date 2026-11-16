import test from "node:test";
import assert from "node:assert/strict";
import worker, { BXPairingRoom } from "../pairing-worker.mjs";

const SITE = "https://ct7-bx.github.io";
const BASE = "https://bx-remote-link.example.workers.dev";
const CONSOLE = "e".repeat(64);

function room() {
  const items = new Map();
  const storage = {
    get: async key => structuredClone(items.get(key)),
    put: async (key, value) => items.set(key, structuredClone(value)),
    delete: async key => items.delete(key)
  };
  const env = { BX_RELAY_CONSOLE_TOKEN: CONSOLE };
  const durable = new BXPairingRoom({ storage }, env);
  env.PAIRING_ROOM = {
    idFromName: name => name,
    get: () => ({ fetch: request => durable.fetch(request) })
  };
  async function call(path, { method = "GET", token, body, origin = SITE } = {}) {
    const res = await worker.fetch(new Request(BASE + path, {
      method,
      headers: {
        Origin: origin,
        ...(token ? {Authorization: "Bearer " + token} : {}),
        ...(body !== undefined ? {"Content-Type": "application/json"} : {})
      },
      ...(body === undefined ? {} : {body: JSON.stringify(body)})
    }), env);
    return {status: res.status, json: await res.json()};
  }
  const post = (path, body, token, origin = SITE) =>
    call(path, {method: "POST", body, token, origin});
  async function approved() {
    assert.equal((await post("/v1/pair/heartbeat", {}, CONSOLE)).status, 200);
    const start = await post("/v1/pair/start", {}, CONSOLE);
    assert.equal(start.status, 200);
    const claim = await post("/v1/pair/claim", {code: start.json.code});
    assert.equal(claim.status, 200);
    const pending = await call("/v1/pair/pending", {token: CONSOLE});
    assert.equal((await post("/v1/pair/decide", {
      requestId: start.json.requestId, claimId: pending.json.claimId, allow: true
    }, CONSOLE)).status, 200);
    return claim.json.claimToken;
  }
  return {items, call, post, approved};
}

test("phone-approved bridge command reaches console heartbeat, response returns to same phone",async()=>{
  const {call,post,approved} = room();
  const ticket = await approved();
  assert.equal((await post("/v1/bridge/probe", {}, ticket)).json.status, "queued");
  assert.equal((await call("/v1/bridge/probe", {token:ticket})).json.status, "queued");
  const heartbeat = await post("/v1/pair/heartbeat", {remotePlayTcp9295: null}, CONSOLE);
  assert.equal(heartbeat.status, 200);
  const id = heartbeat.json.bridgeProbeId;
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.equal((await post("/v1/bridge/probe-result", {id,tcp9295:true}, CONSOLE)).status,200);
  assert.deepEqual((await call("/v1/bridge/probe", {token:ticket})).json,
    {status:"done",tcp9295:true});
  assert.equal((await post("/v1/pair/heartbeat", {}, CONSOLE)).json.bridgeProbeId,undefined);
});

test("unapproved browsers and arbitrary commands cannot access console bridge",async()=>{
  const {call,post,approved} = room();
  assert.equal((await post("/v1/bridge/probe", {}, "a".repeat(64))).status,401);
  assert.equal((await call("/v1/bridge/probe", {token:"a".repeat(64)})).status,401);
  const ticket=await approved();
  assert.equal((await post("/v1/bridge/probe",{op:"execute",path:"/data"},ticket)).status,400);
  assert.equal((await post("/v1/bridge/probe",{},ticket,"https://evil.example")).status,403);
  assert.equal((await post("/v1/bridge/probe",{},ticket)).status,200);
  assert.equal((await post("/v1/bridge/probe",{},ticket)).status,409);
  const id = (await post("/v1/pair/heartbeat",{},CONSOLE)).json.bridgeProbeId;
  assert.equal((await post("/v1/bridge/probe-result",{id,tcp9295:true},"a".repeat(64))).status,401);
  assert.equal((await post("/v1/bridge/probe-result",{id:"a".repeat(64),tcp9295:true},CONSOLE)).status,409);
  assert.equal((await post("/v1/bridge/probe-result",{id,tcp9295:9295},CONSOLE)).status,409);
  assert.equal((await post("/v1/bridge/probe-result",{id,tcp9295:true,arbitrary:true},CONSOLE)).status,409);
  assert.equal((await post("/v1/bridge/probe-result",{id,tcp9295:false},CONSOLE)).status,200);
  assert.equal((await post("/v1/bridge/probe-result",{id,tcp9295:false},CONSOLE)).status,409);
  assert.equal((await call("/v1/bridge/probe",{token:"b".repeat(64)})).status,401);
});

test("revocation and new pairing invalidate pending commands",async()=>{
  const {call,post,approved,items} = room();
  const ticket=await approved();
  await post("/v1/bridge/probe",{},ticket);
  assert.equal(items.has("native-bridge-probe-v1"),true);
  assert.equal((await post("/v1/pair/revoke",{},CONSOLE)).status,200);
  assert.equal(items.has("native-bridge-probe-v1"),false);
  assert.equal((await call("/v1/bridge/probe",{token:ticket})).status,401);
});

test("stale command does not execute, even if console checks later",async()=>{
  const {call,post,approved,items}=room();
  const ticket=await approved();
  await post("/v1/bridge/probe",{},ticket);
  const job=items.get("native-bridge-probe-v1");
  items.set("native-bridge-probe-v1",{...job,expiresAt:Date.now()-1});
  assert.equal((await post("/v1/pair/heartbeat",{},CONSOLE)).json.bridgeProbeId,undefined);
  assert.equal((await call("/v1/bridge/probe",{token:ticket})).json.status,"idle");
});
