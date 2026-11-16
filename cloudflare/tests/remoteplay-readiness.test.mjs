import test from "node:test";
import assert from "node:assert/strict";
import worker, { BXPairingRoom } from "../pairing-worker.mjs";

const ORIGIN = "https://ct7-bx.github.io";
const BASE = "https://bx-remote-link.test.workers.dev";
const TOKEN = "b".repeat(64);

function setup() {
  const saved = new Map();
  const storage = {
    get: async key => structuredClone(saved.get(key)),
    put: async (key, value) => saved.set(key, structuredClone(value)),
    delete: async key => saved.delete(key)
  };
  const env = { BX_RELAY_CONSOLE_TOKEN: TOKEN };
  const room = new BXPairingRoom({ storage }, env);
  env.PAIRING_ROOM = {
    idFromName: value => value,
    get: () => ({ fetch: request => room.fetch(request) })
  };
  const call = async (path, { method = "GET", body, token, origin = ORIGIN } = {}) => {
    const response = await worker.fetch(new Request(BASE + path, {
      method,
      headers: {
        ...(origin ? { Origin: origin } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    }), env);
    return { code: response.status, json: await response.json() };
  };
  const post = (path, body, token, origin = ORIGIN) =>
    call(path, { method: "POST", body, token, origin });
  return { call, post, saved };
}

test("only PS4-authenticated native heartbeat can report local TCP readiness", async () => {
  const { post, saved, call } = setup();
  assert.equal((await post("/v1/pair/heartbeat",
    { remotePlayTcp9295: true })).code, 401);
  assert.equal((await post("/v1/pair/heartbeat",
    { remotePlayTcp9295: true }, "invalid")).code, 401);
  assert.equal((await post("/v1/pair/heartbeat",
    { remotePlayTcp9295: "true" }, TOKEN)).code, 400);
  assert.equal((await post("/v1/pair/heartbeat",
    { remotePlayTcp9295: true }, TOKEN)).code, 200);
  const diag = saved.get("native-remoteplay-probe");
  assert.equal(diag.tcp9295, true);
  assert.ok(diag.checkedAt > 0);
  const health = await call("/health");
  assert.equal(health.json.video, false);
  assert.equal(health.json.ps4Control, false);
  assert.equal(health.json.remotePlayProbe, undefined,
    "unpaired visitors must not see private console status");
  assert.equal(JSON.stringify(health.json).includes("9295"), false);
});

test("temporary approved claimant sees only recent boolean diagnostic without credentials", async () => {
  const { post, call, saved } = setup();
  await post("/v1/pair/heartbeat", { remotePlayTcp9295: false }, TOKEN);
  const started = (await post("/v1/pair/start", {}, TOKEN)).json;
  const claim = await post("/v1/pair/claim", { code: started.code });
  assert.equal(claim.code, 200);
  const pending = (await call("/v1/pair/pending", { token: TOKEN })).json;
  const initialStatus = await call("/v1/pair/status", { token: claim.json.claimToken });
  assert.equal(initialStatus.json.remotePlayProbe, undefined);
  assert.equal((await post("/v1/pair/decide", {
    requestId: started.requestId, claimId: pending.claimId, allow: true
  }, TOKEN)).code, 200);
  const approved = await call("/v1/pair/status", { token: claim.json.claimToken });
  assert.equal(approved.json.status, "approved");
  assert.equal(approved.json.controlAvailable, false);
  assert.equal(approved.json.remotePlayProbe.loopbackTcp9295, false);
  assert.ok(approved.json.remotePlayProbe.checkedSecondsAgo >= 0);
  assert.ok(approved.json.remotePlayProbe.checkedSecondsAgo < 90);
  const raw = JSON.stringify(approved.json);
  assert.equal(raw.includes(TOKEN), false);
  assert.equal(raw.includes(started.code), false);
  assert.equal(raw.includes(claim.json.claimToken), false);
  assert.equal(raw.includes("127.0.0.1"), false);

  saved.set("native-remoteplay-probe", {
    tcp9295: true, checkedAt: Date.now() - 100000
  });
  const stale = await call("/v1/pair/status", { token: claim.json.claimToken });
  assert.equal(stale.json.remotePlayProbe, undefined,
    "stale readiness must be hidden, not displayed as open");
});

test("unknown socket result is null and revocation still protects claimant", async () => {
  const { post, call } = setup();
  assert.equal((await post("/v1/pair/heartbeat",
    { remotePlayTcp9295: null }, TOKEN)).code, 200);
  const started = (await post("/v1/pair/start", {}, TOKEN)).json;
  const claim = await post("/v1/pair/claim", { code: started.code });
  const pending = (await call("/v1/pair/pending", { token: TOKEN })).json;
  await post("/v1/pair/decide", {
    requestId: started.requestId, claimId: pending.claimId, allow: true
  }, TOKEN);
  const current = await call("/v1/pair/status", { token: claim.json.claimToken });
  assert.equal(current.json.remotePlayProbe.loopbackTcp9295, null);
  await post("/v1/pair/revoke", {}, TOKEN);
  const revoked = await call("/v1/pair/status", { token: claim.json.claimToken });
  assert.equal(revoked.code, 401);
});
