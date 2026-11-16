/* BX-REMOTE-PLAY optional real-media ingress.
 * The HTTPS PS4 pairing Worker is NOT a WHEP server.
 * No token or endpoint is persisted, logged, or sent to the BX pairing API.
 */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const core = window.BXWhepMedia;
  const connect = $("mediaConnect");
  const disconnect = $("mediaDisconnect");
  const endpoint = $("mediaEndpoint");
  const secret = $("mediaToken");
  const status = $("mediaBridgeStatus");
  const video = $("streamVideo");
  const resume = $("mediaResume");
  if (!core || !connect || !disconnect || !endpoint || !secret || !status || !video || !resume) return;

  let current = null;
  let generation = 0;
  const setStatus = (state, message) => {
    status.dataset.state = state;
    status.textContent = message;
  };
  const clearStream = () => {
    if (window.BXRemotePlayer && typeof window.BXRemotePlayer.attachMediaStream === "function") {
      window.BXRemotePlayer.attachMediaStream(null);
    }
  };
  const stop = (message = "Mídia desconectada.") => {
    ++generation;
    const old = current;
    current = null;
    if (old) old.stop();
    clearStream();
    connect.disabled = false;
    disconnect.disabled = true;
    resume.disabled = true;
    setStatus("idle", message);
  };
  connect.addEventListener("click", async () => {
    const address = endpoint.value.trim();
    const token = secret.value;
    secret.value = ""; // Never store the gateway access token.
    stop("Preparando recepção do gateway...");
    if (!core.validEndpoint(address)) {
      setStatus("error", "Informe um endpoint WHEP HTTPS completo (não use o Worker de pareamento).");
      return;
    }
    if (typeof RTCPeerConnection !== "function" || typeof MediaStream !== "function") {
      setStatus("error", "Este navegador não suporta a recepção WebRTC necessária.");
      return;
    }
    if (!window.BXRemotePlayer || typeof window.BXRemotePlayer.attachMediaStream !== "function") {
      setStatus("error", "O módulo de vídeo do BX-REMOTE-PLAY não carregou.");
      return;
    }
    const request = ++generation;
    let receiver;
    try {
      receiver = core.createReceiver({
        endpoint: address,
        token,
        onStream: stream => {
          if (request !== generation) return;
          window.BXRemotePlayer.attachMediaStream(stream);
          resume.disabled = !stream;
        },
        onStatus: message => {
          if (request === generation) setStatus("connecting", message);
        }
      });
      current = receiver;
      connect.disabled = true;
      disconnect.disabled = false;
      setStatus("connecting", "Negociando WebRTC com o gateway...");
      await receiver.start();
      if (request !== generation) return;
      setStatus("connecting", "WebRTC negociado; aguardando quadros de vídeo.");
    } catch (error) {
      if (request !== generation) return;
      const messages = {
        invalid_token: "Token inválido. Use a credencial do gateway de mídia, nunca a do PS4.",
        ice_timeout: "Falha ao reunir candidatos ICE no navegador.",
        invalid_session_url: "Gateway retornou endereço de sessão inseguro.",
        invalid_sdp: "Gateway retornou resposta SDP inválida.",
        invalid_sdp_type: "Gateway não respondeu com application/sdp.",
        whep_http_401: "Gateway recusou o token de mídia (HTTP 401).",
        whep_http_403: "Acesso ao gateway negado (HTTP 403).",
        whep_http_404: "Endpoint não encontrado: o servidor não disponibiliza WHEP (HTTP 404)."
      };
      const code = error && error.message;
      const explanation = messages[code] ||
        (code && /^whep_http_\d+$/.test(code) ? "Resposta inesperada do gateway (" + code.slice(5) + ")." :
          "Não foi possível conectar: confira HTTPS, CORS, servidor WHEP e acesso do gateway ao PS4.");
      stop(explanation);
      setStatus("error", explanation);
    }
  });

  disconnect.addEventListener("click", () => stop());
  resume.addEventListener("click", () => {
    video.muted = false;
    video.play().then(() => {
      setStatus("connected", "Reprodução de mídia iniciada. A origem PS4 depende do gateway.");
    }).catch(() => {
      setStatus("error", "O navegador bloqueou a reprodução. Toque na tela e tente novamente.");
    });
  });
  video.addEventListener("playing", () => {
    if (!current || !video.srcObject || video.readyState < 2) return;
    setStatus("connected", "Vídeo do gateway em reprodução; origem PS4 não verificada.");
  });
  video.addEventListener("error", () => {
    if (current) setStatus("error", "O navegador não conseguiu reproduzir o fluxo de mídia.");
  });
  window.addEventListener("pagehide", () => stop("Sessão de mídia encerrada ao sair da página."));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && current) stop("Sessão encerrada ao deixar a página em segundo plano.");
  });
})();
