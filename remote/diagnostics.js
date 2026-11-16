/* BX-REMOTE-PLAY connection self-test: PUBLIC capabilities only.
 * Never reads pairing PINs, console config, tokens, private network addresses,
 * local storage or the Remote Play client registration.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BXDiagnostics = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const PUBLIC_HEALTH = "https://bx-remote-link.4rt949zpj8.workers.dev/health";
  const VALID = new Set(["ok", "attention", "unavailable"]);
  function finding(key, state, message) {
    if (!VALID.has(state) || !/^[a-z_-]{3,40}$/.test(key))
      throw new TypeError("Invalid diagnostic finding");
    return Object.freeze({ key, state, message });
  }
  function assessBrowser({ secure, webrtc, h264 }) {
    return [
      finding("secure", secure ? "ok" : "unavailable",
        secure ? "HTTPS seguro disponível." : "Conexão HTTPS segura necessária."),
      finding("webrtc", webrtc ? "ok" : "unavailable",
        webrtc ? "Receptor WebRTC do navegador disponível." :
          "Seu navegador não oferece os recursos WebRTC necessários."),
      finding("h264", h264 === true ? "ok" : "attention",
        h264 === true ? "Navegador informa suporte ao codec H.264." :
          "Suporte WebRTC H.264 não confirmado. Verifique o navegador.")
    ];
  }
  function assessBackend(health) {
    if (!health || health.status !== "ok" ||
        health.mode !== "control-prototype" || health.pairing !== true)
      return finding("backend", "unavailable", "Servidor respondeu em formato inesperado.");
    if (health.configured !== true)
      return finding("backend", "unavailable", "Worker responde, mas vínculo não está configurado.");
    return finding("backend", "ok",
      "Servidor HTTPS de vínculo configurado. Isso não confirma PS4 online.");
  }
  function assessMedia(health, currentSource) {
    const named = {p2p: "Fonte P2P do Mac", whep: "Fonte de gateway WHEP"};
    if (named[currentSource])
      return finding("media", "attention", named[currentSource] +
        " anexada. É preciso confirmar quadros reais; origem PS4 não verificada.");
    return finding("media", "attention",
      health?.video === true ? "Servidor declara vídeo; verifique a fonte real." :
        "Sem transmissão nativa PS4 → BX. Pareamento não fornece imagem.");
  }
  function report(findings) {
    const titles = {
      secure: "HTTPS", webrtc: "WebRTC", h264: "Vídeo H.264",
      backend: "Servidor de vínculo", media: "Fonte de mídia",
      update: "Versão do PKG"
    };
    const statuses = {ok:"OK", attention:"ATENÇÃO", unavailable:"INDISPONÍVEL"};
    const data = findings.map(item => {
      const key = String(item.key);
      return (titles[key] || "Verificação") + ": " +
        (statuses[item.state] || "INDEFINIDO") + " — " + item.message;
    });
    return [
      "BX-REMOTE-PLAY — diagnóstico público do navegador",
      ...data,
      "Este diagnóstico não inclui PIN, token, endereço IP ou informações privadas do PS4.",
      "Nenhum resultado comprova vídeo, áudio ou controle real do PS4 no navegador."
    ].join("\n");
  }
  async function run({ fetcher, secure = true, webrtc = false, h264 = null,
    currentSource = null, parseManifest, signal, timeoutMs = 6500 } = {}) {
    const request = fetcher || ((...args) => fetch(...args));
    const results = assessBrowser({ secure, webrtc, h264 });
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let health = null;
    try {
      try {
        const response = await request(PUBLIC_HEALTH, {
          method: "GET", mode: "cors", credentials: "omit",
          cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
          signal: controller.signal
        });
        if (!response || response.status !== 200)
          throw new Error("health_unavailable");
        health = await response.json();
        results.push(assessBackend(health));
      } catch {
        results.push(finding("backend", "unavailable",
          "Servidor HTTPS não respondeu. Verifique internet, DNS ou CORS."));
      }
      results.push(assessMedia(health, currentSource));
      try {
        const response = await request("./update.txt", {
          method:"GET", mode:"same-origin", credentials:"omit",
          cache:"no-store", redirect:"error", referrerPolicy:"no-referrer",
          signal: controller.signal
        });
        if (!response || response.status !== 200) throw new Error("manifest_http");
        if (typeof parseManifest !== "function") throw new Error("manifest_parser");
        const parsed = parseManifest(await response.text());
        results.push(finding("update", "ok", "Último PKG publicado: v" + parsed.version +
          ". A versão instalada no PS4 não é detectável pelo site."));
      } catch {
        results.push(finding("update", "attention",
          "Não foi possível validar a versão pública do PKG."));
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
    return Object.freeze(results);
  }
  return Object.freeze({ PUBLIC_HEALTH, assessBrowser, assessBackend,
    assessMedia, report, run });
});

(function () {
  "use strict";
  if (typeof document === "undefined") return;
  const $ = id => document.getElementById(id);
  const core = window.BXDiagnostics;
  const button = $("runDiagnostics"), copy = $("copyDiagnostics");
  const output = $("diagnosticsOutput");
  const status = $("diagnosticsStatus");
  if (!core || !button || !copy || !output || !status) return;
  let current = null, generation = 0, safeReport = "";
  function browserFeatures() {
    let h264 = null;
    if (window.RTCRtpReceiver?.getCapabilities) {
      try {
        const result = RTCRtpReceiver.getCapabilities("video");
        if (result && Array.isArray(result.codecs))
          h264 = result.codecs.some(c => /video\/h264/i.test(c.mimeType || ""));
      } catch {}
    }
    return {
      secure: window.isSecureContext === true,
      webrtc: typeof window.RTCPeerConnection === "function" &&
              typeof window.MediaStream === "function",
      h264
    };
  }
  function abort() {
    generation++;
    if (current) current.abort();
    current = null;
    button.disabled = false;
  }
  button.addEventListener("click", async () => {
    abort();
    const id = generation;
    const controller = new AbortController();
    current = controller;
    button.disabled = true;
    copy.disabled = true;
    safeReport = "";
    output.textContent = "";
    status.textContent = "Executando verificações públicas, sem usar código ou token do console...";
    try {
      const findings = await core.run({
        ...browserFeatures(), signal: controller.signal,
        currentSource: window.BXRemotePlayer?.activeMediaSource() || null,
        parseManifest: window.BXPackageUpdates?.parseManifest
      });
      if (id !== generation || controller.signal.aborted) return;
      const names = {
        secure:"HTTPS", webrtc:"WebRTC", h264:"Codec H.264",
        backend:"Servidor BX", media:"Imagem", update:"Atualização"
      };
      for (const item of findings) {
        const line = document.createElement("div");
        line.className = "bx-diag-row";
        line.dataset.state = item.state;
        const title = document.createElement("strong");
        title.textContent = names[item.key] || "Verificação";
        const description = document.createElement("span");
        description.textContent = item.message;
        line.append(title, description);
        output.appendChild(line);
      }
      safeReport = core.report(findings);
      copy.disabled = false;
      const blocked = findings.filter(x => x.state === "unavailable").length;
      status.textContent = blocked ?
        "Verificações concluídas. Há " + blocked + " item(ns) indisponível(is). Leia as orientações abaixo." :
        "Verificações concluídas. O navegador e o servidor podem estar prontos, mas o vídeo PS4 ainda não está integrado.";
    } catch {
      if (id === generation && !controller.signal.aborted)
        status.textContent = "Falha ao executar o diagnóstico. Atualize a página e tente novamente.";
    } finally {
      if (id === generation) {
        current = null;
        button.disabled = false;
      }
    }
  });
  copy.addEventListener("click", async () => {
    if (!safeReport) return;
    try {
      await navigator.clipboard.writeText(safeReport);
      status.textContent = "Relatório público copiado, sem credenciais ou informações privadas.";
    } catch {
      status.textContent = "Não foi possível copiar automaticamente. Utilize os resultados exibidos na tela.";
    }
  });
  window.addEventListener("pagehide", abort);
})();
