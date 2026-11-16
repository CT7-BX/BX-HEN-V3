const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const bridge = fs.readFileSync(path.join(ROOT, "bridge.html"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "site-v2.css"), "utf8");
const logic = fs.readFileSync(path.join(ROOT, "site-ui.js"), "utf8");
const native = fs.readFileSync(path.resolve(ROOT, "../native-pair/native_ui.c"), "utf8");

test("same branded theme is applied to player and Mac source page", () => {
  assert.match(html, /href="\.\/site-v2\.css\?v=0\.26"/);
  assert.match(bridge, /href="\.\/site-v2\.css\?v=0\.22"/);
  assert.match(bridge, /<body class="bridge-page">/);
  assert.match(html, /Interface 0\.26/);
  assert.match(bridge, /Imagem real/);
  assert.match(theme, /\.bx-quicknav/);
  assert.match(theme, /body\.bridge-page \.bridge-metrics/);
  assert.match(theme, /@media\(max-width:720px\)/);
  assert.match(theme, /prefers-reduced-motion/);
  assert.match(theme, /:focus-visible/);
});

test("quick actions point to existing sections, with no fake PS4 media promises", () => {
  for (const id of ["stage", "noMacPlay", "pairSection", "pkgUpdatesSection"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
    assert.match(html, new RegExp('href="#' + id + '"'));
  }
  assert.match(html, /streaming direto dos jogos ainda está em desenvolvimento/i);
  assert.match(html, /id="streamVideo"/);
  assert.match(html, /id="touchOverlay"/);
  assert.match(html, /id="bridgeProbeRequest"/);
  assert.ok(html.includes('href="./gateway.html"'));
  assert.match(html, /id="androidGatewaySection"/);
  assert.match(html, /id="mediaEndpoint"/);
  assert.match(html, /id="p2pRoomCode"/);
  assert.match(bridge, /id="startShare"/);
  assert.match(bridge, /id="stopShare"/);
  assert.match(bridge, /id="copyCode"/);
  assert.match(bridge, /id="roomCode"/);
  assert.match(native, /VERSAO 0\.22 BETA/);
  assert.match(native, /STREAMING DIRETO AINDA INDISPONIVEL/);
});

test("navigation opens closed accordions but does not mutate gamepad or transport state", () => {
  const handlers = new Map();
  const elements = new Map([
    ["pairSection", { tagName:"DETAILS", open:false, closest: () => null }],
    ["pkgUpdatesSection", { tagName:"DETAILS", open:false, closest: () => null }],
    ["stage", { tagName:"SECTION", closest: () => null }]
  ]);
  const makeLink = hash => ({
    attrs: { href: hash },
    callbacks: {},
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(event, cb) { this.callbacks[event] = cb; }
  });
  const first = makeLink("#stage");
  const second = makeLink("#pairSection");
  const third = makeLink("#pkgUpdatesSection");
  const links = [first, second, third];
  const document = {
    querySelectorAll(selector) {
      if (selector === ".bx-toplinks a") return links;
      return links;
    },
    getElementById(id) { return elements.get(id) || null; }
  };
  const window = {
    location: {hash:""},
    addEventListener(event, cb) { handlers.set(event, cb); }
  };
  vm.runInNewContext(logic, {document, window}, {filename:"site-ui.js"});
  assert.equal(elements.get("pairSection").open, false);
  second.callbacks.click();
  assert.equal(elements.get("pairSection").open, true);
  assert.equal(second.attrs["aria-current"], "location");
  assert.equal(first.attrs["aria-current"], undefined);
  window.location.hash = "#pkgUpdatesSection";
  handlers.get("hashchange")();
  assert.equal(elements.get("pkgUpdatesSection").open, true);
  assert.equal(third.attrs["aria-current"], "location");
  window.location.hash = "#invalid-not-in-document";
  handlers.get("hashchange")();
  assert.equal(elements.get("stage").tagName, "SECTION");
});
