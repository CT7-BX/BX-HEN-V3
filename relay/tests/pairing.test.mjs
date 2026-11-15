import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { createPairingStore } from "../pairing.mjs";
import { createRelay } from "../server.mjs";

const CONSOLE = "console-secret-" + "A".repeat(55);
const PLAYER = "static-lab-secret-" + "B".repeat(55);
const ORIGIN = "https://ct7-bx.github.io";

test("pairing requires code, claimant and explicit console approval", () => {
  let current = 1000;
  const pair = createPairingStore({ now: () => current });
  const { code, requestId } = pair.begin();
  assert.match(code, /^\d{8}$/);
  assert.throws(() => pair.claim("123", "local"), { code: "INVALID_CODE" });
  const { claimToken } = pair.claim(code, "local");
  assert.equal(pair.pending().status, "pending_confirmation");
  assert.equal(pair.status(claimToken).status, "pending_confirmation");
  assert.equal(pair.authorizedPlayer(claimToken), false);
  assert.throws(() => pair.decide({
    requestId: "invalid", claimId: pair.pending().claimId, allow: true
  }), { code: "NO_PENDING_CLAIM" });
  pair.decide({ requestId, claimId: pair.pending().claimId, allow: true });
  const session = pair.status(claimToken);
  assert.equal(session.status, "approved");
  assert.equal(typeof session.playerToken, "string");
  assert.ok(session.playerToken.length >= 32);
  assert.equal(pair.authorizedPlayer(session.playerToken), true);
  current += 2 * 60 * 1000 + 1;
  assert.equal(pair.authorizedPlayer(session.playerToken), true,
    "approved session lasts independently of claim lifetime");
  current += 20 * 60 * 1000;
  assert.equal(pair.authorizedPlayer(session.playerToken), false);
});

test("expired, rejected and revoked claims cannot authenticate", () => {
  let current = 1000;
  const pair = createPairingStore({ now: () => current });
  let { code } = pair.begin();
  current += 2 * 60 * 1000 + 1;
  assert.throws(() => pair.claim(code, "first"), { code: "INVALID_CODE" });
  const second = pair.begin();
  const { claimToken } = pair.claim(second.code, "first");
  pair.decide({ requestId: second.requestId, claimId: pair.pending().claimId, allow: false });
  assert.equal(pair.status(claimToken).status, "denied");
  const third = pair.begin();
  const { claimToken: nextClaim } = pair.claim(third.code, "second");
  pair.decide({ requestId: third.requestId, claimId: pair.pending().claimId, allow: true });
  const token = pair.status(nextClaim).playerToken;
  pair.revoke();
  assert.equal(pair.authorizedPlayer(token), false);
  assert.throws(() => pair.status(nextClaim), { code: "INVALID_CLAIM" });
});

test("online guessing is throttled per address", () => {
  const pair = createPairingStore();
  pair.begin();
  for (let i = 0; i < 8; i++) assert.throws(() => pair.claim("00000000", "ip-one"));
  assert.throws(() => pair.claim("00000000", "ip-one"), { code: "RATE_LIMITED" });
});

async function openSocket(url, role, token) {
  const socket = new WebSocket(url, { origin: ORIGIN });
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  const response = new Promise((resolve, reject) => {
    socket.once("message", data => resolve(JSON.parse(data.toString())));
    socket.once("error", reject);
  });
  socket.send(JSON.stringify({ type: "hello", role, token }));
  assert.ok((await response).type === "authenticated");
  return socket;
}

async function api(base, path, { token, body, origin = ORIGIN } = {}) {
  const headers = { origin };
  if (token) headers.authorization = "Bearer " + token;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, data: await response.json(), headers: response.headers };
}

test("browser claims a code, console approves, token connects to existing control relay", async t => {
  const relay = createRelay({
    consoleToken: CONSOLE, playerToken: PLAYER, allowedOrigins: [ORIGIN], port: 0
  });
  const { port } = await relay.listen();
  t.after(() => relay.close());
  const base = "http://127.0.0.1:" + port;
  const wsUrl = "ws://127.0.0.1:" + port + "/v1/link";
  const before = await api(base, "/v1/pair/start", { token: CONSOLE, body: {} });
  assert.equal(before.status, 409, "offline console must not issue codes");

  const consoleSocket = await openSocket(wsUrl, "console", CONSOLE);
  t.after(() => consoleSocket.terminate());
  const started = await api(base, "/v1/pair/start", { token: CONSOLE, body: {} });
  assert.equal(started.status, 200);
  assert.match(started.data.code, /^\d{8}$/);
  const badOrigin = await api(base, "/v1/pair/claim", {
    body: { code: started.data.code }, origin: "https://attacker.example"
  });
  assert.equal(badOrigin.status, 403);
  const claim = await api(base, "/v1/pair/claim", { body: { code: started.data.code } });
  assert.equal(claim.status, 200);
  const early = await api(base, "/v1/pair/status", { token: claim.data.claimToken });
  assert.equal(early.data.status, "pending_confirmation");
  const pending = await api(base, "/v1/pair/pending", { token: CONSOLE });
  assert.equal(pending.data.status, "pending_confirmation");
  const decision = await api(base, "/v1/pair/decide", {
    token: CONSOLE,
    body: { requestId: started.data.requestId, claimId: pending.data.claimId, allow: true }
  });
  assert.equal(decision.status, 200);
  const approved = await api(base, "/v1/pair/status", { token: claim.data.claimToken });
  assert.equal(approved.data.status, "approved");

  const playerSocket = await openSocket(wsUrl, "player", approved.data.playerToken);
  t.after(() => playerSocket.terminate());

  const forwarded = new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("Input not forwarded")), 3000);
    function read(data) {
      const frame = JSON.parse(data.toString());
      if (frame.type === "input") {
        clearTimeout(deadline);
        consoleSocket.off("message", read);
        resolve(frame);
      }
    }
    consoleSocket.on("message", read);
  });
  playerSocket.send(JSON.stringify({
    type: "input", seq: 1, buttons: [0], axes: [0, 0, 0, 0], triggers: [0, 0]
  }));
  assert.equal((await forwarded).buttons[0], 0);

  const revoked = await api(base, "/v1/pair/revoke", { token: CONSOLE, body: {} });
  assert.equal(revoked.status, 200);
  const after = await api(base, "/v1/pair/status", { token: claim.data.claimToken });
  assert.equal(after.status, 401);
});
