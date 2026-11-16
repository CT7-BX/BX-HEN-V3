import test from "node:test";
import assert from "node:assert/strict";
import worker, { BXPairingRoom } from "../pairing-worker.mjs";

const SITE = "https://ct7-bx.github.io";
const TOKEN = "a".repeat(64);
const base = "https://bx-remote-link.example.workers.dev";

function instance() {
  const entries = new Map();
  const storage = {
    get: key => Promise.resolve(entries.get(key)),
    put: (key, value) => { entries.set(key, structuredClone(value)); return Promise.resolve(); },
    delete: key => { entries.delete(key); return Promise.resolve(true); }
  };
  const env = { BX_RELAY_CONSOLE_TOKEN: TOKEN };
  const namespace = {
    idFromName: name => name,
    get: () => ({ fetch: request => room.fetch(request) })
  };
  let room = new BXPairingRoom({ storage }, env);
  env.PAIRING_ROOM = namespace;
  return {
    env,
    storage,
    restart() { room = new BXPairingRoom({ storage }, env); }
  };
}
async function call(env, path, { method = "GET", body, token, origin = SITE, ip = "203.0.113.10" } = {}) {
  const req = new Request(base + path, {
    method,
    headers: {
      ...(origin ? { origin } : {}),
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      "CF-Connecting-IP": ip
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const response = await worker.fetch(req, env);
  const json = await response.json();
  return { status: response.status, json, headers: response.headers };
}
const post = (env, path, body, token, others = {}) =>
  call(env, path, { method: "POST", body, token, ...others });

test("healthy public endpoint describes real limits and protects origin", async () => {
  const { env } = instance();
  const good = await call(env, "/health");
  assert.equal(good.status, 200);
  assert.equal(good.headers.get("access-control-allow-origin"), SITE);
  assert.equal(good.json.pairing, true);
  assert.equal(good.json.configured, true);
  assert.equal(good.json.video, false);
  assert.equal(good.json.ps4Control, false);
  assert.equal(good.json.mode, "control-prototype");
  const rejected = await call(env, "/health", { origin: "https://evil.example" });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("access-control-allow-origin"), null);
  const leakage = await call(env, "/health?token=do-not-log");
  assert.equal(leakage.status, 403);
});

test("unconfigured worker fails closed but can report its public status", async () => {
  const { env } = instance();
  delete env.BX_RELAY_CONSOLE_TOKEN;
  const health = await call(env, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.json.configured, false);
  const request = await post(env, "/v1/pair/heartbeat", {}, TOKEN);
  assert.equal(request.status, 503);
  assert.equal(request.json.error, "BACKEND_NOT_CONFIGURED");
  const claim = await post(env, "/v1/pair/claim", { code: "00000000" });
  assert.equal(claim.status, 503, "Public claims must not look usable without a PS4 secret");
  assert.equal(claim.json.error, "BACKEND_NOT_CONFIGURED");
});

test("PS4 HTTP pair is online only with authenticated heartbeat", async () => {
  const { env } = instance();
  assert.equal((await post(env, "/v1/pair/start", {}, TOKEN)).status, 409);
  assert.equal((await post(env, "/v1/pair/heartbeat", {}, "invalid")).status, 401);
  assert.equal((await post(env, "/v1/pair/heartbeat", {}, TOKEN)).status, 200);
  const started = await post(env, "/v1/pair/start", {}, TOKEN);
  assert.equal(started.status, 200);
  assert.match(started.json.code, /^\d{8}$/);
  assert.match(started.json.requestId, /^[a-f0-9]{64}$/);
  assert.equal(started.headers.get("cache-control"), "no-store, private");
});

test("one-time code requires console approval and returns status without controls", async () => {
  const state = instance();
  const { env } = state;
  await post(env, "/v1/pair/heartbeat", {}, TOKEN);
  const started = (await post(env, "/v1/pair/start", {}, TOKEN)).json;
  assert.equal((await post(env, "/v1/pair/claim", { code: "000" })).status, 400);
  const claim = await post(env, "/v1/pair/claim", { code: started.code });
  assert.equal(claim.status, 200);
  assert.match(claim.json.claimToken, /^[a-f0-9]{64}$/);
  assert.equal((await post(env, "/v1/pair/claim", { code: started.code })).status, 400);
  const pending = await call(env, "/v1/pair/pending", { token: TOKEN });
  assert.equal(pending.json.status, "pending_confirmation");
  assert.match(pending.json.claimId, /^[a-f0-9]{64}$/);
  const waiting = await call(env, "/v1/pair/status", { token: claim.json.claimToken });
  assert.equal(waiting.json.status, "pending_confirmation");
  const deniedBad = await post(env, "/v1/pair/decide", {
    requestId: started.requestId, claimId: "invalid", allow: true
  }, TOKEN);
  assert.equal(deniedBad.status, 409);
  state.restart(); // durable storage survives simulated Worker eviction
  const approved = await post(env, "/v1/pair/decide", {
    requestId: started.requestId, claimId: pending.json.claimId, allow: true
  }, TOKEN);
  assert.equal(approved.status, 200);
  const status = await call(env, "/v1/pair/status", { token: claim.json.claimToken });
  assert.deepEqual(status.json, { status: "approved", controlAvailable: false });
  assert.equal(status.json.playerToken, undefined);
  assert.equal((await post(env, "/v1/pair/revoke", {}, TOKEN)).status, 200);
  assert.equal((await call(env, "/v1/pair/status", { token: claim.json.claimToken })).status, 401);
});

test("disallowed requests, oversized body and unknown paths fail closed", async () => {
  const { env } = instance();
  const plainHttp = await worker.fetch(new Request(
    "http://bx-remote-link.example.workers.dev/health", {
      headers: { origin: SITE }
    }), env);
  assert.equal(plainHttp.status, 403, "Never accept bearer flows over unencrypted HTTP");
  const response = await worker.fetch(new Request(base + "/v1/pair/heartbeat", {
    method: "POST",
    headers: { origin: SITE, authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ anything: "x".repeat(1100) })
  }), env);
  assert.equal(response.status, 413);
  assert.equal((await post(env, "/v1/pair/heartbeat", {}, TOKEN, { origin: "https://bad.example" })).status, 403);
  assert.equal((await call(env, "/v1/link")).status, 501);
  assert.equal((await call(env, "/not-found")).status, 404);
  const preflight = await worker.fetch(new Request(base + "/v1/pair/claim", {
    method: "OPTIONS", headers: { origin: SITE }
  }), env);
  assert.equal(preflight.status, 204);
});

test("eight attempts per IP per minute are allowed, ninth is throttled", async () => {
  const { env } = instance();
  for (let i = 0; i < 8; i++) {
    const response = await post(env, "/v1/pair/claim", { code: "00000000" });
    assert.equal(response.status, 400);
  }
  const rejected = await post(env, "/v1/pair/claim", { code: "00000000" });
  assert.equal(rejected.status, 429);
});
