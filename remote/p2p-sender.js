/* Publisher: Mac browser captures an explicitly selected Chiaki window/tab. */
(function () {
  "use strict";
  const api = window.BXPeerVideo;
  const $ = id => document.getElementById(id);
  const start = $("startShare"), stop = $("stopShare"), copy = $("copyCode");
  const code = $("roomCode"), status = $("shareStatus");
  if (!api || !start || !stop || !copy || !code || !status) return;
  let current = null;
  let serial = 0;
  function update(message) { status.textContent = message; }
  function finish(message = "Compartilhamento encerrado.") {
    serial++;
    if (current) {
      current.stop();
      current = null;
    }
    start.disabled = false;
    stop.disabled = true;
    copy.disabled = true;
    code.value = "";
    update(message);
  }
  start.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || !window.RTCPeerConnection) {
      update("Este navegador não permite captura da tela. Use Chrome ou Edge atualizado no Mac.");
      return;
    }
    finish();
    const id = ++serial;
    const sharing = api.createBroadcast({
      onCode: value => {
        if (id !== serial) return;
        code.value = value || "";
        copy.disabled = !value;
      },
      onStatus: message => { if (id === serial) update(message); }
    });
    current = sharing;
    start.disabled = true;
    stop.disabled = false;
    try {
      await sharing.start();
    } catch (error) {
      if (id !== serial) return;
      const messages = {
        NotAllowedError: "Você cancelou a permissão de compartilhamento. Nenhuma janela foi transmitida.",
        NotFoundError: "Nenhuma janela ou tela disponível para capturar.",
        NotReadableError: "O navegador não conseguiu capturar a janela selecionada.",
        no_video_track: "A fonte escolhida não forneceu vídeo.",
        signal_http_409: "Já existe uma sala de teste ativa no servidor. Encerre a sessão anterior ou tente depois.",
        signal_http_404: "Servidor ainda não possui a rota de sinalização P2P.",
        signal_http_503: "Servidor de sinalização fora do ar.",
        signal_network: "Não foi possível contactar o servidor HTTPS de sinalização.",
        signal_timeout: "Servidor de sinalização não respondeu.",
        ice_timeout: "O navegador não conseguiu preparar a conexão WebRTC.",
        join_timeout: "O código de acesso expirou. Gere um novo código.",
        bad_offer: "O navegador não forneceu uma oferta WebRTC válida."
      };
      finish(messages[error.name] || messages[error.message] ||
        "Não foi possível iniciar a transmissão. Confira navegador, rede e permissões.");
    }
  });
  stop.addEventListener("click", () => finish());
  copy.addEventListener("click", async () => {
    if (!api.validCode(code.value)) return;
    try {
      await navigator.clipboard.writeText(code.value);
      update("Código copiado. Cole no celular em Receber imagem do Mac. Não compartilhe publicamente.");
    } catch {
      code.focus();
      code.select();
      update("Copie o código selecionado. Não publique em grupos nem em redes sociais.");
    }
  });
  window.addEventListener("pagehide", () => finish("Transmissão encerrada ao sair da página."));
  stop.disabled = true;
  copy.disabled = true;
})();
