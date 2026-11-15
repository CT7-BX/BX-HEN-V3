/**
 * BX-REMOTE-PLAY control relay v0.2 — RESEARCH ONLY.
 *
 * Connects one authenticated console-role socket with one authenticated
 * player-role socket for small, validated controller input frames.
 * No video/audio, no PS4 integration, and no arbitrary TCP/UDP tunnelling.
 * Designed to run behind a TLS terminating reverse proxy.
 *
 * Deliberately fails closed without unique, strong environment credentials.
 */
import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { createPairingStore } from "./pairing.mjs";
import { createPairingHttpHandler } from "./pair-http.mjs";

const MAX_JSON_BYTES = 4096;
const INPUT_HZ_LIMIT = 100;
const AUTH_TIMEOUT_MS = 5000;
const INPUT_STALE_MS = 450;
// A slow console must not accumulate seconds of outdated button commands.
const MAX_BUFFERED_BYTES = 64 * 1024;

export function safeTokenMatch(candidate, actual) {
  if (typeof candidate !== "string" || typeof actual !== "string") return false;
  const left = createHash("sha256").update(candidate).digest();
  const right = createHash("sha256").update(actual).digest();
  return timingSafeEqual(left, right);
}

function validateInput(frame) {
  if (frame?.type !== "input" || !Number.isSafeInteger(frame.seq) || frame.seq < 0
      || !Array.isArray(frame.buttons) || frame.buttons.length > 18
      || !Array.isArray(frame.axes) || frame.axes.length !== 4
      || !Array.isArray(frame.triggers) || frame.triggers.length !== 2) return null;
  const buttons = frame.buttons;
  const axes = frame.axes;
  const triggers = frame.triggers;
  if (!buttons.every(value => Number.isInteger(value) && value >= 0 && value <= 17)) return null;
  if (new Set(buttons).size !== buttons.length) return null;
  if (!axes.every(value => typeof value === "number" && Number.isFinite(value)
      && value >= -1 && value <= 1)) return null;
  if (!triggers.every(value => typeof value === "number" && Number.isFinite(value)
      && value >= 0 && value <= 1)) return null;
  return { type: "input", seq: frame.seq, buttons: [...buttons], axes: [...axes], triggers: [...triggers] };
}

function send(ws, frame) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
    ws.terminate();
    return;
  }
  ws.send(JSON.stringify(frame));
}

