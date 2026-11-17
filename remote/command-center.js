/* BX Command Center v0.26
 * Progressive enhancement; not a Remote Play implementation.
 * No credentials, pairing codes, controller state or private network access.
 * Checklists reflect user-confirmed prep only; never a connection claim.
 */
(function (root, factory) {
  "use strict";
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.BXCommandCenter = core;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const ROUTES = Object.freeze([
    Object.freeze({
      id:"native", label:"BX Native", short:"PS4 → iPhone", icon:"◇",
      state:"Em desenvolvimento", status:"planned",
      description:"Ligação direta e independente, sem Mac ou Android intermediário. O transporte real de vídeo/áudio e comandos ainda não existe.",
      steps:Object.freeze([
        "Instalar o PKG BX v0.25 no PS4 e preparar a configuração privada.",
        "Iniciar o serviço ELF residente e aprovar o vínculo HTTPS na TV.",
        "Usar Testar comunicação PS4 ↔ celular para validar somente o diagnóstico.",
        "Aguardar a implementação real do cliente Remote Play e do transporte de mídia."
      ]),action:"Abrir vínculo do PS4",target:"#pairSection",
      extra:"Vínculo aprovado não significa sessão de jogo."
    }),
    Object.freeze({
      id:"android",label:"Gateway Android",short:"PS4 → Android → iPhone",icon:"▣",
      state:"Diagnóstico disponível",status:"partial",
      description:"Avalie o Android antigo com o site e o APK local. A ponte de vídeo, áudio e comandos ainda não foi desenvolvida.",
      steps:Object.freeze([
        "Abrir a central BX no Android antigo para verificar compatibilidade básica.",
        "Executar o APK de diagnóstico v0.4, com RAM, bateria, temperatura e codecs.",
        "Confirmar se o aparelho aguenta executar um cliente Remote Play.",
        "Depois de implementado o gateway, testar streaming e comandos com supervisão."
      ]),action:"Avaliar Android",target:"./gateway.html",
      extra:"O APK atual não captura a tela nem recebe jogos."
    }),
    Object.freeze({
      id:"iphone",label:"Jogar agora",short:"PS4 → app no iPhone",icon:"▶",
      state:"Aplicativo externo",status:"external",
      description:"Use um cliente Remote Play compatível no iPhone para testar jogos sem Mac. A reprodução ocorre fora do BX.",
      steps:Object.freeze([
        "Ativar Uso remoto no PS4 e usar inicialmente a mesma rede Wi-Fi.",
        "Selecionar um cliente compatível no iPhone, como o oficial ou PXPlay.",
        "Registrar o PS4 seguindo as instruções do cliente, sem compartilhar PINs.",
        "Testar vídeo, áudio e controle no próprio aplicativo externo."
      ]),action:"Ver clientes de iPhone",target:"#noMacPlay",
      extra:"Compatibilidade com GoldHEN e firmware não garantida."
    }),
    Object.freeze({
      id:"p2p",label:"Transmissor Mac",short:"Mac → BX por WebRTC",icon:"▤",
      state:"Protótipo WebRTC",status:"experimental",
      description:"Reproduz a janela compartilhada do Chiaki usando um Mac ativo. É um teste real de recepção, não um serviço PS4 independente.",
      steps:Object.freeze([
        "Abrir Chiaki no Mac e registrar o PS4 com autorização local.",
        "Abrir o transmissor do BX no Mac e autorizar a captura da janela.",
        "Usar o código P2P privado no player do BX para receber a imagem.",
        "Testar imagem e áudio; os botões BX não controlam o jogo nesta etapa."
      ]),action:"Abrir receptor P2P",target:"#p2pSection",
      extra:"É necessário manter o Mac ligado durante o teste."
    })
  ]);
  const DEFAULT = "native";
  function resolveRoute(id) {
    return ROUTES.find(route => route.id === id) || ROUTES[0];
  }
  function connectionSummary({backendState, pairStatus, mediaSource, pkgVersion} = {}) {
    const status = backendState === "ok" ? "Servidor HTTPS respondeu" :
      backendState === "failed" ? "Servidor HTTPS indisponível" :
        "Servidor HTTPS não verificado";
    // Do not treat a simulated relay or media attachment as native PS4.
    const approved = typeof pairStatus === "string" &&
      pairStatus.startsWith("Vínculo aprovado com o PS4 (HTTP).");
    const media = mediaSource === "p2p" ? "Fonte Mac P2P anexada" :
      mediaSource === "whep" ? "Fonte WHEP anexada" : "Sem fonte de mídia confirmada";
    const version = typeof pkgVersion === "string" &&
      /^v\d{1,3}\.\d{1,3}(?:\.\d{1,3})?/.test(pkgVersion)
        ? pkgVersion.match(/^v\d{1,3}\.\d{1,3}(?:\.\d{1,3})?/)[0]
        : "não consultada";
    return Object.freeze({
      backend:status,
      pairing:approved ? "Vínculo HTTPS aprovado" : "PS4 não vinculado nesta página",
      media,
      pkg:"PKG publicado: " + version,
      gameplay:"Vídeo independente do PS4 ainda não integrado"
    });
  }
  function progress(checked, total) {
    const count = Array.isArray(checked) ? checked.filter(Boolean).length : 0;
    return Object.freeze({
      count:Math.min(count,total),
      total,
      percent:total > 0 ? Math.round(Math.min(count,total)*100/total) : 0
    });
  }
  return Object.freeze({ROUTES,DEFAULT,resolveRoute,connectionSummary,progress});
});

