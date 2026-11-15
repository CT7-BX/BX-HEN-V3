(function (root) {
  "use strict";

  // The controller module only interprets local Gamepad API data.
  // It does not connect to a console or transmit commands over the network.
  const LABELS = [
    "Cruz", "Círculo", "Quadrado", "Triângulo",
    "L1", "R1", "L2", "R2", "Share", "Options",
    "L3", "R3", "Cima", "Baixo", "Esquerda", "Direita",
    "PS", "Touchpad"
  ];

  function clamp(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : 0;
  }

  function normalizeAxis(value) {
    const axis = clamp(value, -1, 1);
    return Math.abs(axis) < 0.06 ? 0 : Math.round(axis * 100) / 100;
  }

  function readSnapshot(gamepad) {
    if (!gamepad) return null;
    const sourceButtons = Array.from(gamepad.buttons || []);
    return {
      id: String(gamepad.id || "Controle sem identificação"),
      index: Number(gamepad.index) || 0,
      mapping: gamepad.mapping === "standard" ? "standard" : "unknown",
      connected: gamepad.connected !== false,
      axes: Array.from(gamepad.axes || []).slice(0, 4).map(normalizeAxis),
      buttons: LABELS.map(function (label, index) {
        const raw = sourceButtons[index];
        return {
          label: label,
          index: index,
          pressed: Boolean(raw && raw.pressed),
          value: raw ? clamp(raw.value, 0, 1) : 0
        };
      })
    };
  }

  function preferredGamepad(gamepads) {
    const connected = Array.from(gamepads || []).filter(function (pad) {
      return pad && pad.connected !== false;
    });
    return connected.find(function (pad) { return pad.mapping === "standard"; })
      || connected[0] || null;
  }

  const api = Object.freeze({
    labels: LABELS.slice(),
    normalizeAxis: normalizeAxis,
    readSnapshot: readSnapshot,
    preferredGamepad: preferredGamepad
  });

  root.BXRemoteController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
