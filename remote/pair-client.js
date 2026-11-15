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
    const response = await fetch(base + path, {
      method: data === undefined ? "GET" : "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
      headers: {
        ...(data === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: "Bearer " + token } : {})
      },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "HTTP " + response.status);
    return result;
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
      target.dataset.relayCheck = "ok";
      target.textContent = "Relay acessível. Pareamento disponível; PS4, controles reais e transmissão de vídeo ainda não estão confirmados.";
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
    const current = ++requestId;
    $("pairClaim").disabled = true;
    $("pairCode").value = "";
    report("Solicitando vínculo de laboratório...");

    let claimantToken;
    try {
      const claim = await jsonRequest(base, "/v1/pair/claim", { data: { code } });
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
        const state = await jsonRequest(base, "/v1/pair/status", { token: claimantToken });
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
    ++requestId;
    $("pairClaim").disabled = false;
    $("pairCode").value = "";
    report("Solicitação cancelada neste navegador.");
  });
  window.addEventListener("pagehide", () => { ++requestId; });
})();
