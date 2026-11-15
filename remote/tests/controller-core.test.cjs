// Execute with: node --test remote/tests/controller-core.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../controller-core.js");

function makePad(overrides = {}) {
  return {
    id: "Wireless Controller",
    index: 0,
    mapping: "standard",
    connected: true,
    axes: [-0.09, 0.62, 0.01, -0.97],
    buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })),
    ...overrides
  };
}

test("controller module maps the 18 standard PlayStation-related buttons", () => {
  const pad = makePad();
  pad.buttons[0] = { pressed: true, value: 1 };
  pad.buttons[6] = { pressed: false, value: 0.65 };
  const snap = core.readSnapshot(pad);
  assert.equal(snap.mapping, "standard");
  assert.equal(snap.buttons.length, 18);
  assert.equal(snap.buttons[0].label, "Cruz");
  assert.equal(snap.buttons[0].pressed, true);
  assert.equal(snap.buttons[6].label, "L2");
  assert.equal(snap.buttons[6].value, 0.65);
  assert.equal(snap.buttons[12].label, "Cima");
});

test("analog axis deadzone and normalization", () => {
  const snap = core.readSnapshot(makePad());
  assert.deepEqual(snap.axes, [-0.09, 0.62, 0, -0.97]);
  assert.equal(core.normalizeAxis(2), 1);
  assert.equal(core.normalizeAxis(-2), -1);
  assert.equal(core.normalizeAxis(Number.NaN), 0);
  assert.equal(core.normalizeAxis(0.05), 0);
});

test("button values are bounded, and absent buttons remain inactive", () => {
  const pad = makePad({ buttons: [{ pressed: true, value: 42 }] });
  const snap = core.readSnapshot(pad);
  assert.equal(snap.buttons[0].value, 1);
  assert.equal(snap.buttons[1].value, 0);
  assert.equal(snap.buttons[1].pressed, false);
});

test("prefer connected standard mapped controller over disconnected pads", () => {
  const unknown = makePad({ index: 0, mapping: "", id: "Legacy" });
  const standard = makePad({ index: 1 });
  assert.equal(core.preferredGamepad([null, unknown, standard]), standard);
  assert.equal(core.preferredGamepad([unknown, null]), unknown);
  assert.equal(core.preferredGamepad([makePad({ connected: false })]), null);
});

test("missing pad and unknown mappings are handled safely", () => {
  assert.equal(core.readSnapshot(null), null);
  assert.equal(core.readSnapshot(makePad({ mapping: "" })).mapping, "unknown");
});
