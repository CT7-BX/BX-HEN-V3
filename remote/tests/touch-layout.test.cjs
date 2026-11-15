const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "game.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "touch-layout.css"), "utf8");

test("PS4-style touch layout is loaded from the main page", () => {
  assert.match(html, /href="\.\/touch-layout\.css"/);
  assert.match(styles, /\.virtual-pad \.face button/);
  assert.match(styles, /\.virtual-pad \.dpad button/);
  assert.match(styles, /\.virtual-pad \.stick/);
  assert.match(styles, /\.virtual-pad \.shoulders/);
  assert.match(styles, /\.virtual-pad \.central-pad/);
});

test("mobile layout supports portrait and landscape without changing the game video", () => {
  assert.match(styles, /orientation:portrait/);
  assert.match(styles, /orientation:landscape/);
  assert.match(styles, /var\(--touch-alpha\)/);
  assert.match(styles, /var\(--touch-scale\)/);
  assert.match(html, /id="streamVideo"/);
  assert.match(html, /id="touchOverlay"/);
});

test("opacity and size preferences change CSS without storing secrets", () => {
  assert.match(html, /id="touchOpacity"/);
  assert.match(html, /id="touchSize"/);
  assert.match(js, /applyTouchAppearance/);
  assert.match(js, /setProperty\("--touch-alpha"/);
  assert.match(js, /setProperty\("--touch-scale"/);
  assert.doesNotMatch(js, /localStorage|sessionStorage/);
});

test("double tap gestures enable L3 and R3 while preserving analogue movement", () => {
  assert.match(js, /side === "left" \? 10 : 11/);
  assert.match(js, /tapOrigin/);
  assert.match(js, /previousTap/);
  assert.match(js, /touch\.pressed\.add\(stickButton\)/);
  assert.match(js, /resetStick\(el\)/);
});

test("design uses original CSS rather than PlayStation copied image assets", () => {
  assert.doesNotMatch(styles, /(?:url\(|@import)/);
  assert.match(styles, /backdrop-filter/);
  assert.match(styles, /background:/);
});
