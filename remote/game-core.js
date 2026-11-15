(function (root) {
  "use strict";

  // Browser-only state processing. Never talks to a PS4 on its own.
  const QUALITY_TARGETS = Object.freeze({
    economy: Object.freeze({ label: "Economia", width: 960, height: 540, fps: 30, kbps: 3000 }),
    balanced: Object.freeze({ label: "Equilibrado", width: 1280, height: 720, fps: 60, kbps: 8000 }),
    quality: Object.freeze({ label: "Qualidade", width: 1920, height: 1080, fps: 60, kbps: 15000 })
  });

  function clamp(number, min, max) {
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : 0;
  }

  function joystick(dx, dy, radius) {
    const r = Math.max(1, Number.isFinite(radius) ? radius : 48);
    const nx = dx / r;
    const ny = dy / r;
    const length = Math.hypot(nx, ny);
    const scale = length > 1 ? 1 / length : 1;
    const x = clamp(nx * scale, -1, 1);
    const y = clamp(ny * scale, -1, 1);
    const deadzone = 0.065;
    return {
      x: Math.abs(x) < deadzone ? 0 : Math.round(x * 100) / 100,
      y: Math.abs(y) < deadzone ? 0 : Math.round(y * 100) / 100
    };
  }

  function showTouch(mode, coarsePointer, hasGamepad) {
    if (mode === "touch") return true;
    if (mode === "off") return false;
    return Boolean(coarsePointer && !hasGamepad);
  }

  function touchState() {
    return { pressed: new Set(), left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
  }

  function fromTouch(state) {
    const pressed = Array.from(state.pressed).filter(i => Number.isInteger(i) && i >= 0 && i <= 17).sort((a, b) => a - b);
    return {
      buttons: pressed,
      axes: [state.left.x, state.left.y, state.right.x, state.right.y].map(v => clamp(v, -1, 1)),
      triggers: [state.pressed.has(6) ? 1 : 0, state.pressed.has(7) ? 1 : 0]
    };
  }

  function fromGamepad(snapshot) {
    const b = snapshot.buttons || [];
    const pressed = b.filter(x => x && x.pressed).map(x => x.index)
      .filter(i => Number.isInteger(i) && i >= 0 && i <= 17).sort((a, b) => a - b);
    return {
      buttons: pressed,
      axes: Array.from({ length: 4 }, (_, i) => clamp((snapshot.axes || [])[i], -1, 1)),
      triggers: [6, 7].map(i => clamp(b[i]?.value, 0, 1))
    };
  }

  function neutral() {
    return { buttons: [], axes: [0, 0, 0, 0], triggers: [0, 0] };
  }

  function input(snapshot, touch, mode, coarsePointer) {
    if (snapshot && mode !== "touch") return fromGamepad(snapshot);
    if (showTouch(mode, coarsePointer, Boolean(snapshot))) return fromTouch(touch);
    return neutral();
  }

  function validRelayEndpoint(raw) {
    let url;
    try { url = new URL(raw); } catch { return null; }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const secure = url.protocol === "wss:";
    if (!secure && !(local && url.protocol === "ws:")) return null;
    if (url.pathname !== "/v1/link" || url.search || url.hash || url.username || url.password) return null;
    return url.href;
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = values.filter(v => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  const api = Object.freeze({
    qualityTargets: QUALITY_TARGETS,
    joystick, showTouch, touchState, fromTouch, fromGamepad,
    neutral, input, validRelayEndpoint, median
  });
  root.BXRemoteGame = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
