const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const game = require("../game-core.js");

const script = readFileSync(resolve(__dirname, "../pair-client.js"), "utf8");

function browserWith(fetchMock, endpoint = "https://bx-remote-link.4rt949zpj8.workers.dev") {
  const nodes = new Map();
  const dispatched = [];
  for (const name of [
    "pairClaim", "pairEndpoint", "pairCode", "pairServerStatus",
    "pairStatus", "pairCheck", "pairCancel", "pairSection"
  ]) {
    nodes.set(name, {
      value: "", textContent: "", disabled: false, dataset: {},
      handlers: new Map(),
      addEventListener(name, callback) { this.handlers.set(name, callback); },
      click() { return this.fire("click"); },
      async fire(name) {
        const handler = this.handlers.get(name);
        assert.ok(handler, name + " listener");
        return await handler();
      }
    });
  }
  nodes.get("pairEndpoint").value = endpoint;
  nodes.get("pairCode").value = "12345678";
  const window = {
    BXRemoteGame: game,
    addEventListener() {},
    dispatchEvent(event) { dispatched.push(event); }
  };
  const context = {
    window,
    document: { getElementById: id => nodes.get(id) || null },
    AbortController,
    URL,
    Date,
    setTimeout,
    clearTimeout,
    fetch: fetchMock,
    CustomEvent: class {
      constructor(type, { detail }) { this.type = type; this.detail = detail; }
    }
  };
  vm.runInNewContext(script, context, { filename: "pair-client.js" });
  return { nodes, dispatched, get: name => nodes.get(name) };
}
function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return data; }
  };
}

test("HTTPS health shows that Cloudflare is online but console secret is missing", async () => {
  const requests = [];
  const b = browserWith(async (url, options) => {
    requests.push({ url, options });
    return jsonResponse({
      status: "ok", mode: "control-prototype", pairing: true,
      pairingBackend: "cloudflare-durable-object", configured: false
    });
  });
  await b.get("pairCheck").fire("click");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url,
    "https://bx-remote-link.4rt949zpj8.workers.dev/health");
  assert.equal(b.get("pairServerStatus").dataset.relayCheck, "unconfigured");
  assert.match(b.get("pairServerStatus").textContent, /chave privada/);
  assert.equal(b.get("pairCheck").disabled, false);
});

test("HTTP-only approval is reported without initiating game controls or video", async () => {
  const urls = [];
  const b = browserWith(async (url, options) => {
    urls.push(url);
    if (url.endsWith("/v1/pair/claim")) {
      assert.equal(options.method, "POST");
      assert.equal(options.credentials, "omit");
      return jsonResponse({ claimToken: "d".repeat(64), expiresInSeconds: 120 });
    }
    if (url.endsWith("/v1/pair/status")) {
      assert.equal(options.headers.authorization, "Bearer " + "d".repeat(64));
      return jsonResponse({ status: "approved", controlAvailable: false });
    }
    throw new Error("Unknown request");
  });
  await b.get("pairClaim").fire("click");
  assert.equal(urls.length, 2);
  assert.deepEqual(urls, [
    "https://bx-remote-link.4rt949zpj8.workers.dev/v1/pair/claim",
    "https://bx-remote-link.4rt949zpj8.workers.dev/v1/pair/status"
  ]);
  assert.match(b.get("pairStatus").textContent, /canal de controle nem vídeo/);
  assert.equal(b.dispatched.length, 0);
  assert.equal(b.get("pairClaim").disabled, false);
  assert.equal(b.get("pairCode").value, "");
});

test("unconfigured backend returns a friendly error, no token exposure", async () => {
  const b = browserWith(async url => {
    assert.match(url, /\/v1\/pair\/claim$/);
    return jsonResponse({ error: "BACKEND_NOT_CONFIGURED" }, 503);
  });
  await b.get("pairClaim").fire("click");
  assert.match(b.get("pairStatus").textContent, /chave privada/);
  assert.equal(b.get("pairClaim").disabled, false);
  assert.equal(b.dispatched.length, 0);
});

test("wrong URL and invalid PIN never contact any backend", async () => {
  let contacted = 0;
  const b = browserWith(async () => { contacted++; throw Error("unexpected"); },
    "http://insecure-remote.example");
  await b.get("pairClaim").fire("click");
  await b.get("pairCheck").fire("click");
  assert.equal(contacted, 0);
  assert.equal(b.get("pairServerStatus").dataset.relayCheck, "invalid");
  b.get("pairEndpoint").value = "https://my-relay.example";
  b.get("pairCode").value = "123";
  await b.get("pairClaim").fire("click");
  assert.equal(contacted, 0);
});

test("legacy WSS simulator still creates a player session after approval", async () => {
  const b = browserWith(async url => {
    if (url.endsWith("/v1/pair/claim"))
      return jsonResponse({ claimToken: "e".repeat(64) });
    if (url.endsWith("/v1/pair/status"))
      return jsonResponse({ status: "approved", controlAvailable: true,
        playerToken: "f".repeat(64) });
    throw Error("unexpected url");
  }, "wss://my-relay.example/v1/link");
  await b.get("pairClaim").fire("click");
  assert.equal(b.dispatched.length, 1);
  assert.equal(b.dispatched[0].type, "bxremote:paired");
  assert.equal(b.dispatched[0].detail.endpoint, "wss://my-relay.example/v1/link");
});
