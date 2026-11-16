const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { TITLE_ID, expectedDownloadUrl, parseManifest, fetchManifest } = require("../pkg-updates.js");

const version = "0.19";
const sha = "ae898bf2ae5c380ce1882e72be3de8f2f50ebf1006a1c18e9d83d029e817b33b";
const release = expectedDownloadUrl(version);
const valid = ["title_id=BRPM00001", "version=" + version, "sha256=" + sha, "pkg_url=" + release, ""].join("\n");

test("only official BX native PKG release metadata is accepted", () => {
  assert.equal(TITLE_ID, "BRPM00001");
  const result = parseManifest(valid);
  assert.equal(result.titleId, "BRPM00001");
  assert.equal(result.version, "0.19");
  assert.equal(result.sha256, sha);
  assert.equal(result.downloadUrl, release);
  assert.equal(result.releaseUrl,
    "https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/tag/pair-test-v0.19");
  assert.equal(Object.isFrozen(result), true);
});

test("manifest keys may be reordered but duplicate/unknown keys or unsafe URLs fail closed", () => {
  assert.equal(parseManifest(valid.split("\n").reverse().join("\n")).version, version);
  for (const changed of [
    valid.replace("BRPM00001", "OTHER00001"),
    valid.replace(sha, "0".repeat(63)),
    valid.replace(sha, "0".repeat(64) + "\nsha256=" + sha),
    valid.replace("version=0.19", "version=0.19\nadmin_token=secret"),
    valid.replace("version=0.19", "version=0.19\nversion=0.19"),
    valid.replace(release, "https://example.org/latest.pkg"),
    valid.replace(release, "http://github.com/malicious/latest.pkg"),
    valid.replace(release, "https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/pair-test-v0.19/OTHER.pkg"),
    valid.replace("version=0.19", "version=0.18"),
    "a".repeat(2049)
  ]) {
    assert.throws(() => parseManifest(changed), /manifest_invalid/);
  }
});

test("public metadata fetch is same-origin, cannot send private pairing secrets", async () => {
  const calls = [];
  const info = await fetchManifest(async (url, options) => {
    calls.push([url, options]);
    return { status: 200, text: async () => valid };
  });
  assert.equal(info.version, version);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "./update.txt");
  assert.equal(calls[0][1].mode, "same-origin");
  assert.equal(calls[0][1].credentials, "omit");
  assert.equal(calls[0][1].cache, "no-store");
  assert.equal(calls[0][1].redirect, "error");
  assert.equal(calls[0][1].method, "GET");
  assert.equal("headers" in calls[0][1], false);
  await assert.rejects(fetchManifest(async () => ({status:404, text:async()=>valid})),
    /manifest_http/);
  await assert.rejects(fetchManifest(async () => {throw new Error("network");}),
    /manifest_network/);
});

test("website offers only version check and file download, never fake remote installation", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "pkg-updates.js"), "utf8");
  const pages = fs.readFileSync(path.resolve(root, "../.github/scripts/build-pages.sh"), "utf8");
  for (const id of [
    "pkgUpdatesSection", "pkgUpdateCheck", "pkgUpdateStatus",
    "pkgLatestVersion", "pkgLatestSHA", "pkgUpdateDownload", "pkgUpdateRelease"
  ]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /src="\.\/pkg-updates\.js\?v=0\.21"/);
  assert.match(html, /não pode instalar remotamente no PS4/);
  assert.match(html, /Package Installer do GoldHEN/);
  assert.match(script, /Object\.prototype\.hasOwnProperty/);
  assert.doesNotMatch(script, /\/v1\/pair\/|console_token|localStorage|sessionStorage/);
  for (const asset of ["pkg-updates.js", "media-controls.js", "media-whep.js"])
    assert.ok(pages.includes("  " + asset + "\n"), asset + " must be shipped on Pages");
});
