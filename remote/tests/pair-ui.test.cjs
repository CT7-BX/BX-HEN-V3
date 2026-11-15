const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const pairing = fs.readFileSync(path.join(root, "pair-client.js"), "utf8");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");

test("main screen has honest pairing entry point with consent messaging", () => {
  assert.match(html, /id="pairSection"/);
  assert.match(html, /id="pairEndpoint"/);
  assert.match(html, /id="pairCode"/);
  assert.match(html, /id="pairClaim"/);
  assert.match(html, /id="pairCancel"/);
  assert.match(html, /PS4 com o PKG Pair Test/);
  assert.match(html, /id="pairCheck"/);
  assert.match(html, /id="pairServerStatus"/);
  assert.match(html, /src="\.\/pair-client\.js"/);
});

test("pairing uses expiring claimant bearer, never URL query or persistent storage", () => {
  assert.match(pairing, /\+ "\/health"/);
  assert.match(pairing, /controller\.abort\(\)/);
  assert.match(pairing, /info\.mode !== "control-prototype"/);
  assert.match(pairing, /\/v1\/pair\/claim/);
  assert.match(pairing, /\/v1\/pair\/status/);
  assert.match(pairing, /authorization: "Bearer "/);
  assert.match(pairing, /credentials: "omit"/);
  assert.match(pairing, /cache: "no-store"/);
  assert.match(pairing, /referrerPolicy: "no-referrer"/);
  assert.match(pairing, /new CustomEvent\("bxremote:paired"/);
  assert.doesNotMatch(pairing, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(pairing, /console\.log\(.*[Tt]oken/);
});

test("approved pairing connects to existing relay without manual secret entry", () => {
  assert.match(game, /function connectRelay\(endpoint, token\)/);
  assert.match(game, /addEventListener\("bxremote:paired"/);
  assert.match(game, /client\.send\(JSON\.stringify\(\{ type: "hello", role: "player", token: token \}\)\)/);
  assert.match(game, /"relayToken"/);
});
