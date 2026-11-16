/* BX-REMOTE-PLAY — first-test diagnostics. No network calls, no secrets.
 * All fields are explicit allowlisted capabilities; never export URLs, tokens,
 * pairing codes, controller names, IP addresses, or full user-agent strings.
 */
(function (scope) {
  "use strict";

  function snapshot(input) {
    const c = input || {};
    const relay = ["ok", "failed", "invalid", "unconfigured", "not_tested"].includes(c.relayStatus)
      ? c.relayStatus : "not_tested";
    return Object.freeze({
      siteSecure: c.siteSecure === true,
      gamepadAPI: c.gamepadAPI === true,
      gamepadConnected: c.gamepadConnected === true,
      touchAvailable: c.touchAvailable === true,
      fullscreenAPI: c.fullscreenAPI === true,
      relayHealth: relay,
      // Hard-coded until video/media is genuinely wired to the PS4.
      ps4Video: false,
      ps4Input: false
    });
  }

  function reportFor(info, checklist) {
    const s = snapshot(info);
    const flags = Array.isArray(checklist) ? checklist.slice(0, 5)
      .map(item => item === true) : [];
    const yesNo = b => b ? "SIM" : "NAO";
    return [
      "BX-REMOTE-PLAY | TESTE DE PREPARACAO v0.8",
      "Site HTTPS/contexto seguro: " + yesNo(s.siteSecure),
      "Gamepad API disponivel: " + yesNo(s.gamepadAPI),
      "Controle fisico conectado: " + yesNo(s.gamepadConnected),
      "Tela com toque disponivel: " + yesNo(s.touchAvailable),
      "Fullscreen API disponivel: " + yesNo(s.fullscreenAPI),
      "Teste de saude do relay: " + s.relayHealth,
      "Video PS4 integrado: NAO",
      "Controles no PS4 integrado: NAO",
      "Checklist manual: " + (flags.length ? flags.map(yesNo).join(", ") : "nao informado"),
      "Sem enderecos de servidor, codigo de pareamento ou tokens."
    ].join("\n");
  }

  const api = Object.freeze({ snapshot, reportFor });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!scope || !scope.document) return;

  const document = scope.document;
  const get = id => document.getElementById(id);
  const runButton = get("firstTestsRun");
  const copyButton = get("firstTestsCopy");
  const area = get("firstTestsReport");
  const status = get("firstTestsStatus");
  if (!runButton || !copyButton || !area || !status) return;

  function capabilities() {
    const nav = scope.navigator || {};
    let gamepadConnected = false;
    try {
      gamepadConnected = typeof nav.getGamepads === "function" &&
        Array.from(nav.getGamepads() || []).some(pad => Boolean(pad && pad.connected !== false));
    } catch {
      gamepadConnected = false;
    }
    const relayResult = get("pairServerStatus")?.dataset?.relayCheck;
    return {
      siteSecure: scope.isSecureContext === true,
      gamepadAPI: typeof nav.getGamepads === "function",
      gamepadConnected,
      touchAvailable: Number(nav.maxTouchPoints || 0) > 0 || "ontouchstart" in scope,
      fullscreenAPI: typeof get("stage")?.requestFullscreen === "function",
      relayStatus: relayResult || "not_tested"
    };
  }

  function refresh() {
    const checkboxes = Array.from(document.querySelectorAll("[data-test-step]"));
    area.value = reportFor(capabilities(), checkboxes.map(box => box.checked));
    const done = checkboxes.filter(box => box.checked).length;
    status.textContent = "Diagnostico local atualizado. Etapas marcadas: "
      + done + "/" + checkboxes.length
      + ". Nenhuma informacao foi enviada.";
  }

  runButton.addEventListener("click", refresh);
  document.querySelectorAll("[data-test-step]").forEach(box => {
    box.addEventListener("change", refresh);
  });
  copyButton.addEventListener("click", async () => {
    refresh();
    try {
      if (!scope.navigator?.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await scope.navigator.clipboard.writeText(area.value);
      status.textContent = "Diagnostico sem credenciais copiado.";
    } catch {
      area.focus();
      area.select();
      status.textContent = "Selecione e copie manualmente o texto do diagnostico.";
    }
  });
  refresh();
})(typeof window !== "undefined" ? window : undefined);
