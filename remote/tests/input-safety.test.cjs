const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "../game.js"), "utf8");

test("touch pointer state is fully reset on blur and mode change", () => {
  assert.match(script, /const buttonPointers = new Map\(\)/);
  assert.match(script, /const resetStickPointers = \[\]/);
  assert.match(script, /buttonPointers\.forEach\(pointers => pointers\.clear\(\)\)/);
  assert.match(script, /resetStickPointers\.forEach\(reset => reset\(\)\)/);
  assert.match(script, /window\.addEventListener\("blur", resetOnBlur\)/);
});

test("relay control input sends changes promptly, but limits duplicate frames", () => {
  assert.match(script, /const signature = JSON\.stringify\(\[data\.buttons, data\.axes, data\.triggers\]\)/);
  assert.match(script, /signature === lastInputSignature && now - lastSent < 240/);
  assert.match(script, /ws\.bufferedAmount > 64 \* 1024/);
  assert.match(script, /type: "input"/);
});

test("disconnection clears cached input state before reconnecting", () => {
  assert.match(script, /lastInputSignature = ""/);
  assert.match(script, /lastSent = 0/);
  assert.match(script, /const data = forceNeutral\s*\? game\.neutral\(\)/);
});
