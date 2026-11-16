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
  const stats = $("mediaHealth");
  const mode = $("mediaConnectionMode");
  const fields = $("mediaGatewayFields");
  const noGateway = $("mediaNoGateway");
  if (!core || !connect || !disconnect || !endpoint || !secret || !status ||
      !video || !resume || !stats || !mode || !fields || !noGateway) return;
  /* Safari requires a user gesture to enable audible WebRTC media.
   * Start video muted for autoplay, then ask for a tap only when audio exists.
   */
  video.muted = true;

  let current = null;
  let generation = 0;
  const setStatus = (state, message) => {
    status.dataset.state = state;
    status.textContent = message;
  };
  const updateStats = metrics => {
    if (!metrics) {
      stats.dataset.video = "no";
      stats.dataset.audio = "no";
      stats.dataset.bytes = "no";
      stats.textContent = "Sem dados reais recebidos. Nenhuma fonte de vídeo ou áudio foi confirmada.";
      return;
    }
    const frames = Math.max(0, Math.trunc(metrics.videoFramesDecoded || 0));
    const audioBytes = Math.max(0, Math.trunc(metrics.audioBytesReceived || 0));
    const videoBytes = Math.max(0, Math.trunc(metrics.videoBytesReceived || 0));
    const resolution = metrics.videoWidth && metrics.videoHeight
      ? " • " + metrics.videoWidth + "×" + metrics.videoHeight : "";
    const videoState = frames > 0
      ? "Vídeo: " + frames + " quadros decodificados" + resolution
      : metrics.videoTrack ? "Vídeo: trilha detectada, sem quadros decodificados"
        : "Vídeo: nenhuma trilha confirmada";
    const audioState = audioBytes > 0
      ? "Áudio: " + Math.floor(audioBytes / 1024) + " KiB recebidos"
      : metrics.audioTrack ? "Áudio: trilha detectada, sem dados recebidos"
        : "Áudio: nenhuma trilha confirmada";
    stats.textContent = videoState + " • " + audioState +
      " • Origem PS4 não verificada pelo navegador.";
    stats.dataset.video = frames > 0 ? "yes" : "no";
    stats.dataset.audio = audioBytes > 0 ? "yes" : "no";
    stats.dataset.bytes = videoBytes > 0 ? "yes" : "no";
  };
  const clearStream = () => {
    if (window.BXRemotePlayer && typeof window.BXRemotePlayer.attachMediaStream === "function") {
      window.BXRemotePlayer.attachMediaStream(null, "whep");
    }
  };
  const stop = (message = "Mídia desconectada.") => {
    ++generation;
    const old = current;
    current = null;
    if (old) old.stop();
    clearStream();
    connect.disabled = mode.value !== "whep" || !core.validEndpoint(endpoint.value.trim());
    disconnect.disabled = true;
    resume.disabled = true;
    updateStats(null);
    setStatus("idle", message);
  };
  connect.addEventListener("click", async () => {
    const address = endpoint.value.trim();
    const token = secret.value;
    secret.value = ""; // Never store the gateway access token.
    stop("Preparando recepção do gateway...");
    if (mode.value !== "whep") {
      setStatus("waiting", "Sem gateway configurado: o PKG e o Worker não enviam vídeo dos jogos.");
      return;
    }
    if (!core.validEndpoint(address)) {
      setStatus("error", "O endereço precisa ser HTTPS e incluir o caminho WHEP. Não use o Worker de pareamento.");
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
          window.BXRemotePlayer.attachMediaStream(stream, "whep");
          const audioAvailable = Boolean(stream && typeof stream.getAudioTracks === "function" &&
            stream.getAudioTracks().some(track => track.readyState !== "ended"));
          resume.disabled = !audioAvailable;
        },
        onStatus: message => {
          if (request === generation) setStatus("connecting", message);
        },
        onMetrics: metrics => {
          if (request !== generation) return;
          updateStats(metrics);
          if (metrics.videoFramesDecoded > 0) {
            setStatus("connected", "Quadros de vídeo decodificados do gateway. A origem PS4 ainda não foi verificada.");
          }
        }
      });
      current = receiver;
      connect.disabled = true;
      disconnect.disabled = false;
      setStatus("connecting", "Negociando WebRTC com o gateway...");
      await receiver.start();
      if (request !== generation) return;
      setStatus("connecting", "WebRTC negociado; aguardando quadros de vídeo. Confira as métricas abaixo.");
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
        whep_http_404: "Endpoint não encontrado (404). A URL WHEP está errada ou o servidor de mídia não foi instalado.",
        whep_http_405: "Este caminho não aceita POST WHEP (405). Confira a URL do servidor.",
        whep_http_415: "Servidor recusou a oferta SDP (415). Confira o suporte WHEP.",
        whep_http_503: "Servidor WHEP indisponível (503). Verifique se há fonte de mídia ativa.",
        gateway_timeout: "O gateway não respondeu em 15 segundos. Verifique servidor HTTPS, rede e proxy.",
        gateway_network_error: "Não foi possível alcançar o gateway. Confira HTTPS, DNS, CORS e a rede. O Worker de pareamento não é um gateway."
      };
      const code = error && error.message;
      const explanation = messages[code] ||
        (code && /^whep_http_\d+$/.test(code) ? "Resposta inesperada do gateway (" + code.slice(5) + ")." :
          "Não foi possível conectar: confira HTTPS, CORS, servidor WHEP e acesso do gateway ao PS4.");
      stop(explanation);
      setStatus("error", explanation);
    }
  });

  function syncMode() {
    const configured = mode.value === "whep";
    fields.hidden = !configured;
    noGateway.hidden = configured;
    if (current) {
      stop(configured ? "Gateway alterado; conecte novamente." :
        "Conexão encerrada. Nenhum gateway selecionado.");
    } else {
      connect.disabled = !configured || !core.validEndpoint(endpoint.value.trim());
      if (!configured) setStatus("waiting", "Ainda não existe uma fonte de mídia do PS4 ligada ao BX.");
      else if (!core.validEndpoint(endpoint.value.trim()))
        setStatus("waiting", "Informe a URL HTTPS de um servidor WHEP já configurado.");
      else setStatus("idle", "Servidor informado. Conecte para verificar se existe vídeo e áudio real.");
    }
    resume.disabled = true;
  }
  mode.addEventListener("change", syncMode);
  endpoint.addEventListener("input", () => {
    if (!current && mode.value === "whep") syncMode();
  });
  syncMode();

  window.addEventListener("bxremote:media-preempt", event => {
    if (event.detail?.previous === "whep") {
      stop("Gateway WHEP desconectado: outra fonte assumiu o player.");
    }
  });
  disconnect.addEventListener("click", () => stop());
  resume.addEventListener("click", () => {
    const stream = video.srcObject;
    if (!stream || typeof stream.getAudioTracks !== "function" ||
        !stream.getAudioTracks().some(track => track.readyState !== "ended")) {
      setStatus("waiting", "Nenhuma trilha de áudio foi recebida. Verifique a fonte no gateway.");
      return;
    }
    video.muted = false;
    video.volume = 1;
    video.play().then(() => {
      setStatus("connecting", "Reprodução de áudio habilitada no navegador. Confirme se o som está audível.");
    }).catch(() => {
      setStatus("error", "O navegador bloqueou o áudio. Toque novamente no botão Ativar áudio.");
    });
  });
  video.addEventListener("playing", () => {
    if (!current || !video.srcObject || video.readyState < 2) return;
    if (stats.dataset.video === "yes")
      setStatus("connected", "Vídeo decodificado pelo navegador; origem PS4 não verificada.");
    else
      setStatus("connecting", "Player ativo, mas ainda sem quadros decodificados de vídeo.");
  });
  video.addEventListener("error", () => {
    if (current) setStatus("error", "O navegador não conseguiu reproduzir o fluxo de mídia.");
  });
  window.addEventListener("pagehide", () => stop("Sessão de mídia encerrada ao sair da página."));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && current) stop("Sessão encerrada ao deixar a página em segundo plano.");
  });
})();
