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
  assert.match(html, /BX Dashboard v0\.25 no PS4/);
  assert.match(html, /id="pairCheck"/);
  assert.match(html, /id="pairServerStatus"/);
  assert.match(html, /value="https:\/\/bx-remote-link\.4rt949zpj8\.workers\.dev"/);
  assert.match(html, /Servidor HTTPS de vincula/);
  assert.match(html, /src="\.\/pair-client\.js(?:\?v=[\d.]+)?"/);
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

test("mobile pairing calls have bounded timeouts and cancel outstanding requests", () => {
  assert.match(pairing, /let activeClaimController = null/);
  assert.match(pairing, /function cancelActiveClaim\(\)/);
  assert.match(pairing, /setTimeout\(\(\) => controller\.abort\(\), 6500\)/);
  assert.match(pairing, /signal: controller\.signal/);
  assert.match(pairing, /window\.addEventListener\("pagehide", \(\) =>/);
  assert.match(pairing, /function stopHealthCheck\(\)/);
  assert.match(pairing, /game\.validPairingServer/);
  assert.match(pairing, /function errorMessage\(error\)/);
  assert.match(pairing, /dataset\.relayCheck = "unconfigured"/);
  assert.match(pairing, /\$\("pairSection"\)\?\.addEventListener\("toggle"/);
});

test("approved temporary pairing exposes native PS4 readiness but does not advertise media", () => {
  assert.match(pairing, /function describeNativeRemotePlayProbe\(state\)/);
  assert.match(pairing, /diag\.loopbackTcp9295 === true/);
  assert.match(pairing, /diag\.loopbackTcp9295 === false/);
  assert.match(pairing, /diag\.checkedSecondsAgo > 90/);
  assert.match(pairing, /nenhum jogo|não existe transmissão de vídeo\/áudio/);
  assert.match(html, /Comunicação independente PS4/);
  assert.match(html, /src="\.\/pair-client\.js\?v=0\.29"/);
});

test("approved pairing connects to existing relay without manual secret entry", () => {
  assert.match(game, /function connectRelay\(endpoint, token\)/);
  assert.match(game, /addEventListener\("bxremote:paired"/);
  assert.match(game, /client\.send\(JSON\.stringify\(\{ type: "hello", role: "player", token: token \}\)\)/);
  assert.match(game, /"relayToken"/);
});
