/* BX Android Gateway readiness — local, privacy-first capability assessment.
 * No IP, PSN account, camera, microphone, screen capture or token is accessed.
 * Does NOT connect a PS4, run Remote Play or transmit audio/video.
 */
(function (root, factory) {
  "use strict";
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.BXAndroidReadiness = core;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  function assess(data) {
    const ua = typeof data?.userAgent === "string" ? data.userAgent.slice(0, 512) : "";
    const match = ua.match(/\bAndroid\s+(\d+)(?:\.(\d+))?/i);
    const android = /\bAndroid\b/i.test(ua);
    const version = match ? Number(match[1]) : null;
    const availableMemoryGb =
      Number.isFinite(data?.deviceMemory) && data.deviceMemory > 0
        ? Math.min(64, data.deviceMemory) : null;
    const cpuCount =
      Number.isInteger(data?.hardwareConcurrency) && data.hardwareConcurrency > 0
        ? Math.min(128, data.hardwareConcurrency) : null;
    const webRtc = data?.webRtc === true;
    const screenApi = data?.displayMedia === true;

    let tier = "unknown";
    if (!android) tier = "not-android";
    else if (version !== null && version < 7) tier = "unsupported";
    else if (availableMemoryGb !== null && availableMemoryGb <= 1) tier = "very-low";
    else if (availableMemoryGb !== null && availableMemoryGb <= 2) tier = "low";
    else if (availableMemoryGb !== null) tier = "unconfirmed";
    // Browser RAM is only a coarse hint; native app will report true limits.
    const tips = [];
    if (!android) tips.push("Abra esta página no Android antigo para avaliar o aparelho.");
    else {
      if (tier === "unsupported")
        tips.push("Protótipo nativo planejado para Android 7 ou mais recente. Este aparelho exige revisão de compatibilidade.");
      else tips.push("O navegador não comprova compatibilidade com Remote Play; instale o diagnóstico nativo quando houver APK validado.");
      if (tier === "very-low" || tier === "low")
        tips.push("Comece avaliando 480p com taxa reduzida de quadros. Isso é apenas uma meta de teste, não transmissão garantida.");
      if (version === null)
        tips.push("Não foi possível identificar a versão do Android; veja Configurações > Sobre o telefone.");
      if (version !== null && version < 10)
        tips.push("Capturar o áudio de outro aplicativo é limitado antes do Android 10.");
      if (!screenApi)
        tips.push("Captura de tela direto neste navegador não está disponível. O futuro gateway precisará de um app Android com permissão.");
      else tips.push("A presença da API não garante captura funcional; confirme no próprio aparelho, com autorização do Android.");
      if (!webRtc)
        tips.push("O navegador não anuncia RTCPeerConnection; testes WebRTC no site podem falhar.");
    }
    return Object.freeze({
      android,
      version,
      availableMemoryGb,
      cpuCount,
      webRtc,
      screenApi,
      secure: data?.secure === true,
      tier,
      tips: Object.freeze(tips)
    });
  }
  function report(result) {
    const version = result.version === null ? "não identificada" : String(result.version);
    const ram = result.availableMemoryGb === null ? "não informada pelo navegador" :
      result.availableMemoryGb + " GB (estimativa do navegador)";
    const cpu = result.cpuCount === null ? "não informado" :
      String(result.cpuCount) + " núcleos lógicos informados";
    return [
      "BX Android Gateway — avaliação local do navegador",
      "Android: " + (result.android ? "identificado" : "não identificado"),
      "Versão Android: " + version,
      "Memória informada: " + ram,
      "Processamento informado: " + cpu,
      "WebRTC no navegador: " + (result.webRtc ? "API encontrada" : "não detectado"),
      "Captura no navegador: " + (result.screenApi ? "API encontrada (não validada)" : "não detectada"),
      "HTTPS: " + (result.secure ? "sim" : "não"),
      ...result.tips,
      "Este relatório não verifica o modelo exato, o PS4, vídeo real nem autorização do Android.",
      "Nenhum dado foi enviado ao servidor pelo diagnóstico."
    ].join("\n");
  }
  return Object.freeze({ assess, report });
});

(function () {
  "use strict";
  if (typeof document === "undefined") return;
  const $ = id => document.getElementById(id);
  const api = window.BXAndroidReadiness;
  const button = $("androidCheck"), copy = $("androidCopy");
  const output = $("androidOutput"), status = $("androidStatus");
  if (!api || !button || !copy || !output || !status) return;
  let last = "";
  button.addEventListener("click", () => {
    const result = api.assess({
      userAgent: navigator.userAgent || "",
      deviceMemory: navigator.deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      webRtc: typeof window.RTCPeerConnection === "function",
      displayMedia: typeof navigator.mediaDevices?.getDisplayMedia === "function",
      secure: window.isSecureContext === true
    });
    const row = (label, value) => {
      const item = document.createElement("div");
      item.className = "android-result-row";
      const title = document.createElement("strong");
      title.textContent = label;
      const description = document.createElement("span");
      description.textContent = value;
      item.append(title, description);
      output.appendChild(item);
    };
    output.textContent = "";
    row("Sistema", result.android ? "Android " +
      (result.version === null ? "(versão desconhecida)" : result.version) :
      "Este navegador não foi identificado como Android");
    row("RAM (estimativa)", result.availableMemoryGb === null ? "não informada" :
      result.availableMemoryGb + " GB — confirme no diagnóstico do app");
    row("WebRTC", result.webRtc ? "API presente; sessão não testada" : "não identificado");
    row("Captura de tela", result.screenApi ?
      "API presente; captura real não verificada" :
      "indisponível no navegador; requer app nativo");
    for (const tip of result.tips) row("Orientação", tip);
    last = api.report(result);
    copy.disabled = false;
    status.textContent = "Avaliação local concluída. Nenhuma informação do aparelho foi enviada ao BX.";
  });
  const shareLink = $("androidShareLink");
  const shareStatus = $("androidShareStatus");
  const manualLink = $("androidManualLink");
  if (shareLink && shareStatus && manualLink) {
    shareLink.addEventListener("click", async () => {
      // A fixed public page URL: never append pairing codes or private tokens.
      const url = new URL("./gateway.html", window.location.href).href;
      manualLink.hidden = true;
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({title:"BX Android Gateway", url});
          shareStatus.textContent = "Menu de compartilhamento concluído.";
          return;
        } catch (error) {
          if (error?.name === "AbortError") {
            shareStatus.textContent = "Compartilhamento cancelado.";
            return;
          }
        }
      }
      try {
        if (typeof navigator.clipboard?.writeText !== "function")
          throw new Error("clipboard_unavailable");
        await navigator.clipboard.writeText(url);
        shareStatus.textContent = "Link copiado. Envie ao Android antigo quando puder.";
      } catch {
        manualLink.value = url;
        manualLink.hidden = false;
        manualLink.focus();
        manualLink.select();
        shareStatus.textContent =
          "Copie o endereço selecionado e abra no Android antigo.";
      }
    });
  }
  copy.addEventListener("click", async () => {
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last);
      status.textContent = "Relatório copiado. Você escolhe se deseja compartilhá-lo.";
    } catch {
      status.textContent = "O navegador não permitiu copiar automaticamente.";
    }
  });
})();
