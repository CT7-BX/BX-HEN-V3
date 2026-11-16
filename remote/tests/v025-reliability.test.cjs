const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const diagnostics = require("../diagnostics.js");
const { parseManifest, expectedDownloadUrl } = require("../pkg-updates.js");

const root = path.resolve(__dirname, "../..");
const source = file => fs.readFileSync(path.join(root, file), "utf8");
const validManifest = [
  "title_id=BRPM00001", "version=0.22",
  "sha256=" + "b".repeat(64), "pkg_url=" + expectedDownloadUrl("0.22"), ""
].join("\n");

test("a stuck Worker health request does not block public PKG version check", async () => {
  const calls = [];
  let abortedHealth = 0;
  const fetcher = (url, options) => {
    calls.push({url, options});
    if (url === diagnostics.PUBLIC_HEALTH) {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          abortedHealth++;
          reject(new Error("health aborted"));
        }, {once:true});
      });
    }
    if (url === "./update.txt") {
      return Promise.resolve({status:200,text:async()=>validManifest});
    }
    throw Error("unexpected_url");
  };
  const findings = await diagnostics.run({
    fetcher, parseManifest, timeoutMs:130,
    secure:true, webrtc:true, h264:true
  });
  assert.equal(calls.length,2);
  assert.equal(calls[0].url,diagnostics.PUBLIC_HEALTH);
  assert.equal(calls[1].url,"./update.txt");
  assert.equal(abortedHealth,1);
  assert.equal(findings.find(x=>x.key==="backend").state,"unavailable");
  assert.equal(findings.find(x=>x.key==="update").state,"ok");
  for (const {options,url} of calls) {
    assert.equal(options.credentials,"omit");
    assert.equal(options.redirect,"error");
    assert.equal(options.method,"GET");
    assert.equal(String(url).includes("token="),false);
  }
});

test("manifest failure cannot incorrectly mark an available backend as broken", async()=>{
  const findings=await diagnostics.run({
    fetcher:async url => url === diagnostics.PUBLIC_HEALTH
      ? {status:200,json:async()=>({status:"ok",mode:"control-prototype",
        pairing:true,configured:true,video:false})}
      : {status:404},
    parseManifest,timeoutMs:120
  });
  assert.equal(findings.find(x=>x.key==="backend").state,"ok");
  assert.equal(findings.find(x=>x.key==="update").state,"attention");
  assert.equal(findings.find(x=>x.key==="media").state,"attention");
});

test("user cancellation aborts both network requests without exposing response data", async()=>{
  const abortController = new AbortController();
  let cancelled=0;
  const fetcher=(_url, opts)=>new Promise((_resolve,reject)=>{
    const close=()=>{cancelled++;reject(new Error("cancelled"));};
    if(opts.signal.aborted)close();
    else opts.signal.addEventListener("abort",close,{once:true});
  });
  const pending=diagnostics.run({
    fetcher, signal:abortController.signal,parseManifest,timeoutMs:3000
  });
  abortController.abort();
  const result=await pending;
  assert.equal(cancelled,2);
  assert.equal(result.find(x=>x.key==="backend").state,"unavailable");
  assert.equal(result.find(x=>x.key==="update").state,"attention");
});

test("Android v0.2 reads only on demand and keeps report through rotation",()=>{
  const java=source("android-gateway/app/src/main/java/com/ct7bx/gateway/MainActivity.java");
  const manifest=source("android-gateway/app/src/main/AndroidManifest.xml");
  const build=source("android-gateway/app/build.gradle");
  const workflow=source(".github/workflows/android-gateway-build.yml");
  assert.match(build,/versionCode 3/);
  assert.match(build,/versionName '0\.3\.0-diagnostic'/);
  assert.match(workflow,/BX-Android-Gateway-Diagnostic-v0\.3/);
  for (const marker of [
    "ACTION_BATTERY_CHANGED","BatteryManager.EXTRA_TEMPERATURE",
    "BatteryManager.EXTRA_LEVEL","memory.availMem","memory.lowMemory",
    "getCurrentThermalStatus()","onSaveInstanceState(Bundle outState)",
    "STATE_REPORT","copyButton.setEnabled(false)","copyButton.setEnabled(true)"
  ]) assert.ok(java.includes(marker),marker);
  assert.equal(/<uses-permission\b/.test(manifest),false);
  assert.equal(/startForegroundService|createVirtualDisplay\(/.test(java),false);
  assert.equal(/INTERNET|RECORD_AUDIO/.test(manifest),false);
});

test("iPhone can share the exact public Android page without any pairing data",()=>{
  const gateway=source("remote/gateway.html");
  const script=source("remote/android-readiness.js");
  const home=source("remote/index.html");
  assert.match(gateway,/id="androidShareLink"/);
  assert.match(gateway,/id="androidShareStatus"/);
  assert.match(gateway,/id="androidManualLink"/);
  assert.match(gateway,/android-readiness\.js\?v=0\.26/);
  assert.match(script,/navigator\.share\(/);
  assert.match(script,/navigator\.clipboard\.writeText\(url\)/);
  assert.match(script,/new URL\("\.\/gateway\.html", window\.location\.href\)/);
  assert.doesNotMatch(script,/localStorage|sessionStorage|Authorization/);
  assert.match(home,/Interface 0\.26/);
  assert.match(home,/diagnostics\.js\?v=0\.25/);
});
