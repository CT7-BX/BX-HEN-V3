const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const base = path.resolve(__dirname, "../..");

test("the repository homepage links to the remote application", () => {
  const entry = fs.readFileSync(path.join(base, "index.html"), "utf8");
  assert.match(entry, /<title>BX-HEN Remote Play<\/title>/);
  assert.match(entry, /http-equiv="refresh" content="0; url=\.\/remote\/"/);
  assert.match(entry, /href="\.\/remote\/"/);
  assert.match(entry, /location\.replace\(new URL\("\.\/remote\/"/);
  assert.doesNotMatch(entry, /hen-start|Iniciar BX-HEN V3/);
});

test("the remote app assets stay available at the redirected path", () => {
  const app = fs.readFileSync(path.join(base, "remote/index.html"), "utf8");
  const controller = path.join(base, "remote/controller-core.js");
  assert.ok(fs.existsSync(controller));
  assert.match(app, /src="\.\/controller-core\.js"/);
  assert.match(app, /Nenhum sinal de vídeo/);
});
