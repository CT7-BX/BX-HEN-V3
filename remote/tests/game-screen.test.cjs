const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const engine = fs.readFileSync(path.join(root, "game.js"), "utf8");

test("main screen provides physical and virtual control entry points", () => {
  assert.match(html, /id="touchMode"/);
  assert.match(html, /id="touchOverlay"/);
  assert.match(html, /id="leftStick"/);
  assert.match(html, /id="rightStick"/);
  for (const index of Array.from({ length: 18 }, (_, i) => i)) {
    assert.match(html, new RegExp('data-button="' + index + '"'));
  }
  assert.match(html, /src="\.\/game-core\.js"/);
  assert.match(html, /src="\.\/controller-core\.js"/);
  assert.match(html, /src="\.\/game\.js"/);
});

test("player has video seam and both native and CSS fullscreen controls", () => {
  assert.match(html, /id="streamVideo"/);
  assert.match(html, /autoplay playsinline/);
  assert.match(html, /id="fullscreenBtn"/);
  assert.match(html, /id="exitFullscreenInStage"/);
  assert.match(engine, /attachMediaStream/);
  assert.match(engine, /requestFullscreen/);
  assert.match(engine, /localCinema/);
  assert.match(engine, /navigator\.wakeLock/);
});

test("player clearly discloses lack of real PS4 streaming", () => {
  assert.match(html, /Nenhum sinal de vídeo/);
  assert.match(html, /PS4 não conectado/);
  assert.match(html, /console simulado/);
  assert.match(engine, /RTT relay/);
  assert.doesNotMatch(engine, /localStorage|sessionStorage/);
  assert.doesNotMatch(html, /autoplay.*https?:\/\/.*video/);
});
