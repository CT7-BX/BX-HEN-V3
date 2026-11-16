const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");

const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
const script = html.match(/<script id="bx-health-check-standalone">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, "self-contained health check must be present in delivered HTML");
new vm.Script(script);

function mockPage(fetchImpl, initialEndpoint = "https://bx-remote-link.4rt949zpj8.workers.dev") {
  const elements = new Map();
  const windowHandlers = new Map();
  for (const name of ["pairCheck", "pairServerStatus", "pairEndpoint", "pairSection"]) {
    elements.set(name, {
      value: "", disabled: false, textContent: "",
      open: false, dataset: {}, handlers: new Map(),
      addEventListener(name, fn) { this.handlers.set(name, fn); },
      fire(name) { const fn = this.handlers.get(name); assert.ok(fn, name + " registered"); return fn(); }
    });
  }
  elements.get("pairCheck").textContent = "Testar servidor HTTPS";
  elements.get("pairEndpoint").value = initialEndpoint;
  const root = { addEventListener(name, fn) { windowHandlers.set(name, fn); } };
  vm.runInNewContext(script, {
    window: root,
    document: { getElementById: id => elements.get(id) || null },
    fetch: fetchImpl,
    URL,
    AbortController,
    setTimeout,
    clearTimeout
  }, { filename: "health-inline.js" });
  return { root, windowHandlers, get: id => elements.get(id) };
}

function goodHealth(configured = true) {
  return {
    ok: true, status: 200,
    async json() {
      return { status: "ok", mode: "control-prototype", pairing: true,
        pairingBackend: "cloudflare-durable-object", configured };
    }
  };
}

test("health check shows progress immediately, then clearly reports HTTPS success", async () => {
  const urls = [];
  const page = mockPage(async (url, options) => {
    urls.push(url);
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "omit");
    return goodHealth();
  });
  assert.equal(page.root.BXRemoteHealthStandalone, true);
  const pending = page.get("pairCheck").fire("click");
  assert.equal(page.get("pairServerStatus").dataset.relayCheck, "checking");
  assert.match(page.get("pairServerStatus").textContent, /Verificando HTTPS/);
  assert.equal(page.get("pairCheck").disabled, true);
  await pending;
  assert.deepEqual(urls, ["https://bx-remote-link.4rt949zpj8.workers.dev/health"]);
  assert.equal(page.get("pairServerStatus").dataset.relayCheck, "ok");
  assert.match(page.get("pairServerStatus").textContent, /não confirma que o PS4 está conectado/i);
  assert.equal(page.get("pairCheck").disabled, false);
});

test("unconfigured health responds with a visible message", async () => {
  const page = mockPage(async () => goodHealth(false));
  await page.get("pairCheck").fire("click");
  assert.equal(page.get("pairServerStatus").dataset.relayCheck, "failed");
  assert.match(page.get("pairServerStatus").textContent, /chave privada/);
});

test("WSS simulator address is not silently accepted for the HTTPS check", async () => {
  let contacted = 0;
  const page = mockPage(async () => { contacted++; return goodHealth(); },
    "wss://bx-remote-link.4rt949zpj8.workers.dev/v1/link");
  await page.get("pairCheck").fire("click");
  assert.equal(contacted, 0);
  assert.equal(page.get("pairServerStatus").dataset.relayCheck, "invalid");
  assert.match(page.get("pairServerStatus").textContent, /WSS é apenas para simulador/);
});

test("network or CORS error still reports failure and restores clickable button", async () => {
  const page = mockPage(async () => { throw new TypeError("Failed to fetch"); });
  await page.get("pairCheck").fire("click");
  assert.equal(page.get("pairServerStatus").dataset.relayCheck, "failed");
  assert.match(page.get("pairServerStatus").textContent, /diagnóstico HTTPS direto/);
  assert.equal(page.get("pairCheck").disabled, false);
  assert.match(page.get("pairCheck").textContent, /Testar servidor HTTPS/);
});

test("opening pairing section runs health exactly once", async () => {
  let calls = 0;
  const page = mockPage(async () => { calls++; return goodHealth(); });
  page.get("pairSection").open = true;
  await page.get("pairSection").fire("toggle");
  await page.get("pairSection").fire("toggle");
  assert.equal(calls, 1);
});

test("page contains direct no-token health link and cache-busted pairing script", () => {
  assert.match(html, /id="pairHealthDirect"[^>]*>Abrir diagnóstico HTTPS direto/);
  assert.match(html, /src="\.\/pair-client\.js\?v=0\.23"/);
});

test("Safari BFCache restoration repeats health check without stale disabled button", async () => {
  let requests = 0;
  const page = mockPage(async () => { requests++; return goodHealth(); });
  page.get("pairSection").open = true;
  await page.get("pairCheck").fire("click");
  assert.equal(requests, 1);
  page.windowHandlers.get("pagehide")();
  assert.equal(page.get("pairCheck").disabled, false);
  page.windowHandlers.get("pageshow")({ persisted: true });
  assert.equal(requests, 2);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.get("pairServerStatus").dataset.relayCheck, "ok");
  assert.equal(page.get("pairCheck").disabled, false);
});
