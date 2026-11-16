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
  const windowHandlers = new Map();
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
    addEventListener(name, callback) { windowHandlers.set(name, callback); },
    dispatchEvent(event) { dispatched.push(event); }
  };
  const context = {
    window,
    document: { getElementById: id => nodes.get(id) || null },
    AbortController,
    URL,
    Date,
    setTimeout: (fn, ms) => setTimeout(fn, ms === 1250 || ms === 2500 ? 0 : ms),
    clearTimeout,
    fetch: fetchMock,
    CustomEvent: class {
      constructor(type, { detail }) { this.type = type; this.detail = detail; }
    }
  };
  vm.runInNewContext(script, context, { filename: "pair-client.js" });
  return { nodes, dispatched, windowHandlers, get: name => nodes.get(name) };
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


test("paste formatting is normalized before sending a one-time PIN", async () => {
  const calls = [];
  const b = browserWith(async (url, options) => {
    calls.push(url);
    if (url.endsWith("/v1/pair/claim")) {
      assert.equal(JSON.parse(options.body).code, "12345678");
      return jsonResponse({ claimToken: "c".repeat(64) });
    }
    if (url.endsWith("/v1/pair/status")) {
      return jsonResponse({ status: "denied" });
    }
    throw new Error("unexpected");
  });
  b.get("pairCode").value = "1234-5678";
  await b.get("pairClaim").fire("click");
  assert.equal(calls.length, 2);
  assert.match(b.get("pairStatus").textContent, /recusada pelo console/);
});

test("a claim result arriving after cancellation cannot resume polling or overwrite cancellation", async () => {
  let resolveClaim;
  const calls = [];
  const b = browserWith(async url => {
    calls.push(url);
    return await new Promise(resolve => { resolveClaim = resolve; });
  });
  const attempt = b.get("pairClaim").fire("click");
  assert.equal(calls.length, 1);
  await b.get("pairCancel").fire("click");
  resolveClaim(jsonResponse({ claimToken: "c".repeat(64) }));
  await attempt;
  assert.equal(calls.length, 1);
  assert.match(b.get("pairStatus").textContent, /cancelada neste navegador/);
  assert.equal(b.get("pairClaim").disabled, false);
});

test("opening pairing panel automatically checks health once only", async () => {
  let requests = 0;
  const b = browserWith(async (url) => {
    requests++;
    assert.match(url, /\/health$/);
    return jsonResponse({
      status: "ok", mode: "control-prototype", pairing: true,
      pairingBackend: "cloudflare-durable-object", configured: false
    });
  });
  b.get("pairSection").open = true;
  await b.get("pairSection").fire("toggle");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1);
  assert.equal(b.get("pairServerStatus").dataset.relayCheck, "unconfigured");
  await b.get("pairSection").fire("toggle");
  assert.equal(requests, 1);
});

test("malformed claim response is not used as a bearer token", async () => {
  const requests = [];
  const b = browserWith(async (url) => {
    requests.push(url);
    return jsonResponse({ claimToken: "short" });
  });
  await b.get("pairClaim").fire("click");
  assert.equal(requests.length, 1);
  assert.match(b.get("pairStatus").textContent, /novo código|expirou|revogado/i);
  assert.equal(b.get("pairClaim").disabled, false);
});

test("brief network failures retry status reads but never POST the PIN twice", async () => {
  let claims = 0;
  let polls = 0;
  const b = browserWith(async url => {
    if (url.endsWith("/v1/pair/claim")) {
      claims++;
      return jsonResponse({ claimToken: "a".repeat(64) });
    }
    if (url.endsWith("/v1/pair/status")) {
      polls++;
      if (polls <= 2) throw new TypeError("Temporary offline");
      return jsonResponse({ status: "approved", controlAvailable: false });
    }
    throw Error("unexpected");
  });
  await b.get("pairClaim").fire("click");
  assert.equal(claims, 1);
  assert.equal(polls, 3);
  assert.match(b.get("pairStatus").textContent, /Vínculo aprovado/);
  assert.equal(b.get("pairClaim").disabled, false);
});

test("three consecutive transient failures stop with visible error and free button", async () => {
  let claims = 0;
  let polls = 0;
  const b = browserWith(async url => {
    if (url.endsWith("/v1/pair/claim")) {
      claims++;
      return jsonResponse({ claimToken: "a".repeat(64) });
    }
    polls++;
    throw new TypeError("Network down");
  });
  await b.get("pairClaim").fire("click");
  assert.equal(claims, 1);
  assert.equal(polls, 3);
  assert.match(b.get("pairStatus").textContent, /Falha de conexão/);
  assert.equal(b.get("pairClaim").disabled, false);
});

test("authorization failure never retries and does not expose claimant bearer", async () => {
  let polls = 0;
  const b = browserWith(async url => {
    if (url.endsWith("/v1/pair/claim")) return jsonResponse({ claimToken: "c".repeat(64) });
    polls++;
    return jsonResponse({ error: "INVALID_CLAIM" }, 401);
  });
  await b.get("pairClaim").fire("click");
  assert.equal(polls, 1);
  assert.match(b.get("pairStatus").textContent, /expirou|revogado/);
  assert.doesNotMatch(b.get("pairStatus").textContent, /c{32}/);
});

test("Safari pagehide and BFCache pageshow clear stale disabled claim button", async () => {
  let resolveClaim;
  const b = browserWith(async () => new Promise(resolve => { resolveClaim = resolve; }));
  const pending = b.get("pairClaim").fire("click");
  assert.equal(b.get("pairClaim").disabled, true);
  b.windowHandlers.get("pagehide")();
  assert.equal(b.get("pairClaim").disabled, false);
  assert.match(b.get("pairStatus").textContent, /interrompido ao sair/);
  b.windowHandlers.get("pageshow")({ persisted: true });
  assert.equal(b.get("pairClaim").disabled, false);
  resolveClaim(jsonResponse({ claimToken: "b".repeat(64) }));
  await pending;
  assert.match(b.get("pairStatus").textContent, /interrompido ao sair/);
});
