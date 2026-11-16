(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const game = window.BXRemoteGame;
  const padLib = window.BXRemoteController;
  if (!game || !padLib) {
    console.error("BX-REMOTE-PLAY: controller modules unavailable.");
    return;
  }

  const stage = $("stage");
  const overlay = $("touchOverlay");
  const video = $("streamVideo");
  const mode = $("touchMode");
  const quality = $("quality");
  const route = $("connectionRoute");
  const touchOpacity = $("touchOpacity");
  const touchSize = $("touchSize");
  function applyTouchAppearance() {
    const alpha = Math.min(90, Math.max(35, Number(touchOpacity.value) || 65));
    const scale = Math.min(1.12, Math.max(.85, Number(touchSize.value) || 1));
    stage.style.setProperty("--touch-alpha", (alpha / 100).toFixed(2));
    stage.style.setProperty("--touch-scale", scale.toFixed(2));
    $("touchOpacityValue").textContent = alpha + "% de opacidade";
  }
  touchOpacity.addEventListener("input", applyTouchAppearance);
  touchSize.addEventListener("change", applyTouchAppearance);
  applyTouchAppearance();
  const touch = game.touchState();
  const coarse = Boolean((window.matchMedia && matchMedia("(pointer: coarse)").matches)
    || navigator.maxTouchPoints > 0);
  const buttons = Array.from(overlay.querySelectorAll("[data-button]"));
  const stickElements = Array.from(overlay.querySelectorAll("[data-stick]"));
  const buttonPointers = new Map();
  const resetStickPointers = [];

  let ws = null;
  let authorized = false;
  let peerConnected = false;
  let nextSeq = 0;
  let lastSent = 0;
  let lastInputSignature = "";
  let lastPadName = "";
  let useTouch = false;
  let localCinema = false;
  let wakeLock = null;
  let sessionTimer = null;
  let activePing = 0;
  const pings = new Map();
  const rtts = [];
  let mediaAttached = false;

  function log(message) {
    $("gameLog").textContent = message;
  }

  function getGamepad() {
    try {
      if (typeof navigator.getGamepads !== "function") return null;
      return padLib.readSnapshot(padLib.preferredGamepad(navigator.getGamepads()));
    } catch {
      return null;
    }
  }

  function refreshIndicators(snapshot) {
    const name = snapshot ? snapshot.id : "";
    if (name !== lastPadName) {
      lastPadName = name;
      $("padStatus").textContent = name ? "Controle físico detectado" : "Sem controle físico";
      $("gamepadLabel").textContent = name ? "Controle físico: " + name : "Controle físico não identificado";
    }
    $("gamepadIndicator").classList.toggle("ok", Boolean(snapshot));
    const visible = game.showTouch(mode.value, coarse, Boolean(snapshot));
    if (useTouch !== visible) {
      useTouch = visible;
      overlay.hidden = !visible;
      if (!visible) resetTouch();
    }
    $("touchIndicator").classList.toggle("ok", visible);
    $("touchLabel").textContent = visible ? "Controles virtuais disponíveis" : "Controles virtuais ocultos";
  }

  function resetStick(el) {
    const side = el.dataset.stick;
    touch[side].x = 0;
    touch[side].y = 0;
    el.querySelector(".knob").style.transform = "translate(-50%,-50%)";
  }

  function resetTouch() {
    touch.pressed.clear();
    buttonPointers.forEach(pointers => pointers.clear());
    buttons.forEach(button => button.classList.remove("held"));
    resetStickPointers.forEach(reset => reset());
    stickElements.forEach(resetStick);
    lastInputSignature = "";
  }

  // Every virtual button supports independent pointers so combinations work
  // with multi-touch (e.g. holding R2 while pressing Cruz).
  buttons.forEach((button) => {
    const code = Number(button.dataset.button);
    const pointers = new Set();
    buttonPointers.set(button, pointers);
    function release(event) {
      pointers.delete(event.pointerId);
      if (!pointers.size) {
        touch.pressed.delete(code);
        button.classList.remove("held");
      }
      maybeSend();
    }
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      try { button.setPointerCapture(event.pointerId); } catch {}
      pointers.add(event.pointerId);
      touch.pressed.add(code);
      button.classList.add("held");
      maybeSend();
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("blur", () => {
      pointers.clear();
      touch.pressed.delete(code);
      button.classList.remove("held");
    });
  });

  stickElements.forEach((el) => {
    const side = el.dataset.stick;
    let activePointer = null;
    let tapOrigin = null;
    let previousTap = 0;
    const stickButton = side === "left" ? 10 : 11;
    resetStickPointers.push(() => {
      activePointer = null;
      tapOrigin = null;
      previousTap = 0;
      resetStick(el);
    });

    function update(event) {
      if (activePointer !== event.pointerId) return;
      const rect = el.getBoundingClientRect();
      const radius = Math.max(1, Math.min(rect.width, rect.height) / 2 - 18);
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      const value = game.joystick(x, y, radius);
      touch[side].x = value.x;
      touch[side].y = value.y;
      el.querySelector(".knob").style.transform =
        "translate(-50%,-50%) translate(" + (value.x * radius).toFixed(1) +
        "px," + (value.y * radius).toFixed(1) + "px)";
      maybeSend();
    }
    function release(event) {
      if (activePointer !== event.pointerId) return;
      const elapsed = performance.now() - (tapOrigin?.at ?? -1000);
      const travel = tapOrigin
        ? Math.hypot(event.clientX - tapOrigin.x, event.clientY - tapOrigin.y)
        : Infinity;
      const shortTap = elapsed < 240 && travel < 14;
      activePointer = null;
      resetStick(el);
      if (shortTap) {
        const now = performance.now();
        if (now - previousTap < 380) {
          // Two quick taps reproduce L3 / R3 clicks from the mobile Remote Play UI.
          touch.pressed.add(stickButton);
          maybeSend();
          setTimeout(() => {
            touch.pressed.delete(stickButton);
            maybeSend();
          }, 95);
          previousTap = 0;
        } else {
          previousTap = now;
        }
      } else {
        previousTap = 0;
      }
      tapOrigin = null;
      maybeSend();
    }
    el.addEventListener("pointerdown", (event) => {
      if (activePointer !== null) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      activePointer = event.pointerId;
      tapOrigin = { x: event.clientX, y: event.clientY, at: performance.now() };
      try { el.setPointerCapture(event.pointerId); } catch {}
      update(event);
    });
    el.addEventListener("pointermove", update);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("lostpointercapture", release);
  });

  function updateQuality() {
    const choice = game.qualityTargets[quality.value] || game.qualityTargets.balanced;
    $("qualityNote").textContent =
      "Meta " + choice.height + "p, " + choice.fps + " fps, até " +
      (choice.kbps / 1000).toFixed(1) +
      " Mb/s. Ainda não muda a imagem: falta o gateway Remote Play.";
  }

  function updateRoute() {
    const choices = {
      auto: "Preferir acesso direto quando possível; usar relay se necessário (planejado).",
      lan: "Na mesma rede, a meta é usar caminho direto para reduzir atrasos (pendente).",
      remote: "Em outra rede, o PS4 precisará de saída autenticada e relay/TURN (pendente)."
    };
    $("routeNote").textContent = choices[route.value] || choices.auto;
  }

  quality.addEventListener("change", updateQuality);
  route.addEventListener("change", updateRoute);
  mode.addEventListener("change", () => refreshIndicators(getGamepad()));
  $("toggleTouch").addEventListener("click", () => {
    mode.value = mode.value === "touch" ? "auto" : "touch";
    refreshIndicators(getGamepad());
  });
  updateQuality();
  updateRoute();

  function browserIsIPhone() {
    return /iPhone|iPod/i.test(navigator.userAgent);
  }

  if (browserIsIPhone()) {
    $("fullscreenHint").textContent =
      "iPhone: o Safari pode manter barras na tela. Para uma experiência mais ampla, " +
      "adicione este site à Tela de Início e abra o atalho; gire o aparelho para paisagem.";
  } else {
    $("fullscreenHint").textContent =
      "Tela cheia usa a API do navegador quando disponível. Pressione Esc para sair.";
  }

  async function releaseWakeLock() {
    if (wakeLock) {
      try { await wakeLock.release(); } catch {}
      wakeLock = null;
    }
  }

  async function requestWakeLock() {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); }
    catch { /* Not supported or permission denied; play remains usable. */ }
  }

  function exitCinema() {
    localCinema = false;
    stage.classList.remove("cinema");
    document.body.classList.remove("cinema");
    $("fullscreenBtn").textContent = "⛶ Tela cheia";
    releaseWakeLock();
  }

  $("fullscreenBtn").addEventListener("click", async () => {
    if (document.fullscreenElement === stage) {
      try { await document.exitFullscreen(); } catch { exitCinema(); }
      return;
    }
    if (localCinema) {
      exitCinema();
      return;
    }
    let native = false;
    if (typeof stage.requestFullscreen === "function") {
      try {
        await stage.requestFullscreen();
        native = Boolean(document.fullscreenElement);
      } catch { /* iPhone Safari may reject element fullscreen. */ }
    }
    if (!native) {
      localCinema = true;
      stage.classList.add("cinema");
      document.body.classList.add("cinema");
    }
    $("fullscreenBtn").textContent = "↙ Sair da tela cheia";
    await requestWakeLock();
  });

  $("exitFullscreenInStage").addEventListener("click", async () => {
    if (document.fullscreenElement === stage && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch {}
    }
    exitCinema();
  });

  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === stage) {
      $("fullscreenBtn").textContent = "↙ Sair da tela cheia";
    } else if (!localCinema) {
      $("fullscreenBtn").textContent = "⛶ Tela cheia";
      releaseWakeLock();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && localCinema) exitCinema();
  });

  function updateRelayStatus(message, online) {
    $("relayStatus").textContent = message;
    $("relayLabel").textContent = message;
    $("relayIndicator").classList.toggle("ok", online);
    $("relayConnect").disabled = Boolean(ws);
    $("relayDisconnect").disabled = !ws;
    $("consoleBadge").textContent = peerConnected
      ? "Simulador conectado · sem PS4" : "PS4 não conectado";
    $("consoleBadge").classList.toggle("live", peerConnected);
  }

  function closeRelay(reason) {
    const existing = ws;
    ws = null;
    authorized = false;
    peerConnected = false;
    pings.clear();
    rtts.length = 0;
    nextSeq = 0;
    lastInputSignature = "";
    lastSent = 0;
    $("lagBadge").textContent = "RTT relay: —";
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = null;
    updateRelayStatus("Relay desconectado", false);
    if (existing) {
      existing.onopen = null;
      existing.onmessage = null;
      existing.onerror = null;
      existing.onclose = null;
      try { existing.close(); } catch {}
    }
    if (reason) log(reason);
  }

  function handleRelayFrame(frame) {
    if (frame?.type === "authenticated" && frame.role === "player") {
      authorized = true;
      if (sessionTimer) clearTimeout(sessionTimer);
      sessionTimer = null;
      updateRelayStatus("Relay autenticado, sem simulador", true);
      return;
    }
    if (!authorized) return;
    if (frame?.type === "peer") {
      peerConnected = Boolean(frame.connected);
      updateRelayStatus(peerConnected ? "Simulador ligado ao relay" : "Relay sem simulador", true);
      return;
    }
    if (frame?.type === "status") {
      log("Simulador: " + String(frame.state || "desconhecido").slice(0, 20) +
          ". Nenhum PS4 real conectado.");
      return;
    }
    if (frame?.type === "pong" && pings.has(frame.nonce)) {
      const elapsed = performance.now() - pings.get(frame.nonce);
      pings.delete(frame.nonce);
      rtts.push(elapsed);
      if (rtts.length > 9) rtts.shift();
      const value = game.median(rtts);
      if (value !== null) $("lagBadge").textContent = "RTT relay: " + Math.round(value) + " ms";
    }
  }

  function connectRelay(endpoint, token) {
    endpoint = game.validRelayEndpoint(endpoint);
    if (!endpoint) {
      log("Endereço inválido: use wss://.../v1/link (ws:// somente em localhost).");
      return;
    }
    if (typeof token !== "string" || token.length < 32) {
      log("O token do jogador precisa ter pelo menos 32 caracteres.");
      return;
    }
    closeRelay();
    let client;
    try { client = new WebSocket(endpoint); }
    catch {
      log("O navegador não conseguiu criar a conexão WebSocket.");
      return;
    }
    ws = client;
    updateRelayStatus("Conectando ao relay…", false);
    sessionTimer = setTimeout(() => {
      if (ws === client && !authorized) closeRelay("Tempo esgotado ao autenticar o relay.");
    }, 8000);

    client.onopen = () => {
      if (ws !== client) return;
      // WebSocket cannot set Authorization headers in browsers. Send the secret
      // in the first application-level frame, never in the URL.
      client.send(JSON.stringify({ type: "hello", role: "player", token: token }));
      $("relayToken").value = "";
    };
    client.onmessage = event => {
      if (ws !== client) return;
      let frame;
      try { frame = JSON.parse(event.data); } catch { return; }
      handleRelayFrame(frame);
    };
    client.onerror = () => {
      if (ws === client) log("Falha de transporte. Confira WSS, origem e credenciais.");
    };
    client.onclose = () => {
      if (ws === client) closeRelay("Sessão de laboratório encerrada.");
    };
  }
  $("relayConnect").addEventListener("click", () => {
    const endpoint = $("relayEndpoint").value.trim();
    const token = $("relayToken").value;
    $("relayToken").value = "";
    connectRelay(endpoint, token);
  });
  window.addEventListener("bxremote:paired", event => {
    const endpoint = event.detail?.endpoint;
    const token = event.detail?.playerToken;
    connectRelay(endpoint, token);
  });
  $("relayDisconnect").addEventListener("click", () => closeRelay("Desconectado manualmente."));

  function maybeSend(forceNeutral) {
    if (!ws || !authorized || !peerConnected || ws.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (!forceNeutral && (document.hidden || now - lastSent < 17)) return;
    const snapshot = getGamepad();
    const data = forceNeutral
      ? game.neutral()
      : game.input(snapshot, touch, mode.value, coarse);
    // Send a changed input state immediately, but avoid flooding the relay
    // with 55 identical frames each second. Keep 4 Hz refresh for robustness.
    const signature = JSON.stringify([data.buttons, data.axes, data.triggers]);
    if (!forceNeutral && signature === lastInputSignature && now - lastSent < 240) return;
    if (ws.bufferedAmount > 64 * 1024) {
      closeRelay("Conexão muito lenta; controles interrompidos por segurança.");
      return;
    }
    ws.send(JSON.stringify({
      type: "input",
      seq: ++nextSeq,
      buttons: data.buttons,
      axes: data.axes,
      triggers: data.triggers
    }));
    lastSent = now;
    lastInputSignature = signature;
  }

  function resetOnBlur() {
    if (ws && authorized && peerConnected) maybeSend(true);
    resetTouch();
  }

  window.addEventListener("blur", resetOnBlur);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resetOnBlur();
      releaseWakeLock();
    } else if (localCinema || document.fullscreenElement === stage) {
      requestWakeLock();
    }
  });
  window.addEventListener("pagehide", () => {
    resetOnBlur();
    closeRelay();
    releaseWakeLock();
  });

  // Only network round-trip to the relay; do NOT label as video latency or PS4 latency.
  setInterval(() => {
    if (!ws || !authorized || ws.readyState !== WebSocket.OPEN || document.hidden) return;
    const nonce = ++activePing;
    pings.set(nonce, performance.now());
    for (const key of pings.keys()) {
      if (nonce - key > 5) pings.delete(key);
    }
    ws.send(JSON.stringify({ type: "ping", nonce }));
  }, 1000);

  setInterval(() => {
    const snapshot = getGamepad();
    refreshIndicators(snapshot);
    maybeSend(false);
  }, 18);
  refreshIndicators(getGamepad());
  window.addEventListener("gamepadconnected", () => refreshIndicators(getGamepad()));
  window.addEventListener("gamepaddisconnected", () => refreshIndicators(getGamepad()));

  // Media integration seam for a future Chiaki/Remote Play bridge.
  // An external, trusted gateway must explicitly provide a MediaStream.
  // Attaching a stream does not prove that its source is a PS4.
  function attachMediaStream(stream) {
    if (stream !== null && (typeof MediaStream === "undefined" || !(stream instanceof MediaStream))) {
      throw new TypeError("Expected a MediaStream or null.");
    }
    video.srcObject = stream;
    mediaAttached = Boolean(stream);
    $("emptyState").hidden = mediaAttached;
    $("mediaIndicator").classList.toggle("ok", mediaAttached);
    $("mediaLabel").textContent = mediaAttached
      ? "Fonte de vídeo experimental anexada; origem PS4 não verificada"
      : "Vídeo PS4 não integrado";
    if (stream) {
      video.play().catch(() => {
        log("O navegador exige interação para iniciar áudio e vídeo. Toque na tela e tente novamente.");
      });
    } else {
      video.pause();
    }
  }

  window.BXRemotePlayer = Object.freeze({
    attachMediaStream: attachMediaStream,
    getPreferences: () => Object.freeze({
      quality: quality.value, route: route.value, touch: mode.value,
      touchOpacity: Number(touchOpacity.value), touchSize: Number(touchSize.value)
    }),
    disconnect: () => closeRelay()
  });
})();
