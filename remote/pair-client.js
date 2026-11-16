/* BX-REMOTE-PLAY browser pairing — PS4 HTTP pilot or simulated relay.
 * Tokens remain in memory, never URL, local storage or logs. Linking over
 * HTTPS is not the same thing as Remote Play/media/input transport.
 */
(() => {
  "use strict";

  const game = window.BXRemoteGame;
  const $ = id => document.getElementById(id);
  if (!game || !$("pairClaim") || !$("pairEndpoint") || !$("pairCode")) return;

  let requestId = 0;
  let activeClaimController = null;
  let healthRequestId = 0;
  let activeHealthController = null;

  function cancelActiveClaim() {
    requestId++;
    if (activeClaimController) activeClaimController.abort();
    activeClaimController = null;
  }
  const report = message => {
    $("pairStatus").textContent = message;
  };
  function describeNativeRemotePlayProbe(state) {
    const diag = state?.remotePlayProbe;
    if (!diag || !Number.isInteger(diag.checkedSecondsAgo) ||
        diag.checkedSecondsAgo < 0 || diag.checkedSecondsAgo > 90)
      return "Diagnóstico nativo de Remote Play ainda não recebido. Execute o serviço ELF v0.20 no PS4.";
    if (diag.loopbackTcp9295 === true)
      return "Diagnóstico do serviço: porta TCP 9295 respondeu localmente no PS4. Ainda não existe transmissão de vídeo/áudio nem controle.";
    if (diag.loopbackTcp9295 === false)
      return "Diagnóstico do serviço: porta TCP 9295 não respondeu ao teste local. Verifique Uso remoto no PS4; a restrição de loopback também pode causar esse resultado.";
    return "Diagnóstico do serviço: não foi possível criar o socket de teste no PS4. Confira o relatório local do ELF.";
  }

  function pairingTarget() {
    return game.validPairingServer($("pairEndpoint").value.trim());
  }

  function stopHealthCheck() {
    ++healthRequestId;
    if (activeHealthController) activeHealthController.abort();
    activeHealthController = null;
  }

  function errorMessage(error) {
    const reasons = {
      BACKEND_NOT_CONFIGURED: "Servidor online, mas falta configurar a chave privada do PS4.",
      INVALID_CODE: "Código inválido ou expirado. Confira o código que aparece na TV.",
      INVALID_CLAIM: "Pedido expirou ou foi revogado. Gere um novo código no PS4.",
      RATE_LIMITED: "Muitas tentativas. Aguarde um minuto antes de tentar novamente.",
      CONSOLE_OFFLINE: "O aplicativo PS4 de vínculo não está conectado.",
      UNAUTHORIZED: "A chave de autenticação do PS4 está incorreta.",
      FORBIDDEN: "Servidor não autorizou esta página ou o endereço informado.",
      BACKEND_UNAVAILABLE: "Servidor temporariamente indisponível."
    };
    if (error?.name === "AbortError") return "Tempo esgotado ou solicitação cancelada.";
    return reasons[error?.message] || "Falha de conexão com o servidor. Confira a configuração.";
  }

  async function jsonRequest(base, path, { data, token, signal } = {}) {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", forwardAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(base + path, {
        method: data === undefined ? "GET" : "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        headers: {
          ...(data === undefined ? {} : { "content-type": "application/json" }),
          ...(token ? { authorization: "Bearer " + token } : {})
        },
        body: data === undefined ? undefined : JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "HTTP " + response.status);
      return result;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", forwardAbort);
    }
  }

  $("pairEndpoint").addEventListener("input", () => {
    stopHealthCheck();
    cancelActiveClaim();
    $("pairClaim").disabled = false;
    $("pairServerStatus").dataset.relayCheck = "not_tested";
    $("pairServerStatus").textContent = "Endereço alterado. Teste novamente o servidor.";
    report("Servidor alterado. Solicitação anterior cancelada.");
  });

  // The page's independent health probe takes priority if available.
  // Keep this legacy handler as a fallback for isolated browser tests.
  if (!window.BXRemoteHealthStandalone) $("pairCheck").addEventListener("click", async () => {
    const server = pairingTarget();
    const target = $("pairServerStatus");
    stopHealthCheck();
    const current = healthRequestId;
    if (!server) {
      target.dataset.relayCheck = "invalid";
      target.textContent = "Endereço inválido. Informe HTTPS; HTTP só em localhost.";
      return;
    }
    const button = $("pairCheck");
    button.disabled = true;
    target.dataset.relayCheck = "not_tested";
    target.textContent = "Verificando o servidor HTTPS de vínculo...";
    const controller = new AbortController();
    activeHealthController = controller;
    const timeout = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(server.apiBase + "/health", {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        referrerPolicy: "no-referrer"
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const info = await response.json();
      if (current !== healthRequestId) return;
      if (info.status !== "ok" || info.mode !== "control-prototype" ||
          info.pairing !== true) {
        throw new Error("Servidor não reconhecido");
      }
      if (info.pairingBackend === "cloudflare-durable-object" &&
          info.configured !== true) {
        target.dataset.relayCheck = "unconfigured";
        target.textContent = "BX-REMOTE-LINK online. Falta adicionar a chave privada do console em Cloudflare → bx-remote-link → Variables and Secrets.";
        return;
      }
      target.dataset.relayCheck = "ok";
      target.textContent = "Servidor HTTPS de vínculo acessível. O PS4 precisa do PKG configurado; vídeo, áudio e controles reais ainda não estão disponíveis.";
    } catch (error) {
      if (current !== healthRequestId) return;
      target.dataset.relayCheck = "failed";
      target.textContent = error?.name === "AbortError"
        ? "Tempo esgotado. Confira a rede e o endereço HTTPS."
        : "Não foi possível verificar o servidor. Confira o endereço, HTTPS e origem autorizada.";
    } finally {
      clearTimeout(timeout);
      if (current === healthRequestId) {
        activeHealthController = null;
        button.disabled = false;
      }
    }
  });

  $("pairClaim").addEventListener("click", async () => {
    const server = pairingTarget();
    const code = game.normalizePairingCode($("pairCode").value);
    if (!server) {
      report("Informe o endereço HTTPS do servidor de vínculo.");
      return;
    }
    if (!code) {
      report("Digite os oito números exibidos no aplicativo PS4 de teste ou no simulador.");
      return;
    }
    const base = server.apiBase;
    cancelActiveClaim();
    const current = requestId;
    const controller = new AbortController();
    activeClaimController = controller;
    $("pairClaim").disabled = true;
    $("pairCode").value = "";
    report("Enviando código ao servidor de vínculo...");

    let claimantToken;
    try {
      const claim = await jsonRequest(base, "/v1/pair/claim", {
        data: { code }, signal: controller.signal
      });
      if (current !== requestId || controller.signal.aborted) return;
      if (typeof claim.claimToken !== "string" || !/^[a-f0-9]{64}$/.test(claim.claimToken)) {
        throw new Error("INVALID_CLAIM");
      }
      claimantToken = claim.claimToken;
      report("Aguardando aprovação pelo DualShock 4 no PS4 de teste ou pelo simulador...");
    } catch (error) {
      if (current === requestId) {
        report(errorMessage(error));
        $("pairClaim").disabled = false;
      }
      return;
    }

    const stopAt = Date.now() + 2 * 60 * 1000;
    let consecutiveTransientFailures = 0;
    while (current === requestId && Date.now() < stopAt) {
      try {
        const state = await jsonRequest(base, "/v1/pair/status", {
          token: claimantToken, signal: controller.signal
        });
        if (current !== requestId || controller.signal.aborted) return;
        consecutiveTransientFailures = 0;
        if (state.status === "approved") {
          $("pairClaim").disabled = false;
          if (state.controlAvailable === false) {
            report("Vínculo aprovado com o PS4 (HTTP). " +
              describeNativeRemotePlayProbe(state));
            claimantToken = null;
            return;
          }
          if (typeof state.playerToken !== "string") {
            report("Servidor aprovou, mas não forneceu sessão de controles. Nenhum vídeo disponível.");
            claimantToken = null;
            return;
          }
          report("Vínculo aprovado. Conectando ao relay de controles...");
          // Secrets stay in this transient browser session; no persistent storage.
          window.dispatchEvent(new CustomEvent("bxremote:paired", {
            detail: { endpoint: server.controlEndpoint, playerToken: state.playerToken }
          }));
          claimantToken = null;
          return;
        }
        if (state.status === "denied") {
          report("A solicitação foi recusada pelo console.");
          $("pairClaim").disabled = false;
          claimantToken = null;
          return;
        }
        if (!["pending_confirmation", "waiting"].includes(state.status)) {
          report("O servidor não possui uma solicitação ativa. Gere outro código.");
          $("pairClaim").disabled = false;
          claimantToken = null;
          return;
        }
        report("Aguardando aprovação na TV... " +
          Math.max(0, Math.ceil((stopAt - Date.now()) / 1000)) + "s restantes.");
      } catch (error) {
        if (current !== requestId || controller.signal.aborted) return;
        // iOS/mobile networks may briefly drop while the PS4 is showing the
        // approval prompt. Retry only reads of the existing claim, never
        // regenerate a PIN or resend the POST /claim.
        const transient = error?.name === "AbortError" ||
          error?.name === "TypeError" || /^HTTP 5\d\d$/.test(error?.message || "");
        if (transient && consecutiveTransientFailures < 2 && Date.now() < stopAt) {
          consecutiveTransientFailures++;
          report("Rede instável. Tentando consultar o mesmo vínculo novamente (" +
            consecutiveTransientFailures + "/2). Não feche o app do PS4.");
          await new Promise(resolve => setTimeout(resolve, consecutiveTransientFailures * 1250));
          continue;
        }
        report(errorMessage(error));
        $("pairClaim").disabled = false;
        claimantToken = null;
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1250));
    }
    if (current === requestId) {
      report("Código expirado. Abra novamente o aplicativo de teste para gerar outro.");
      $("pairClaim").disabled = false;
    }
    claimantToken = null;
  });

  $("pairCancel").addEventListener("click", () => {
    cancelActiveClaim();
    $("pairClaim").disabled = false;
    $("pairCode").value = "";
    report("Solicitação cancelada neste navegador.");
  });
  // Check the public backend once when the user opens the pairing section.
  // No console secret, PIN or account data is sent by this GET request.
  let openedOnce = false;
  if (!window.BXRemoteHealthStandalone) $("pairSection")?.addEventListener("toggle", () => {
    if (!openedOnce && $("pairSection").open) {
      openedOnce = true;
      $("pairCheck").click();
    }
  });

  // Safari may restore the document from the back/forward cache (BFCache).
  // Leave no stale bearer request or disabled button on a restored page.
  window.addEventListener("pagehide", () => {
    const wasPending = $("pairClaim").disabled;
    cancelActiveClaim();
    stopHealthCheck();
    $("pairClaim").disabled = false;
    if (wasPending) report("Vínculo interrompido ao sair da página. Gere novo código se necessário.");
  });
  window.addEventListener("pageshow", event => {
    if (!event?.persisted) return;
    cancelActiveClaim();
    stopHealthCheck();
    $("pairClaim").disabled = false;
    if (!$("pairStatus").textContent?.includes("Vínculo interrompido")) {
      report("Página restaurada. Confira o código no PS4 antes de vincular novamente.");
    }
  });
})();
