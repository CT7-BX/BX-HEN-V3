const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assess, report } = require("../android-readiness.js");

const ROOT = path.resolve(__dirname,"../..");
const local = name => fs.readFileSync(path.join(ROOT,name), "utf8");

test("older Android 8 with 2 GB RAM gets cautious guidance, never a claim of video streaming",()=>{
  const x=assess({
    userAgent:"Mozilla/5.0 (Linux; Android 8.1.0; SM-J730F) AppleWebKit/537.36 Chrome/99.0 Mobile Safari/537.36",
    deviceMemory:2,hardwareConcurrency:4,secure:true,webRtc:true,displayMedia:false
  });
  assert.equal(x.android,true);
  assert.equal(x.version,8);
  assert.equal(x.tier,"low");
  assert.equal(x.availableMemoryGb,2);
  assert.equal(x.cpuCount,4);
  assert.equal(x.screenApi,false);
  assert.ok(x.tips.some(t=>/Android 10/.test(t)));
  assert.ok(x.tips.some(t=>/app Android/.test(t)));
  assert.ok(x.tips.some(t=>/480p/.test(t)));
  const output=report(x);
  assert.match(output,/Nenhum dado foi enviado ao servidor/);
  assert.match(output,/não verifica o modelo exato/);
  assert.ok(!output.includes("SM-J730F"),"model must not be collected from UA in browser report");
});

test("no Android version or CPU info remains unknown, not falsely declared compatible",()=>{
  const x=assess({userAgent:"Mozilla/5.0 (Linux; Android; Mobile)",secure:true});
  assert.equal(x.android,true);
  assert.equal(x.version,null);
  assert.equal(x.tier,"unknown");
  assert.equal(x.availableMemoryGb,null);
  assert.ok(x.tips.some(t=>/Sobre o telefone/.test(t)));
});

test("Android 6 is explicitly unsupported for first APK, desktop is different flow",()=>{
  const old=assess({userAgent:"Mozilla/5.0 (Linux; Android 6.0.1; Build/XYZ)"});
  assert.equal(old.tier,"unsupported");
  assert.ok(old.tips.some(t=>/Android 7/.test(t)));
  const desktop=assess({userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)"});
  assert.equal(desktop.android,false);
  assert.equal(desktop.tier,"not-android");
  assert.ok(desktop.tips.some(t=>/no Android antigo/.test(t)));
});

test("hardware values are capped and conservative; presence of screen API never equals capture",()=>{
  const x=assess({userAgent:"Android 14",deviceMemory:2048,hardwareConcurrency:500,
    webRtc:true,displayMedia:true,secure:true});
  assert.equal(x.availableMemoryGb,64);
  assert.equal(x.cpuCount,128);
  assert.ok(x.tips.some(t=>/não garante captura funcional/.test(t)));
  assert.doesNotMatch(report(x),/captura de PS4 estabelecida/i);
});

test("gateway landing page and main site link are real assets without PSN token leakage",()=>{
  const html=local("remote/index.html");
  const gateway=local("remote/gateway.html");
  const browser=local("remote/android-readiness.js");
  const scripts=local(".github/scripts/build-pages.sh");
  const manifest=local("android-gateway/app/src/main/AndroidManifest.xml");
  const android=local("android-gateway/app/src/main/java/com/ct7bx/gateway/MainActivity.java");
  assert.match(html,/href="\.\/gateway\.html"/);
  assert.match(html,/id="androidGatewaySection"/);
  assert.match(gateway,/id="androidCheck"/);
  assert.match(gateway,/id="androidOutput"/);
  assert.match(gateway,/android-readiness\.js\?v=0\.24/);
  assert.match(gateway,/ainda não foi implementada/);
  assert.doesNotMatch(browser,/localStorage|sessionStorage|Authorization|console_token|navigator\.geolocation/);
  assert.doesNotMatch(manifest,/<uses-permission\s/);
  assert.match(android,/MediaCodecList/);
  assert.match(android,/isLowRamDevice/);
  assert.match(android,/MediaProjectionManager/);
  assert.doesNotMatch(android,/startForegroundService|MediaProjection\.createVirtualDisplay|openConnection\(/);
  for(const file of ["gateway.html","android-readiness.js"])
    assert.ok(scripts.includes("  "+file+"\n"));
});
