const test = require("node:test");
const assert = require("node:assert/strict");
const game = require("../game-core.js");

test("touch controls appear automatically on phones without a physical gamepad", () => {
  assert.equal(game.showTouch("auto", true, false), true);
  assert.equal(game.showTouch("auto", true, true), false);
  assert.equal(game.showTouch("auto", false, false), false);
  assert.equal(game.showTouch("touch", false, true), true);
  assert.equal(game.showTouch("off", true, false), false);
});

test("touch control state supports simultaneous buttons, sticks and trigger pressure", () => {
  const t = game.touchState();
  t.pressed.add(0); // Cruz
  t.pressed.add(7); // R2
  t.pressed.add(12); // D-pad Up
  t.left = game.joystick(22, -39, 46);
  t.right = game.joystick(-12, 15, 46);
  const frame = game.input(null, t, "auto", true);
  assert.deepEqual(frame.buttons, [0, 7, 12]);
  assert.deepEqual(frame.triggers, [0, 1]);
  assert.ok(frame.axes[0] > 0 && frame.axes[1] < 0);
  assert.ok(frame.axes[2] < 0 && frame.axes[3] > 0);
});

test("analog joystick is clamped and has a deadzone", () => {
  assert.deepEqual(game.joystick(0, 0, 40), { x: 0, y: 0 });
  assert.deepEqual(game.joystick(100, 0, 40), { x: 1, y: 0 });
  const diagonal = game.joystick(30, 30, 30);
  assert.ok(Math.hypot(diagonal.x, diagonal.y) <= 1.01);
  assert.deepEqual(game.joystick(1, 1, 50), { x: 0, y: 0 });
});

test("physical gamepad takes priority, and touch mode is an explicit override", () => {
  const t = game.touchState();
  t.pressed.add(0);
  t.left = { x: 1, y: 1 };
  const snapshot = {
    buttons: Array.from({ length: 18 }, (_, index) => ({
      index, pressed: index === 3, value: index === 6 ? 0.34 : index === 7 ? 0.8 : 0
    })),
    axes: [-0.2, 0.1, 0.5, -1]
  };
  assert.deepEqual(game.input(snapshot, t, "auto", true), {
    buttons: [3], axes: [-0.2, 0.1, 0.5, -1], triggers: [0.34, 0.8]
  });
  assert.deepEqual(game.input(snapshot, t, "touch", true), {
    buttons: [0], axes: [1, 1, 0, 0], triggers: [0, 0]
  });
  assert.deepEqual(game.input(null, t, "off", true), game.neutral());
});

test("relay URLs reject remote unencrypted connections, secrets and unexpected paths", () => {
  assert.equal(game.validRelayEndpoint("wss://my-relay.example/v1/link"),
    "wss://my-relay.example/v1/link");
  assert.equal(game.validRelayEndpoint("ws://localhost:8765/v1/link"),
    "ws://localhost:8765/v1/link");
  assert.equal(game.validRelayEndpoint("ws://192.168.0.50:8765/v1/link"), null);
  assert.equal(game.validRelayEndpoint("http://my-relay.example/v1/link"), null);
  assert.equal(game.validRelayEndpoint("wss://my-relay.example/v1/link?token=secret"), null);
  assert.equal(game.validRelayEndpoint("wss://user:password@my-relay.example/v1/link"), null);
  assert.equal(game.validRelayEndpoint("wss://my-relay.example/admin"), null);
});

test("pairing server accepts HTTPS without claiming WebSocket control", () => {
  assert.deepEqual(game.validPairingServer("https://bx-remote-link.4rt949zpj8.workers.dev"), {
    apiBase: "https://bx-remote-link.4rt949zpj8.workers.dev",
    controlEndpoint: "wss://bx-remote-link.4rt949zpj8.workers.dev/v1/link"
  });
  assert.deepEqual(game.validPairingServer("wss://my-relay.example/v1/link"), {
    apiBase: "https://my-relay.example",
    controlEndpoint: "wss://my-relay.example/v1/link"
  });
  assert.deepEqual(game.validPairingServer("http://127.0.0.1:8765"), {
    apiBase: "http://127.0.0.1:8765",
    controlEndpoint: "ws://127.0.0.1:8765/v1/link"
  });
  assert.deepEqual(game.validPairingServer("https://my-relay.example/v1/link"), {
    apiBase: "https://my-relay.example",
    controlEndpoint: "wss://my-relay.example/v1/link"
  });
  for (const raw of [
    "http://my-relay.example", "ws://my-relay.example/v1/link",
    "https://my-relay.example/secret", "https://my-relay.example/?token=secret",
    "https://user:password@my-relay.example", "https://my-relay.example/#x",
    "javascript:alert(1)", "", "https://my-relay.example/other",
  ]) {
    assert.equal(game.validPairingServer(raw), null, raw);
  }
});

test("quality settings are target profiles, not claimed active video streams", () => {
  assert.equal(game.qualityTargets.economy.height, 540);
  assert.equal(game.qualityTargets.balanced.height, 720);
  assert.equal(game.qualityTargets.quality.height, 1080);
  assert.equal(game.median([50, 15, 30]), 30);
  assert.equal(game.median([20, 60]), 40);
  assert.equal(game.median([]), null);
});


test("numeric pairing codes may be pasted with spaces or dashes, without accepting arbitrary characters", () => {
  assert.equal(game.normalizePairingCode("12345678"), "12345678");
  assert.equal(game.normalizePairingCode("1234 5678"), "12345678");
  assert.equal(game.normalizePairingCode("1234-5678"), "12345678");
  assert.equal(game.normalizePairingCode(" 12 34 - 56 78 "), "12345678");
  for (const invalid of [
    null, 12345678, "", "1234567", "123456789", "1234a678",
    "<script>", "1234/5678", "1".repeat(33)
  ]) assert.equal(game.normalizePairingCode(invalid), null);
});
