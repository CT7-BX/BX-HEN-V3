const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const app = read("android-gateway/app/src/main/java/com/ct7bx/gateway/MainActivity.java");
const manifest = read("android-gateway/app/src/main/AndroidManifest.xml");
const build = read("android-gateway/app/build.gradle");
const workflow = read(".github/workflows/android-gateway-build.yml");
const gateway = read("remote/gateway.html");
const web = read("remote/diagnostics.js");

test("Android v0.5 draws a native, accessible, modular mobile dashboard",()=>{
  assert.match(app,/ANDROID GATEWAY/);
  assert.match(app,/GradientDrawable\.Orientation\.TL_BR/);
  for(const title of ["SISTEMA E DESEMPENHO","CONECTIVIDADE HTTPS","PRÓXIMOS PASSOS"])
    assert.ok(app.includes(title),title);
  assert.match(app,/readinessBanner\.setText/);
  assert.match(app,/setTextIsSelectable\(true\)/);
  assert.match(app,/onSaveInstanceState\(Bundle outState\)/);
  assert.match(app,/copyButton\.setEnabled\(false\)/);
  assert.match(build,/versionCode 5/);
  assert.match(build,/0\.5\.0-diagnostic/);
  assert.match(workflow,/BX-Android-Gateway-Diagnostic-v0\.5/);
});

test("network health checks are user initiated, bounded, async and public only",()=>{
  const endpoint="https://bx-remote-link.4rt949zpj8.workers.dev/health";
  assert.ok(app.includes(endpoint));
  assert.ok(web.includes(endpoint));
  assert.match(app,/networkButton\.setOnClickListener\(v -> checkPublicServer\(\)\)/);
  assert.match(app,/new Thread\(\(\) -> \{/);
  assert.match(app,/setConnectTimeout\(4000\)/);
  assert.match(app,/setReadTimeout\(4000\)/);
  assert.match(app,/bytes\.size\(\) \+ n > 4096/);
  assert.match(app,/setInstanceFollowRedirects\(false\)/);
  assert.match(app,/new JSONObject/);
  assert.match(app,/json\.optBoolean\("configured", false\)/);
  assert.match(app,/if \(checkingNetwork \|\| destroyed\) return/);
  assert.match(app,/onDestroy\(\)/);
  assert.match(app,/conn\.disconnect\(\)/);
  assert.match(app,/runOnUiThread\(\(\) -> \{/);
  assert.match(app,/O PS4 NÃO foi testado./);
  assert.doesNotMatch(app,/Authorization|console_token|PSN_PASSWORD|startForegroundService|createVirtualDisplay\(/);
});

test("permissions are limited to INTERNET and no streaming or private console access",()=>{
  const matches=[...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(matches,["android.permission.INTERNET"]);
  assert.match(manifest,/usesCleartextTraffic="false"/);
  assert.doesNotMatch(app,/RECORD_AUDIO|CAMERA|ACCESS_FINE_LOCATION/);
  assert.doesNotMatch(app,/requestPermissions\(/);
  assert.match(gateway,/APK experimental v0\.5/);
  assert.match(app,/Streaming PS4 integrado ao BX: NÃO IMPLEMENTADO/);
});
