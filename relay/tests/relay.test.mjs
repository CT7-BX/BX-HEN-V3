import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { createRelay, safeTokenMatch } from "../server.mjs";

const CONSOLE = "demo-console-token-" + "A".repeat(45);
const PLAYER = "demo-player-token-" + "B".repeat(45);
const ORIGIN = "https://ct7-bx.github.io";

async function open(url, origin) {
  const ws = new WebSocket(url, origin ? { origin } : {});
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return ws;
}

function nextFrame(ws, type) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout waiting for: " + type));
    }, 3500);
    function cleanup() {
      clearTimeout(timeout);
      ws.off("message", onMessage);
      ws.off("close", onClose);
    }
    function onMessage(data) {
      const frame = JSON.parse(data.toString());
      if (frame.type === type) {
        cleanup();
        resolve(frame);
      }
    }
    function onClose() {
      cleanup();
      reject(new Error("Socket closed while waiting for " + type));
    }
    ws.on("message", onMessage);
    ws.once("close", onClose);
  });
}

async function authenticated(url, role, token) {
  const ws = await open(url, role === "player" ? ORIGIN : undefined);
  const ready = nextFrame(ws, "authenticated");
  ws.send(JSON.stringify({ type: "hello", role, token }));
  await ready;
  return ws;
}

async function closed(ws) {
  if (ws.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Expected rejected connection")), 3500);
    ws.once("close", () => { clearTimeout(timeout); resolve(); });
    ws.once("error", () => {}); // Close event is authoritative.
  });
}

test("constant-time comparison distinguishes credentials", () => {
  assert.equal(safeTokenMatch(CONSOLE, CONSOLE), true);
  assert.equal(safeTokenMatch(CONSOLE, PLAYER), false);
  assert.equal(safeTokenMatch(null, PLAYER), false);
});

test("server refuses missing, weak or duplicate credentials", () => {
  assert.throws(() => createRelay({ consoleToken: "short", playerToken: PLAYER }));
  assert.throws(() => createRelay({ consoleToken: CONSOLE, playerToken: CONSOLE }));
  assert.throws(() => createRelay({ consoleToken: CONSOLE, playerToken: PLAYER, host: "0.0.0.0" }));
});

test("reject unauthenticated peers and reject unrelated origins", async (t) => {
  const relay = createRelay({
    consoleToken: CONSOLE, playerToken: PLAYER,
    allowedOrigins: [ORIGIN], port: 0
  });
  const { port } = await relay.listen();
  t.after(() => relay.close());
  const url = "ws://127.0.0.1:" + port + "/v1/link";

  await assert.rejects(() => open(url, "https://untrusted.example"));
  const peer = await open(url, ORIGIN);
  const close = closed(peer);
  peer.send(JSON.stringify({ type: "hello", role: "player", token: "wrong" }));
  await close;
});

test("authenticated control frames reach only simulated console and ack returns", async (t) => {
  const relay = createRelay({
    consoleToken: CONSOLE, playerToken: PLAYER,
    allowedOrigins: [ORIGIN], port: 0
  });
  const { port } = await relay.listen();
  t.after(() => relay.close());
  const url = "ws://127.0.0.1:" + port + "/v1/link";
  const consoleWs = await authenticated(url, "console", CONSOLE);
  const playerWs = await authenticated(url, "player", PLAYER);
  t.after(() => { consoleWs.terminate(); playerWs.terminate(); });

  const expected = nextFrame(consoleWs, "input");
  playerWs.send(JSON.stringify({
    type: "input", seq: 1, buttons: [0, 4, 6], axes: [0, 0.8, -0.2, 0], triggers: [0.7, 0.2]
  }));
  const received = await expected;
  assert.deepEqual(received, {
    type: "input", seq: 1, buttons: [0, 4, 6], axes: [0, 0.8, -0.2, 0]
  });
  const ack = nextFrame(playerWs, "ack");
  consoleWs.send(JSON.stringify({ type: "ack", seq: 1 }));
  assert.deepEqual(await ack, { type: "ack", seq: 1 });

  const pong = nextFrame(playerWs, "pong");
  playerWs.send(JSON.stringify({ type: "ping", nonce: 7 }));
  assert.deepEqual(await pong, { type: "pong", nonce: 7 });

  const close = closed(playerWs);
  playerWs.send(JSON.stringify({
    type: "input", seq: 1, buttons: [0], axes: [0, 0, 0, 0], triggers: [0, 0]
  }));
  await close;
});

test("reject out-of-range analog triggers", async (t) => {
  const relay = createRelay({
    consoleToken: CONSOLE, playerToken: PLAYER, allowedOrigins: [ORIGIN], port: 0
  });
  const { port } = await relay.listen();
  t.after(() => relay.close());
  const player = await authenticated("ws://127.0.0.1:" + port + "/v1/link", "player", PLAYER);
  t.after(() => player.terminate());
  const waitClosed = closed(player);
  player.send(JSON.stringify({
    type: "input", seq: 1, buttons: [], axes: [0, 0, 0, 0], triggers: [1.3, 0]
  }));
  await waitClosed;
});

test("reject out-of-range input values rather than passing raw packets", async (t) => {
  const relay = createRelay({
    consoleToken: CONSOLE, playerToken: PLAYER, allowedOrigins: [ORIGIN], port: 0
  });
  const { port } = await relay.listen();
  t.after(() => relay.close());
  const url = "ws://127.0.0.1:" + port + "/v1/link";
  const player = await authenticated(url, "player", PLAYER);
  t.after(() => player.terminate());
  const close = closed(player);
  player.send(JSON.stringify({
    type: "input", seq: 3, buttons: [99], axes: [0, 0, 0, 0], triggers: [0, 0]
  }));
  await close;
});
