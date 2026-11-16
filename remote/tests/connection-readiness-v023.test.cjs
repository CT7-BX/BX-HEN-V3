const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSwitcher } = require("../media-source-core.js");
const diag = require("../diagnostics.js");
const { parseManifest, expectedDownloadUrl } = require("../pkg-updates.js");

const ROOT = path.resolve(__dirname, "..");
test("P2P and WHEP streams cannot clear one another when a new stream takes over", () => {
  const calls = [];
  let currentStream = null, switcher;
  switcher = createSwitcher({
    onAttach(stream, source) {
      currentStream = stream;
      calls.push(["attach", source]);
    },
    onPreempt(previous, next) {
      calls.push(["preempt", previous, next]);
      // Displaced WHEP receiver closes after it has lost ownership.
      assert.equal(switcher.attach(null, previous), false);
    }
  });
  const mac = { id:"mac" };
  const gateway = { id:"whep" };
  assert.equal(switcher.attach(mac, "p2p"), true);
  assert.equal(switcher.currentOwner(), "p2p");
  assert.equal(switcher.attach(gateway, "whep"), true);
  assert.equal(switcher.currentOwner(), "whep");
  assert.equal(currentStream, gateway);
  assert.deepEqual(calls, [
    ["attach", "p2p"], ["preempt", "p2p", "whep"], ["attach", "whep"]
  ]);
  assert.equal(switcher.attach(null, "p2p"), false);
  assert.equal(currentStream, gateway);
  assert.equal(switcher.attach(null, "whep"), true);
  assert.equal(switcher.currentOwner(), null);
  assert.equal(currentStream, null);
  assert.equal(switcher.attach(null, "whep"), false);
  assert.throws(() => switcher.attach({}, "unapproved"), /Unknown media source/);
  assert.throws(() => switcher.attach(undefined, "whep"), /Media stream required/);
});
test("public self-test distinguishes HTTPS, WebRTC and codec without claiming PS4 game video", () => {
  const complete = diag.assessBrowser({secure:true, webrtc:true, h264:true});
  assert.equal(complete.every(x => x.state === "ok"), true);
  const limited = diag.assessBrowser({secure:false, webrtc:false, h264:null});
  assert.equal(limited.filter(x => x.state === "unavailable").length,2);
  assert.equal(diag.assessBackend({status:"ok",mode:"control-prototype",
    pairing:true,configured:true}).state, "ok");
  assert.match(diag.assessBackend({status:"ok",mode:"control-prototype",
    pairing:true,configured:true}).message, /não confirma PS4 online/);
  assert.equal(diag.assessBackend({status:"ok",configured:false}).state,"unavailable");
  assert.equal(diag.assessMedia({video:false},null).state,"attention");
  assert.match(diag.assessMedia({video:false},"p2p").message,/Mac/);
  assert.match(diag.assessMedia({video:false},"whep").message,/WHEP/);
});
test("one-click report checks only public worker health and public pkg manifest, never PS4 tokens", async () => {
  const calls = [];
  const pkg = [
    "title_id=BRPM00001", "version=0.22",
    "sha256=" + "a".repeat(64),
    "pkg_url=" + expectedDownloadUrl("0.22"), ""
  ].join("\n");
  const fetcher = async (url, options) => {
    calls.push({url,options});
    if (url.endsWith("/health")) return {
      status:200, json:async () => ({
        status:"ok",mode:"control-prototype",pairing:true,
        configured:true,video:false
      })
    };
    if (url === "./update.txt") return {
      status:200,text:async()=>pkg
    };
    throw new Error("Unlisted URL: " + url);
  };
  const result = await diag.run({
    fetcher,secure:true,webrtc:true,h264:true,currentSource:null,
    parseManifest
  });
  assert.equal(result.length,6);
  assert.equal(result.filter(x=>x.state==="ok").length,5);
  assert.equal(result.find(x=>x.key==="media").state,"attention");
  assert.equal(calls.length,2);
  assert.equal(calls[0].url,diag.PUBLIC_HEALTH);
  assert.equal(calls[1].url,"./update.txt");
  for (const {url, options} of calls) {
    assert.equal(options.credentials,"omit");
    assert.equal(options.method,"GET");
    assert.equal(options.redirect,"error");
    assert.equal("Authorization" in (options.headers || {}),false);
    assert.equal(url.includes("?"),false);
  }
  const safe = diag.report(result);
  assert.match(safe,/não inclui PIN, token/);
  assert.match(safe,/Sem transmissão nativa PS4/);
  assert.equal(safe.includes(pkg),false);
});
test("health server unreachable and invalid published manifest show actionable failures",async()=>{
  const res = await diag.run({
    fetcher:async (url) => {
      if (url.endsWith("/health")) throw new TypeError("Private token abcde");
      return { status:200,text:async()=>"malformed manifest" };
    },
    secure:false,webrtc:false,h264:null,parseManifest
  });
  assert.equal(res.find(x=>x.key==="backend").state,"unavailable");
  assert.equal(res.find(x=>x.key==="update").state,"attention");
  assert.equal(diag.report(res).includes("abcde"),false);
});
test("site binds source manager before game.js and preserves real player controls",()=>{
  const html = fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
  const game = fs.readFileSync(path.join(ROOT,"game.js"),"utf8");
  const whep = fs.readFileSync(path.join(ROOT,"media-controls.js"),"utf8");
  const p2p = fs.readFileSync(path.join(ROOT,"p2p-viewer.js"),"utf8");
  const pages = fs.readFileSync(path.resolve(ROOT,"../.github/scripts/build-pages.sh"),"utf8");
  assert.ok(html.indexOf("media-source-core.js") < html.indexOf("game.js?v=0.27"));
  for (const id of ["runDiagnostics","copyDiagnostics","diagnosticsStatus","diagnosticsOutput",
    "streamVideo","touchOverlay","p2pJoin","mediaConnect","bridgeProbeRequest"])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(game,/BXMediaSources\?\.createSwitcher/);
  assert.match(game,/bxremote:media-preempt/);
  assert.match(whep,/attachMediaStream\(stream, "whep"\)/);
  assert.match(p2p,/attachMediaStream\(stream, "p2p"\)/);
  assert.match(whep,/previous === "whep"/);
  assert.match(p2p,/previous === "p2p"/);
  for(const file of ["media-source-core.js","diagnostics.js"])
    assert.ok(pages.includes("  "+file+"\n"));
});
