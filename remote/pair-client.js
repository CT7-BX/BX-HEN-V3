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

  $("pairClaim").addEventListener("click", async () => {
    const endpoint = game.validRelayEndpoint($("pairEndpoint").value.trim());
    const code = $("pairCode").value.trim();
    if (!endpoint) {
      report("Informe um endereço WSS seguro terminado em /v1/link.");
      return;
    }
    if (!/^\d{8}$/.test(code)) {
      report("Digite os oito números exibidos no console simulado.");
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
      report("Aguardando aprovação explícita no console simulado...");
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
        if (state.status === "approved" && typeof state.playerToken === "string") {
          $("pairClaim").disabled = false;
          if (state.controlAvailable === false) {
            report("Vínculo aprovado com o PS4 (HTTP). O agente ainda não possui canal de controle nem vídeo; nenhum jogo será transmitido.");
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
          report("O console simulado recusou a vinculação.");
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
      report("Código expirado. Gere outro no console simulado.");
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
