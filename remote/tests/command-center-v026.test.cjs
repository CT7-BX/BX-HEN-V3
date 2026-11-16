const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cc = require("../command-center.js");

const BASE = path.resolve(__dirname, "../..");
const read = name => fs.readFileSync(path.join(BASE,name),"utf8");
const html = read("remote/index.html");
const css = read("remote/command-center.css");
const js = read("remote/command-center.js");
const gateway = read("remote/gateway.html");
const android = read("android-gateway/app/src/main/java/com/ct7bx/gateway/MainActivity.java");

test("four grounded routes have actionable destinations and honest feature availability",()=>{
  const modes=cc.ROUTES;
  assert.deepEqual(modes.map(m=>m.id),["native","android","iphone","p2p"]);
  const destinations=new Set(modes.map(x=>x.target));
  assert.equal(destinations.size,4);
  for(const data of modes){
    assert.match(data.label,/\S/);
    assert.equal(data.steps.length,4);
    assert.ok(data.steps.every(x=>typeof x==="string" && x.length>18));
    assert.ok(data.target.startsWith("#") || data.target === "./gateway.html");
    if(data.target.startsWith("#")) assert.ok(html.includes('id="'+data.target.slice(1)+'"'));
  }
  assert.match(cc.resolveRoute("native").description,/ainda não existe/);
  assert.match(cc.resolveRoute("android").description,/ainda não foi desenvolvida/);
  assert.match(cc.resolveRoute("p2p").description,/Mac ativo/);
  assert.match(cc.resolveRoute("iphone").description,/fora do BX/);
  assert.equal(cc.resolveRoute("anything").id,"native");
});

test("read-only status summary never treats Worker, P2P or WHEP as gameplay",()=>{
  const before=cc.connectionSummary({});
  assert.match(before.backend,/não verificado/);
  assert.match(before.pairing,/não vinculado/);
  assert.match(before.media,/Sem fonte/);
  assert.match(before.gameplay,/ainda não integrado/);
  const first=cc.connectionSummary({
    backendState:"ok",
    pairStatus:"Vínculo aprovado com o PS4 (HTTP). Porta testada.",
    mediaSource:"p2p",
    pkgVersion:"v0.22 (publicada no GitHub)"
  });
  assert.equal(first.backend,"Servidor HTTPS respondeu");
  assert.equal(first.pairing,"Vínculo HTTPS aprovado");
  assert.equal(first.media,"Fonte Mac P2P anexada");
  assert.equal(first.pkg,"PKG publicado: v0.22");
  assert.match(first.gameplay,/ainda não integrado/);
  const next=cc.connectionSummary({
    backendState:"failed",pairStatus:"Vínculo pendente",mediaSource:"whep",
    pkgVersion:"<script>123</script>"
  });
  assert.match(next.backend,/indisponível/);
  assert.match(next.pairing,/não vinculado/);
  assert.equal(next.media,"Fonte WHEP anexada");
  assert.equal(next.pkg,"PKG publicado: não consultada");
});

test("checklist is user-marked and private: valid totals, no automatic claimed success",()=>{
  assert.deepEqual(cc.progress([false,true,false,true],4),
    {count:2,total:4,percent:50});
  assert.deepEqual(cc.progress([true,true,true,true,true],4),
    {count:4,total:4,percent:100});
  assert.deepEqual(cc.progress([],0),{count:0,total:0,percent:0});
  assert.match(js,/checkbox\.addEventListener\("change", updateProgress\)/);
  assert.match(js,/manual\.set\(selected, readChecks\(\)\)/);
  assert.match(js,/Nunca|não são testes ou conexões comprovadas/i);
  assert.doesNotMatch(js,/localStorage|sessionStorage|console_token/);
});

test("major redesign includes accessible modes, live status, safety and iPhone mobile dock",()=>{
  for(const id of ["bxCommandCenter","bxModeOptions","bxModeTitle","bxModeState",
      "bxModeSteps","bxModeProgress","bxProgressBar","bxModeAction",
      "bxCopyChecklist","bxLiveSummary","bxGameplayWarning",
      "bxCopyStatus","bxChecklistFallback"]) {
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(html,/Interface 0\.26/);
  assert.match(html,/command-center\.css\?v=0\.26/);
  assert.match(html,/command-center\.js\?v=0\.26/);
  assert.match(html,/role="progressbar"/);
  assert.match(html,/aria-label="Navegação rápida no celular"/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/:focus-visible/);
  assert.ok(html.indexOf("command-center.js") > html.indexOf("game.js"));
  assert.match(html,/id="streamVideo"/);
  assert.match(html,/id="pairClaim"/);
  assert.match(html,/id="mediaConnect"/);
  assert.match(html,/id="p2pJoin"/);
  assert.match(html,/id="bridgeProbeRequest"/);
});

test("Android v0.3 is a redesigned read-only hardware diagnostic, not a fake streamer",()=>{
  const build=read("android-gateway/app/build.gradle");
  const manifest=read("android-gateway/app/src/main/AndroidManifest.xml");
  const ci=read(".github/workflows/android-gateway-build.yml");
  assert.match(build,/versionCode 3/);
  assert.match(build,/0\.3\.0-diagnostic/);
  assert.match(ci,/BX-Android-Gateway-Diagnostic-v0\.3/);
  assert.match(android,/startCard\("01\s+·\s+DIAGNÓSTICO LOCAL"\)/);
  assert.match(android,/startCard\("02\s+·\s+CENTRAL BX"\)/);
  assert.match(android,/startCard\("03\s+·\s+SEGURANÇA E LIMITES"\)/);
  assert.match(android,/readinessBanner\.setText\(/);
  assert.match(android,/copyButton\.setEnabled\(false\)/);
  assert.match(android,/report = result\.toString\(\)/);
  assert.doesNotMatch(manifest,/<uses-permission\b/);
  assert.doesNotMatch(android,/startForegroundService|createVirtualDisplay\(/);
  assert.match(gateway,/gateway-hero/);
  assert.match(gateway,/Voltar à central de modos do BX/);
  assert.match(gateway,/APK experimental v0\.3/);
  assert.match(gateway,/href="\.\/#bxCommandCenter"/);
});

test("strict Pages allowlist includes new frontend assets, without APK or credentials",()=>{
 const assets=read(".github/scripts/build-pages.sh");
 const actions=read(".github/workflows/pages.yml");
 for(const file of ["command-center.js","command-center.css"]){
   assert.ok(assets.includes("  "+file+"\n"),file);
   assert.ok(actions.includes("_site/remote/"+file));
 }
 assert.doesNotMatch(assets,/android-gateway\/app\/build\/outputs/);
 assert.match(js,/Nenhum PIN, token, endereço do PS4 ou credencial coletado/);
});