export function createRelay({
  consoleToken,
  playerToken,
  allowedOrigins = [],
  host = "127.0.0.1",
  port = 8765
} = {}) {
  if (typeof consoleToken !== "string" || consoleToken.length < 32
      || typeof playerToken !== "string" || playerToken.length < 32
      || safeTokenMatch(consoleToken, playerToken)) {
    throw new Error("Configure dois tokens distintos com pelo menos 32 caracteres.");
  }
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.every(s => typeof s === "string")) {
    throw new Error("allowedOrigins inválido.");
  }
  if (host !== "127.0.0.1" && host !== "::1" && allowedOrigins.length === 0) {
    throw new Error("Defina allowedOrigins antes de publicar um serviço.");
  }

  const peers = { console: null, player: null };
  const pairing = createPairingStore();
  const pairingHttp = createPairingHttpHandler({
    pairing, consoleToken, allowedOrigins,
    consoleOnline: () => Boolean(peers.console)
  });
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith("/v1/pair/")) {
      void pairingHttp(req, res).catch(() => {
        if (!res.headersSent) {
          res.writeHead(500, { "Cache-Control": "no-store", "Content-Type": "application/json" });
          res.end('{"error":"INTERNAL_ERROR"}');
        }
      });
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff" });
      res.end(JSON.stringify({ status: "ok", mode: "control-prototype" }));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
    res.end("Not found");
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_JSON_BYTES, perMessageDeflate: false });

  function resetConsole(reason) {
    // This is a simulation-only stop signal. A future native agent must
    // deliberately implement neutralisation on reception and on link loss.
    send(peers.console, { type: "reset", reason });
  }

  const idleMonitor = setInterval(() => {
    const player = peers.player;
    const session = player?.bxSession;
    if (session?.paired && !pairing.authorizedPlayer(session.pairToken)) {
      player.terminate();
      return;
    }
    if (!session || !session.lastInputAt || session.inputExpired) return;
    if (Date.now() - session.lastInputAt >= INPUT_STALE_MS) {
      session.inputExpired = true;
      resetConsole("stale_input");
    }
  }, 110);
  idleMonitor.unref?.();

  function publishPresence() {
    send(peers.console, { type: "peer", connected: Boolean(peers.player) });
    send(peers.player, { type: "peer", connected: Boolean(peers.console) });
  }
  function reject(socket, code = 4400) {
    try { socket.close(code, "rejected"); } catch { socket.terminate(); }
  }
  server.on("upgrade", (req, socket, head) => {
    let target;
    try { target = new URL(req.url, "http://localhost"); }
    catch { socket.destroy(); return; }
    const origin = req.headers.origin;
    // Do not allow secrets in the URL, even if a reverse proxy logs requests.
    if (target.pathname !== "/v1/link" || target.search || target.hash
        || (origin && !allowedOrigins.includes(origin))) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws) => {
    const session = {
      role: null, previousSeq: -1, windowStarted: Date.now(),
      messages: 0, lastInputAt: 0, inputExpired: false,
      paired: false, pairToken: null
    };
    ws.bxSession = session;
    const deadline = setTimeout(() => {
      if (!session.role) reject(ws, 4401);
    }, AUTH_TIMEOUT_MS);
    deadline.unref?.();

    ws.on("message", (payload, isBinary) => {
      if (isBinary || payload.length > MAX_JSON_BYTES) { reject(ws); return; }
      const now = Date.now();
      if (now - session.windowStarted >= 1000) {
        session.messages = 0;
        session.windowStarted = now;
      }
      if (++session.messages > INPUT_HZ_LIMIT) { reject(ws, 4429); return; }

      let frame;
      try { frame = JSON.parse(payload.toString("utf8")); }
      catch { reject(ws); return; }

      if (!session.role) {
        if (frame?.type !== "hello" || !["console", "player"].includes(frame.role)
            || typeof frame.token !== "string") { reject(ws, 4401); return; }
        const expected = frame.role === "console" ? consoleToken : playerToken;
        const staticMatch = safeTokenMatch(frame.token, expected);
        const pairedMatch = frame.role === "player" && pairing.authorizedPlayer(frame.token);
        if (!staticMatch && !pairedMatch) { reject(ws, 4401); return; }
        if (peers[frame.role]) { reject(ws, 4409); return; }
        session.role = frame.role;
        if (pairedMatch && !staticMatch) {
          session.paired = true;
          session.pairToken = frame.token;
        }
        peers[frame.role] = ws;
        // A newly attached console must begin with all buttons released.
        if (frame.role === "console") resetConsole("console_connected");
        clearTimeout(deadline);
        send(ws, { type: "authenticated", role: session.role, mode: "control-prototype" });
        publishPresence();
        return;
      }
      if (frame?.type === "ping" && Number.isSafeInteger(frame.nonce) && frame.nonce >= 0) {
        send(ws, { type: "pong", nonce: frame.nonce });
        return;
      }
      if (session.role === "player") {
        const input = validateInput(frame);
        if (!input || input.seq <= session.previousSeq) { reject(ws); return; }
        session.previousSeq = input.seq;
        session.lastInputAt = now;
        session.inputExpired = false;
        if (peers.console) send(peers.console, input);
      } else if (session.role === "console") {
        if (frame?.type === "status" && ["idle", "ready"].includes(frame.state)) {
          send(peers.player, { type: "status", state: frame.state });
        } else if (frame?.type === "ack" && Number.isSafeInteger(frame.seq)
            && frame.seq >= 0) {
          send(peers.player, { type: "ack", seq: frame.seq });
        } else {
          reject(ws);
        }
      }
    });
    ws.on("close", () => {
      clearTimeout(deadline);
      if (session.role && peers[session.role] === ws) {
        peers[session.role] = null;
        if (session.role === "player") {
          resetConsole("player_disconnected");
        } else {
          pairing.revoke();
          // An approved browser session must not survive console disconnect.
          if (peers.player?.bxSession?.paired) peers.player.terminate();
        }
        publishPresence();
      }
    });
    ws.on("error", () => {}); // Close handler cleans up; never expose secrets.
  });

  return {
    async listen() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      const address = server.address();
      return { host, port: address.port };
    },
    async close() {
      clearInterval(idleMonitor);
      for (const ws of wss.clients) ws.terminate();
      await new Promise(resolve => wss.close(resolve));
      if (server.listening) await new Promise(resolve => server.close(resolve));
    }
  };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  const raw = process.env.BX_RELAY_ALLOWED_ORIGINS || "";
  const allowedOrigins = raw.split(",").map(s => s.trim()).filter(Boolean);
  const port = Number(process.env.PORT || 8765);
  const host = process.env.BX_RELAY_HOST || "127.0.0.1";
  const relay = createRelay({
    consoleToken: process.env.BX_RELAY_CONSOLE_TOKEN,
    playerToken: process.env.BX_RELAY_PLAYER_TOKEN,
    allowedOrigins,
    port, host
  });
  relay.listen().then(({ host, port }) => {
    console.log(`BX-REMOTE-PLAY research relay running at ${host}:${port} (control only)`);
    console.log("For remote access, configure HTTPS/WSS and rate limiting at a trusted reverse proxy.");
  }).catch(err => {
    console.error("Relay start error:", err.message);
    process.exitCode = 1;
  });
}
