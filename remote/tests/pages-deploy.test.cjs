const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");

test("GitHub Pages deployment stages only the public frontend allowlist", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bx-remote-pages-"));
  try {
    const run = spawnSync("bash", [path.join(root, ".github/scripts/build-pages.sh"), dir], {
      cwd: root, encoding: "utf8"
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);

    for (const asset of [
      "index.html", ".nojekyll", "remote/index.html", "remote/game.js",
      "remote/game-core.js", "remote/controller-core.js",
      "remote/touch-layout.css", "remote/relay-lab.html",
      "remote/manifest.webmanifest", "remote/ps4-probe.txt", "remote/icon.svg"
    ]) {
      assert.equal(fs.existsSync(path.join(dir, asset)), true, asset);
    }

    for (const secretOrServer of [
      "relay/server.mjs", "relay/package.json", "ps4-agent/main.c",
      "ps4-agent/Makefile", "remote/README.md", "remote/tests",
      ".github/workflows/pages.yml", "docs/PS4-CONNECTION-AND-PKG.md"
    ]) {
      assert.equal(fs.existsSync(path.join(dir, secretOrServer)), false, secretOrServer);
    }
    assert.deepEqual(
      fs.readdirSync(path.join(dir, "remote")).sort(),
      ["controller-core.js", "game-core.js", "game.js", "icon.svg",
       "index.html", "manifest.webmanifest", "ps4-probe.txt",
       "relay-lab.html", "touch-layout.css"].sort()
    );
    const rerun = spawnSync("bash", [path.join(root, ".github/scripts/build-pages.sh"), dir], {
      cwd: root, encoding: "utf8"
    });
    assert.equal(rerun.status, 3, "stale output directory must be refused");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
