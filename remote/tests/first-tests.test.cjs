const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { snapshot, reportFor } = require("../first-tests.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const pairing = fs.readFileSync(path.join(root, "pair-client.js"), "utf8");

test("first-test report has only allowlisted capabilities and never exports secrets", () => {
  const secretToken = "SECRET_TOKEN_NEVER_EXPORT";
  const report = reportFor({
    siteSecure: true,
    gamepadAPI: true,
    gamepadConnected: false,
    touchAvailable: true,
    fullscreenAPI: false,
    relayStatus: "ok",
    consoleToken: secretToken,
    pairingCode: "01234567",
    relayEndpoint: "wss://private.example.org/v1/link",
    userAgent: "PRIVATE_USER_AGENT"
  }, [true, false, true, false, false]);
  assert.match(report, /Site HTTPS\/contexto seguro: SIM/);
  assert.match(report, /Teste de saude do relay: ok/);
  assert.match(report, /Video PS4 integrado: NAO/);
  assert.match(report, /Controles no PS4 integrado: NAO/);
  for (const value of [secretToken, "01234567", "private.example.org", "PRIVATE_USER_AGENT"]) {
    assert.equal(report.includes(value), false, value);
  }
});

test("unexpected relay status cannot inject arbitrary text into report", () => {
  const malicious = "wss://internal.example/?token=secret";
  const info = snapshot({ relayStatus: malicious, ps4Video: true, ps4Input: true });
  assert.equal(info.relayHealth, "not_tested");
  assert.equal(info.ps4Video, false);
  assert.equal(info.ps4Input, false);
  assert.equal(reportFor(info).includes(malicious), false);
  assert.equal(reportFor(info).includes("Video PS4 integrado: NAO"), true);
});

test("checklist is limited to five booleans and never captures user text", () => {
  const output = reportFor({}, ["TOKEN_SECRET", true, null, undefined, 1, true, false]);
  assert.match(output, /Checklist manual: NAO, SIM, NAO, NAO, NAO/);
  assert.equal(output.includes("TOKEN_SECRET"), false);
});

test("browser offers checklist, accessible status and never claims streaming", () => {
  for (const element of ["firstTestsSection", "firstTestsRun", "firstTestsCopy",
    "firstTestsReport", "firstTestsStatus"]) {
    assert.ok(html.includes('id="' + element + '"'), element);
  }
  assert.equal((html.match(/data-test-step/g) || []).length, 5);
  assert.match(html, /src="\.\/first-tests\.js"/);
  assert.match(html, /vídeo ainda não foram validados/i);
  assert.match(pairing, /dataset\.relayCheck = "ok"/);
  assert.match(pairing, /dataset\.relayCheck = "failed"/);
  assert.match(pairing, /dataset\.relayCheck = "not_tested"/);
});
