/* Receive a Mac Chiaki window in BX game player via WebRTC.
 * User must explicitly enter private one-time room code. No hidden capture.
 */
(function () {
  "use strict";
  const core = window.BXPeerVideo;
  const $ = id => document.getElementById(id);
  const field = $("p2pRoomCode"), watch = $("p2pJoin"), leave = $("p2pLeave");
  const status = $("p2pStatus"), audio = $("p2pAudio");
  const video = $("streamVideo");
  if (!core || !field || !watch || !leave || !status || !audio || !video) return;
  let session = null;
  let serial = 0;
  let audioReady = false;
  const report = message => { status.textContent = message; };
  const setStream = stream => {
    if (!window.BXRemotePlayer?.attachMediaStream) {
      report("Player BX não carregou; atualize a página.");
      return;
    }
    if (stream && video.srcObject !== stream) video.muted = true;
    window.BXRemotePlayer.attachMediaStream(stream, "p2p");
    audioReady = Boolean(stream && stream.getAudioTracks().some(t => t.readyState !== "ended"));
    audio.disabled = !audioReady;
  };
  function stop(message = "Recepção encerrada.") {
    serial++;
    if (session) { session.stop(); session = null; }
    setStream(null);
    watch.disabled = false;
    leave.disabled = true;
    audio.disabled = true;
    report(message);
  }
  watch.addEventListener("click", async () => {
    stop();
    const code = core.validCode(field.value);
    field.value = "";
    if (!code) {
      report("Código inválido. Cole o código privado de 64 caracteres exibido no Mac.");
      return;
    }
    if (!window.BXRemotePlayer?.attachMediaStream || !window.RTCPeerConnection) {
      report("Seu navegador não oferece o receptor WebRTC necessário.");
      return;
    }
    const id = ++serial;
    const receiver = core.createViewer({
      onStream: stream => { if (id === serial) setStream(stream); },
      onStatus: message => { if (id === serial) report(message); }
    });
    session = receiver;
    watch.disabled = true;
    leave.disabled = false;
    report("Solicitando conexão P2P criptografada...");
    try {
      await receiver.start(code);
    } catch (error) {
      if (id !== serial) return;
      const reasons = {
        invalid_code: "Código inválido. Copie o código completo do Mac.",
        signal_http_401: "Sessão inexistente, encerrada ou expirada. Gere outro código no Mac.",
        signal_http_409: "Esta transmissão já foi vinculada a um receptor. Pare e reinicie no Mac.",
        signal_http_403: "Servidor recusou a origem. Use a página oficial BX no GitHub Pages.",
        signal_http_404: "Servidor ainda não possui a rota de sinalização P2P.",
        signal_http_503: "Servidor de sinalização indisponível.",
        signal_network: "Sinalização indisponível. Confira internet, HTTPS e o servidor de teste.",
        signal_timeout: "Servidor de sinalização não respondeu.",
        ice_timeout: "Seu navegador não conseguiu completar a descoberta de rede WebRTC.",
        bad_offer: "Recebida uma oferta WebRTC inválida. Gere outra transmissão."
      };
      stop(reasons[error.message] || "Erro no teste P2P. Confira a conexão e gere outro código.");
    }
  });
  window.addEventListener("bxremote:media-preempt", event => {
    if (event.detail?.previous === "p2p") {
      stop("Recepção P2P encerrada: outro fluxo assumiu o player.");
    }
  });
  leave.addEventListener("click", () => stop());
  audio.addEventListener("click", () => {
    if (!audioReady || !video.srcObject ||
        !video.srcObject.getAudioTracks().some(t => t.readyState !== "ended")) {
      report("Ainda não foi recebida uma trilha de áudio do Mac. Algumas capturas de janela não incluem som.");
      return;
    }
    video.muted = false;
    video.volume = 1;
    video.play().then(() => {
      report("Reprodução habilitada. Confirme se o áudio está audível no celular.");
    }).catch(() => {
      video.muted = true;
      report("O navegador bloqueou o som. Toque novamente em Ativar áudio.");
    });
  });
  window.addEventListener("pagehide", () => stop("Sessão P2P encerrada."));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && session) stop("Sessão P2P encerrada ao deixar o navegador.");
  });
  leave.disabled = true;
  audio.disabled = true;
})();
