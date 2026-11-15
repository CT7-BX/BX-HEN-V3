import test from "node:test";
import assert from "node:assert/strict";
import { createRelay } from "../server.mjs";

const ORIGIN = "https://ct7-bx.github.io";
const CONSOLE = "a".repeat(64);
const PLAYER = "b".repeat(64);

test("health endpoint is safe and CORS-readable from the configured player origin", async t => {
  const server = createRelay({
    consoleToken: CONSOLE,
    playerToken: PLAYER,
    allowedOrigins: [ORIGIN],
    port: 0
  });
  const { port } = await server.listen();
  t.after(() => server.close());
  const url = "http://127.0.0.1:" + port + "/health";
  const good = await fetch(url, { headers: { origin: ORIGIN } });
  assert.equal(good.status, 200);
  assert.equal(good.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(good.headers.get("cache-control"), "no-store");
  const body = await good.json();
  assert.deepEqual(body, {
    status: "ok",
    mode: "control-prototype",
    pairing: true,
    ps4Control: false,
    video: false
  });
  assert.doesNotMatch(JSON.stringify(body), /token|hostId|userId/i);

  const wrong = await fetch(url, {
    headers: { origin: "https://invalid.example" }
  });
  assert.equal(wrong.status, 200);
  assert.equal(wrong.headers.get("access-control-allow-origin"), null);
});
