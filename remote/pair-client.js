/* BX-REMOTE-PLAY browser pairing v0.3 — experimental/simulated only.
 * Code is entered by the user, claimant token remains in closure RAM,
 * player authorization is released only after simulated console approval.
 */
(() => {
  "use strict";

  const game = window.BXRemoteGame;
  const $ = id => document.getElementById(id);
  if (!game || !$("pairClaim") || !$("pairEndpoint") || !$("pairCode")) return;

  let requestId = 0;
  let activeClaimController = null;

  function cancelActiveClaim() {
    requestId++;
    if (activeClaimController) activeClaimController.abort();
    activeClaimController = null;
  }
  const report = message => {
    $("pairStatus").textContent = message;
  };

  function apiBase(endpoint) {
    const checked = game.validRelayEndpoint(endpoint);
    if (!checked) return null;
    const uri = new URL(checked);
    uri.protocol = uri.protocol === "wss:" ? "https:" : "http:";
    uri.pathname = "/";
    return uri.origin;
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
    $("pairServerStatus").dataset.relayCheck = "not_tested";
    $("pairServerStatus").textContent = "Endereço alterado. Teste novamente o servidor.";
  });

  $("pairCheck").addEventListener("click", async () => {
    const endpoint = game.validRelayEndpoint($("pairEndpoint").value.trim());
    const target = $("pairServerStatus");
    if (!endpoint) {
      target.dataset.relayCheck = "invalid";
      target.textContent = "Endereço inválido. Use WSS (WS só em localhost).";
      return;
    }
    const button = $("pairCheck");
    button.disabled = true;
    target.dataset.relayCheck = "not_tested";
    target.textContent = "Verificando acesso ao relay...";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(apiBase(endpoint) + "/health", {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        referrerPolicy: "no-referrer"
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const info = await response.json();
      if (info.status !== "ok" || info.mode !== "control-prototype") {
        throw new Error("Servidor não reconhecido");
      }
      if (info.pairingBackend === "cloudflare-durable-object"
          && info.configured !== true) {
        target.dataset.relayCheck = "failed";
        target.textContent = "BX-REMOTE-LINK online, mas falta configurar a chave privada do console no Cloudflare. O vínculo está bloqueado até essa etapa.";
        return;
      }
      target.dataset.relayCheck = "ok";
      target.textContent = "Servidor de vínculo acessível. O PS4 ainda precisa do PKG configurado; controles reais, vídeo e áudio não estão disponíveis.";
    } catch (error) {
      target.dataset.relayCheck = "failed";
      target.textContent = error.name === "AbortError"
        ? "Tempo esgotado. Confira a rede e o servidor HTTPS/WSS."
        : "Não foi possível verificar o relay. Confira endereço, HTTPS/WSS e origem autorizada.";
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
    }
  });

  $("pairClaim").addEventListener("click", async () => {
    const endpoint = game.validRelayEndpoint($("pairEndpoint").value.trim());
    const code = $("pairCode").value.trim();
    if (!endpoint) {
      report("Informe um endereço WSS seguro terminado em /v1/link.");
      return;
    }
    if (!/^\d{8}$/.test(code)) {
      report("Digite os oito números exibidos no aplicativo PS4 de teste ou no simulador.");
      return;
    }
    const base = apiBase(endpoint);
    cancelActiveClaim();
    const current = requestId;
    const controller = new AbortController();
    activeClaimController = controller;
    $("pairClaim").disabled = true;
    $("pairCode").value = "";
    report("Solicitando vínculo de laboratório...");

    let claimantToken;
    try {
      const claim = await jsonRequest(base, "/v1/pair/claim", {
        data: { code }, signal: controller.signal
      });
      claimantToken = claim.claimToken;
      report("Aguardando aprovação pelo DualShock 4 no PS4 de teste ou pelo simulador...");
    } catch (error) {
      if (current === requestId) {
        report("Vínculo recusado ou indisponível: " + error.message);
        $("pairClaim").disabled = false;
      }
      return;
    }

    const stopAt = Date.now() + 2 * 60 * 1000;
    while (current === requestId && Date.now() < stopAt) {
      try {
        const state = await jsonRequest(base, "/v1/pair/status", {
          token: claimantToken, signal: controller.signal
        });
        if (current !== requestId) return;
        if (state.status === "approved") {
          $("pairClaim").disabled = false;
          if (state.controlAvailable === false) {
            report("Vínculo aprovado com o PS4 (HTTP). O agente ainda não possui canal de controle nem vídeo; nenhum jogo será transmitido.");
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
            detail: { endpoint, playerToken: state.playerToken }
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
      } catch (error) {
        if (current === requestId) report("Vínculo encerrado: " + error.message);
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
  window.addEventListener("pagehide", cancelActiveClaim);
})();
