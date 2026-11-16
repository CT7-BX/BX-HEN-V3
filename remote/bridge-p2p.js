/* BX-REMOTE-PLAY — real, user-consented WebRTC screen-share bridge.
 * First PS4 image pilot: a Mac opens an independent Chiaki client, then
 * explicitly shares that client window/tab. Media goes peer-to-peer between
 * browsers; Cloudflare only stores short-lived SDP signaling. No PKG video.
 * Does not provide console controls or remote video when the Mac is off.
 */
(function (root, factory) {
  "use strict";
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.BXPeerVideo = core;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const SIGNALING_ORIGIN = "https://bx-remote-link.4rt949zpj8.workers.dev";
  const STUN = [{ urls: "stun:stun.l.google.com:19302" }];
  const CODE_RE = /^[0-9a-f]{64}$/;
  const MAX_SDP = 20000;
  const JOIN_TIMEOUT_MS = 180000;

  function validCode(input) {
    return typeof input === "string" && CODE_RE.test(input.trim().toLowerCase())
      ? input.trim().toLowerCase() : null;
  }
  function validSdp(sdp) {
    return typeof sdp === "string" && sdp.length >= 12 && sdp.length <= MAX_SDP &&
      /^v=0\r?\n/.test(sdp) && sdp.includes("m=video");
  }
  async function waitForIce(peer, signal, timeoutMs = 13000) {
    if (peer.iceGatheringState === "complete") return;
    await new Promise((resolve, reject) => {
      let finished = false;
      let timer;
      const done = error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        peer.removeEventListener("icegatheringstatechange", changed);
        signal.removeEventListener("abort", aborted);
        if (error) reject(error);
        else resolve();
      };
      const changed = () => {
        if (peer.iceGatheringState === "complete") done();
      };
      const aborted = () => done(new Error("cancelled"));
      timer = setTimeout(() => done(new Error("ice_timeout")), timeoutMs);
      peer.addEventListener("icegatheringstatechange", changed);
      signal.addEventListener("abort", aborted, { once: true });
      if (signal.aborted) aborted();
      else changed();
    });
  }
  function client({ fetcher, timeoutMs = 12000 } = {}) {
    const request = fetcher || ((...args) => fetch(...args));
    async function signal(method, path, { body, code, abortSignal } = {}) {
      if (!/^\/v1\/media\/(offer|answer|close)$/.test(path))
        throw new Error("bad_path");
      if (code && !validCode(code)) throw new Error("invalid_code");
      const controller = new AbortController();
      const parentAbort = () => controller.abort();
      if (abortSignal?.aborted) controller.abort();
      abortSignal?.addEventListener("abort", parentAbort, { once: true });
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await request(SIGNALING_ORIGIN + path, {
          method, mode: "cors", credentials: "omit", redirect: "error",
          cache: "no-store", referrerPolicy: "no-referrer",
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(code ? { Authorization: "Bearer " + code } : {})
          },
          signal: controller.signal
        });
        if (response.status !== 200) {
          const status = response.status;
          throw new Error("signal_http_" + status);
        }
        const value = await response.json();
        if (!value || typeof value !== "object") throw new Error("bad_response");
        return value;
      } catch (error) {
        if (abortSignal?.aborted) throw new Error("cancelled");
        if (controller.signal.aborted) throw new Error("signal_timeout");
        if (error instanceof TypeError) throw new Error("signal_network");
        throw error;
      } finally {
        clearTimeout(timeout);
        abortSignal?.removeEventListener("abort", parentAbort);
      }
    }
    return Object.freeze({
      create: sdp => signal("POST", "/v1/media/offer", { body: { type: "offer", sdp } }),
      offer: (code, abortSignal) => signal("GET", "/v1/media/offer", { code, abortSignal }),
      answer: (code, sdp, abortSignal) => signal("POST", "/v1/media/answer", {
        code, body: { type: "answer", sdp }, abortSignal
      }),
      poll: (code, abortSignal) => signal("GET", "/v1/media/answer", { code, abortSignal }),
      close: code => signal("POST", "/v1/media/close", { code, body: {} })
    });
  }
  function createBroadcast({ signaling = client(), onStatus = () => {},
    onCode = () => {}, onInput = () => {}, onInputStatus = () => {},
    inputProtocol = typeof globalThis === "object" ? globalThis.BXInputTransport : null,
    getScreen, peerFactory, setDelay = ms => new Promise(resolve => setTimeout(resolve,ms)) } = {}) {
    const createPeer = peerFactory || (() => new RTCPeerConnection({ iceServers: STUN }));
    const capture = getScreen || (() => navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 }, audio: true
    }));
    let controller = null, stream = null, peer = null, code = null, active = false;
    let inputChannel = null, inputReceiver = null;
    function setupControls() {
      if (!inputProtocol || typeof peer.createDataChannel !== "function") return;
      // Create before the SDP offer so the data m-line is negotiated.
      const channel = peer.createDataChannel(inputProtocol.LABEL, {
        ordered: false, maxRetransmits: 0
      });
      inputChannel = channel;
      inputReceiver = inputProtocol.createReceiver({ onInput,
        onStatus:reason => {
          if (active) onInputStatus(reason);
        }
      });
      channel.onopen = () => {
        if (active && channel === inputChannel)
          onInputStatus("channel_open");
      };
      channel.onclose = () => {
        if (channel !== inputChannel) return;
        inputReceiver?.stop();
        if (active) onInputStatus("channel_closed");
      };
      channel.onmessage = event => {
        if (!active || channel !== inputChannel || !inputReceiver ||
            typeof event.data !== "string") return;
        if (inputReceiver.receive(event.data) && channel.readyState === "open") {
          try {
            if (channel.bufferedAmount < 32768)
              channel.send(inputProtocol.encodeAck(inputReceiver.lastSequence()));
          } catch {}
        }
      };
    }
    async function start() {
      if (active) throw new Error("already_active");
      active = true;
      controller = new AbortController();
      try {
        onStatus("Selecione somente a janela ou aba do Chiaki. Compartilhamento mediante autorização do navegador.");
        stream = await capture();
        if (!active || controller.signal.aborted) throw new Error("cancelled");
        if (!stream || !stream.getVideoTracks?.().length) throw new Error("no_video_track");
        peer = createPeer();
        for (const track of stream.getTracks()) peer.addTrack(track, stream);
        setupControls();
        for (const track of stream.getVideoTracks()) {
          track.addEventListener?.("ended", () => stop());
        }
        peer.onconnectionstatechange = () => {
          if (!active) return;
          if (peer.connectionState === "connected")
            onStatus("Vídeo WebRTC conectado ao outro navegador. Confirme imagem e áudio no celular.");
          else if (peer.connectionState === "failed")
            onStatus("Ligação WebRTC falhou. Tente na mesma rede Wi-Fi; talvez precise de TURN.");
          else if (peer.connectionState === "disconnected")
            onStatus("Ligação interrompida. Confira a rede e o navegador receptor.");
        };
        onStatus("Preparando transmissão local criptografada...");
        await peer.setLocalDescription(await peer.createOffer());
        await waitForIce(peer, controller.signal);
        if (!active) throw new Error("cancelled");
        const offer = peer.localDescription?.sdp;
        if (!validSdp(offer)) throw new Error("bad_offer");
        const result = await signaling.create(offer);
        if (!active) throw new Error("cancelled");
        if (!validCode(result.code)) throw new Error("invalid_code_from_server");
        code = result.code;
        onCode(code);
        onStatus("Código gerado. Digite ou cole no celular, na seção Receber imagem do Mac.");
        const deadline = Date.now() + JOIN_TIMEOUT_MS;
        while (active && Date.now() < deadline) {
          await setDelay(1800);
          if (!active) break;
          const state = await signaling.poll(code, controller.signal);
          if (state.status === "ready") {
            if (state.type !== "answer" || !validSdp(state.sdp))
              throw new Error("bad_answer");
            await peer.setRemoteDescription({ type: "answer", sdp: state.sdp });
            onStatus("Resposta recebida. Estabelecendo mídia P2P criptografada...");
            return true;
          }
          if (state.status !== "waiting") throw new Error("bad_response");
        }
        if (active) throw new Error("join_timeout");
        return false;
      } catch (error) {
        stop();
        throw error;
      }
    }
    function stop() {
      if (!active && !stream && !peer) return;
      active = false;
      if (controller) controller.abort();
      if (inputReceiver) {
        inputReceiver.stop();
        inputReceiver = null;
      }
      if (inputChannel) {
        inputChannel.onopen = null;
        inputChannel.onclose = null;
        inputChannel.onmessage = null;
        try { inputChannel.close(); } catch {}
        inputChannel = null;
      }
      if (peer) {
        peer.onconnectionstatechange = null;
        try { peer.close(); } catch {}
        peer = null;
      }
      if (stream) {
        for (const track of stream.getTracks()) try { track.stop(); } catch {}
        stream = null;
      }
      if (code) {
        const old = code;
        code = null;
        void signaling.close(old).catch(() => {});
      }
      onCode(null);
    }
    return Object.freeze({ start, stop });
  }
  function createViewer({ signaling = client(), onStatus = () => {},
    onStream = () => {}, onInputStatus = () => {}, onInputAck = () => {},
    inputProtocol = typeof globalThis === "object" ? globalThis.BXInputTransport : null,
    peerFactory, streamFactory } = {}) {
    const createPeer = peerFactory || (() => new RTCPeerConnection({ iceServers: STUN }));
    const createStream = streamFactory || (() => new MediaStream());
    let active = false, peer = null, controller = null, code = null;
    let inputChannel = null, lastInputSeq = 0;
    function sendInput(state) {
      if (!active || !inputProtocol || !inputChannel ||
          inputChannel.readyState !== "open" ||
          inputChannel.bufferedAmount > 32768) return false;
      try {
        const frame = inputProtocol.encode(state, ++lastInputSeq);
        inputChannel.send(frame);
        return true;
      } catch { return false; }
    }
    async function start(rawCode) {
      if (active) throw new Error("already_active");
      code = validCode(rawCode);
      if (!code) throw new Error("invalid_code");
      active = true;
      controller = new AbortController();
      try {
        onStatus("Solicitando transmissão temporária do Mac...");
        const offer = await signaling.offer(code, controller.signal);
        if (offer.type !== "offer" || !validSdp(offer.sdp)) throw new Error("bad_offer");
        if (!active) throw new Error("cancelled");
        const current = createPeer();
        peer = current;
        if (inputProtocol) {
          current.ondatachannel = event => {
            if (!active || peer !== current) return;
            const channel = event.channel;
            if (!channel || channel.label !== inputProtocol.LABEL) {
              try { channel?.close(); } catch {}
              return;
            }
            inputChannel = channel;
            channel.onopen = () => {
              if (active && inputChannel === channel)
                onInputStatus("channel_open");
            };
            channel.onmessage = e => {
              if (!active || inputChannel !== channel) return;
              const seq = inputProtocol.decodeAck(e.data);
              if (seq !== null && seq <= lastInputSeq) onInputAck(seq);
            };
            channel.onclose = () => {
              if (inputChannel !== channel) return;
              if (active) onInputStatus("channel_closed");
              inputChannel = null;
            };
            if (channel.readyState === "open") onInputStatus("channel_open");
          };
        }
        const stream = createStream();
        peer.ontrack = event => {
          if (!active || current !== peer || !event.track) return;
          if (!stream.getTracks().some(track => track.id === event.track.id)) {
            stream.addTrack(event.track);
          }
          onStream(stream);
          onStatus("Trilha recebida. Aguardando quadros e som reais.");
        };
        peer.onconnectionstatechange = () => {
          if (!active || current !== peer) return;
          if (peer.connectionState === "connected")
            onStatus("Canal WebRTC conectado. Confira vídeo e áudio no player.");
          else if (peer.connectionState === "failed")
            onStatus("Conexão P2P falhou. Teste na mesma rede e verifique o firewall.");
          else if (peer.connectionState === "disconnected")
            onStatus("Conexão com o transmissor foi interrompida.");
        };
        await peer.setRemoteDescription({ type: "offer", sdp: offer.sdp });
        await peer.setLocalDescription(await peer.createAnswer());
        await waitForIce(peer, controller.signal);
        if (!active) throw new Error("cancelled");
        const answer = peer.localDescription?.sdp;
        if (!validSdp(answer)) throw new Error("bad_answer");
        await signaling.answer(code, answer, controller.signal);
        if (!active) throw new Error("cancelled");
        onStatus("Resposta WebRTC enviada ao Mac. Aguardando a conexão de mídia...");
        return true;
      } catch (error) {
        stop();
        throw error;
      }
    }
    function stop() {
      if (!active) return;
      // Release controls while the data channel is still live.
      if (inputProtocol && inputChannel) sendInput(inputProtocol.neutral());
      active = false;
      if (controller) controller.abort();
      if (inputChannel) {
        inputChannel.onopen = null;
        inputChannel.onmessage = null;
        inputChannel.onclose = null;
        try { inputChannel.close(); } catch {}
        inputChannel = null;
      }
      if (peer) {
        peer.ontrack = null;
        peer.ondatachannel = null;
        peer.onconnectionstatechange = null;
        try { peer.close(); } catch {}
        peer = null;
      }
      onInputStatus("channel_closed");
      onStream(null);
      // Viewer does not revoke the signaling room while sender is awaiting
      // the answer; sender remains in control of its capture session.
      code = null;
    }
    return Object.freeze({ start, stop, sendInput,
      inputConnected: () => Boolean(inputChannel && inputChannel.readyState === "open") });
  }
  return Object.freeze({ SIGNALING_ORIGIN, validCode, validSdp, client, waitForIce,
    createBroadcast, createViewer });
});