(function () {
  "use strict";
  if (typeof document === "undefined") return;
  const $ = id => document.getElementById(id);
  const core = window.BXCommandCenter;
  const root = $("bxCommandCenter");
  const modeItems = $("bxModeOptions");
  const title = $("bxModeTitle"), description = $("bxModeDescription");
  const state = $("bxModeState"), steps = $("bxModeSteps");
  const action = $("bxModeAction"), note = $("bxModeNote");
  const progressText = $("bxModeProgress"), progressBar = $("bxProgressBar");
  const summary = $("bxLiveSummary"), checklistCopy = $("bxCopyChecklist");
  if (!root || !core || !modeItems || !title || !description ||
      !state || !steps || !action || !note || !progressText || !progressBar ||
      !summary || !checklistCopy) return;

  let selected = core.DEFAULT;
  const manual = new Map();
  let latestReport = "";
  const routeButtons = new Map();
  const make = (tag, className, content) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  };
  function readChecks() {
    return Array.from(steps.querySelectorAll('input[type="checkbox"]'),
      checkbox => checkbox.checked);
  }
  function updateProgress() {
    const current = core.progress(readChecks(),core.resolveRoute(selected).steps.length);
    progressText.textContent = current.count + " de " + current.total +
      " etapas marcadas manualmente";
    progressBar.style.width = current.percent + "%";
    progressBar.setAttribute("aria-valuenow",String(current.percent));
    manual.set(selected, readChecks());
  }
  function render(id) {
    const data = core.resolveRoute(id);
    selected = data.id;
    title.textContent = data.label;
    description.textContent = data.description;
    state.textContent = data.state;
    state.dataset.kind = data.status;
    note.textContent = data.extra;
    action.textContent = data.action;
    action.setAttribute("href",data.target);
    steps.textContent = "";
    const remembered = manual.get(data.id) || [];
    data.steps.forEach((step,index) => {
      const label = make("label","bx-step");
      const checkbox = make("input");
      checkbox.type = "checkbox";
      checkbox.checked = remembered[index] === true;
      checkbox.setAttribute("aria-label","Etapa "+(index+1)+": "+step);
      checkbox.addEventListener("change", updateProgress);
      const number = make("span","bx-step-number",String(index+1).padStart(2,"0"));
      const content = make("span","bx-step-copy",step);
      label.append(checkbox,number,content);
      steps.appendChild(label);
    });
    for (const [key,button] of routeButtons) {
      const active = key === selected;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("selected",active);
    }
    updateProgress();
    latestReport = "";
    const backup = $("bxChecklistFallback");
    if (backup) { backup.hidden = true; backup.value = ""; }
    const message = $("bxCopyStatus");
    if (message) message.textContent = "";
  }
  function syncStatus() {
    const health = $("pairServerStatus");
    const pair = $("pairStatus");
    const pkg = $("pkgLatestVersion");
    const info = core.connectionSummary({
      backendState:health?.dataset.relayCheck === "ok" ? "ok" :
        health?.dataset.relayCheck === "failed" ? "failed" : "unknown",
      pairStatus:pair?.textContent || "",
      pkgVersion:pkg?.textContent || "",
      mediaSource:window.BXRemotePlayer?.activeMediaSource?.() || null
    });
    const entries = [
      ["HTTPS", info.backend], ["Vínculo",info.pairing],
      ["Imagem",info.media],["Versão",info.pkg]
    ];
    summary.textContent = "";
    for (const [label,value] of entries) {
      const div=make("div","bx-state-item");
      const heading=make("strong","",label);
      const detail=make("span","",value);
      div.append(heading,detail);
      summary.appendChild(div);
    }
    $("bxGameplayWarning").textContent=info.gameplay;
  }
  for(const data of core.ROUTES) {
    const button=make("button","bx-mode-tab");
    button.type="button";
    button.dataset.mode=data.id;
    button.setAttribute("aria-pressed",String(data.id===selected));
    button.setAttribute("aria-label",data.label+", "+data.state);
    button.append(make("span","bx-mode-icon",data.icon),
      make("strong","",data.label),make("small","",data.short));
    button.addEventListener("click",()=>render(data.id));
    modeItems.appendChild(button);
    routeButtons.set(data.id,button);
  }
  render(selected);
  syncStatus();
  checklistCopy.addEventListener("click",async()=>{
    const data=core.resolveRoute(selected);
    latestReport=[
      "BX-REMOTE-PLAY · Preparação "+data.label,
      ...data.steps.map((v,index)=>{
        const checked=readChecks()[index]===true?"[x]":"[ ]";
        return checked+" "+v;
      }),
      data.extra,
      "Marcações feitas pelo usuário; não são testes ou conexões comprovadas.",
      "Nenhum PIN, token, endereço do PS4 ou credencial coletado."
    ].join("\n");
    try {
      if(typeof navigator.clipboard?.writeText!=="function")
        throw Error("clipboard_unavailable");
      await navigator.clipboard.writeText(latestReport);
      $("bxCopyStatus").textContent="Checklist copiado sem credenciais.";
    }catch{
      const backup=$("bxChecklistFallback");
      backup.value=latestReport;
      backup.hidden=false;
      backup.focus();
      backup.select();
      $("bxCopyStatus").textContent="Copie o checklist selecionado.";
    }
  });
  window.addEventListener("pagehide",()=>{latestReport="";});
  if(typeof MutationObserver==="function") {
    const obs=new MutationObserver(syncStatus);
    for(const id of ["pairServerStatus","pairStatus","pkgLatestVersion","mediaLabel"]) {
      const el=$(id);
      if(el)obs.observe(el,{childList:true,characterData:true,subtree:true,attributes:id==="pairServerStatus",attributeFilter:id==="pairServerStatus"?["data-relay-check"]:undefined});
    }
    // Media source changes are emitted by the actual player, not inferred.
    window.addEventListener("bxremote:media-preempt",syncStatus);
  }
})();
