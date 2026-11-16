/* Publisher: Mac browser captures an explicitly selected Chiaki window/tab. */
(function () {
  "use strict";
  const api = window.BXPeerVideo;
  const $ = id => document.getElementById(id);
  const start = $("startShare"), stop = $("stopShare"), copy = $("copyCode");
  const code = $("roomCode"), status = $("shareStatus");
  const inputStatus = $("senderControlStatus"), inputInfo = $("senderControlInput");
  if (!api || !start || !stop || !copy || !code || !status) return;
  let current = null;
  let serial = 0, inputFrames = 0, lastInputUpdate = 0;
  function update(message) { status.textContent = message; }
  function resetInput() {
    inputFrames = 0;
    lastInputUpdate = 0;
    if (inputStatus) inputStatus.textContent = "Canal de comandos não conectado.";
    if (inputInfo) inputInfo.textContent = "Nenhum comando recebido.";
  }
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
    resetInput();
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
      onStatus: message => { if (id === serial) update(message); },
      onInputStatus: state => {
        if (id !== serial || !inputStatus) return;
        inputStatus.textContent = state === "channel_open"
          ? "Canal de botões WebRTC conectado. Aguardando teste iniciado no iPhone."
          : state === "input_timeout"
            ? "Comandos interrompidos; todos os botões foram liberados automaticamente."
            : "Canal de botões desligado ou ainda não conectado.";
      },
      onInput: (frame, meta) => {
        if (id !== serial || !inputInfo) return;
        if (meta.reason === "received") inputFrames++;
        const now = performance.now();
        if (meta.reason === "received" && now - lastInputUpdate < 120) return;
        lastInputUpdate = now;
        const axes = frame.axes.map(v => v.toFixed(2)).join(", ");
        inputInfo.textContent = "Quadros recebidos: " + inputFrames +
          " | Botões: " + (frame.buttons.join(", ") || "nenhum") +
          " | Analógicos: [" + axes + "]" +
          (meta.reason === "received"
            ? " | Recebido pelo navegador Mac, NÃO pelo PS4."
            : " | Comandos zerados por segurança.");
      }
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
