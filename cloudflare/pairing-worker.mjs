/*
 * BX-REMOTE-LINK — Cloudflare Worker + SQLite Durable Object, v0.1.
 * Pairing-only: NO video, audio, PS4 control, Remote Play or console listener.
 * Console bearer secret is configured as a Cloudflare Worker secret, never
 * committed to Git. Single-console pilot with explicit local PS4 approval.
 */
const ALLOWED_ORIGIN = "https://ct7-bx.github.io";
const CODE_MS = 120000;
const CLAIM_MS = 120000;
const APPROVAL_MS = 120000;
const PRESENCE_MS = 12000;
const RATE_MS = 60000;
const MAX_ATTEMPTS = 8;
const MAX_CODE_ATTEMPTS = 32; // across all IPs for one short-lived PIN
const REQUEST_BYTES = 1024;
const MEDIA_SIGNAL_BYTES = 24000;
const MEDIA_MAX_SDP = 20000;
const MEDIA_JOIN_MS = 180000;
const mediaRoutes = new Set([
  "POST /v1/media/offer", "GET /v1/media/offer",
  "POST /v1/media/answer", "GET /v1/media/answer",
  "POST /v1/media/close"
]);
const routes = new Set([
  "POST /v1/pair/heartbeat", "POST /v1/pair/start",
  "POST /v1/pair/claim", "GET /v1/pair/pending",
  "POST /v1/pair/decide", "GET /v1/pair/status",
  "POST /v1/pair/revoke",
  ...mediaRoutes
]);
const protectedRoutes = new Set([
  "/v1/pair/heartbeat", "/v1/pair/start", "/v1/pair/pending",
  "/v1/pair/decide", "/v1/pair/revoke"
]);

function reply(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin"
  };
  if (origin === ALLOWED_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
  }
  return new Response(JSON.stringify(data), { status, headers });
}
function problem(code, status = 400, origin = "") {
  return reply({ error: code }, status, origin);
}
function hex(bytes) {
  return Array.from(bytes, x => x.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}
function randomCode() {
  const bound = Math.floor(4294967296 / 100000000) * 100000000;
  const bytes = new Uint32Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= bound);
  return String(bytes[0] % 100000000).padStart(8, "0");
}
async function digest(value) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return hex(new Uint8Array(buffer));
}
function ctEqual(a, b) {
  // Same-length SHA-256 hex values; no early exit inside byte comparison.
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
function authToken(request) {
  const authorization = request.headers.get("Authorization") || "";
  return /^Bearer [^\s]{1,128}$/.test(authorization)
    ? authorization.slice(7) : null;
}
async function readJson(request, maxBytes = REQUEST_BYTES) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
    request.headers.get("Content-Type") || ""
  )) throw { code: "UNSUPPORTED_MEDIA_TYPE", status: 415 };
  const reader = request.body?.getReader();
  if (!reader) throw { code: "BAD_JSON", status: 400 };
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw { code: "BODY_TOO_LARGE", status: 413 };
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size);
  let position = 0;
  for (const part of chunks) { buffer.set(part, position); position += part.byteLength; }
  let data;
  try { data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); }
  catch { throw { code: "BAD_JSON", status: 400 }; }
  if (!data || Array.isArray(data) || typeof data !== "object") {
    throw { code: "BAD_JSON", status: 400 };
  }
  return data;
}

/* Opt-in browser-to-browser screen sharing signal ONLY. This Durable Object
 * temporarily stores encrypted-WebRTC SDP metadata (private IP candidates may
 * appear), never media frames, audio, PSN credentials or remote-control input.
 * A high-entropy one-time bearer is copied privately between owner's devices.
 * Single active room, rate limited, 3-minute join window; no public listing.
 */
function validSdp(sdp) {
  return typeof sdp === "string" && sdp.length >= 12 &&
    sdp.length <= MEDIA_MAX_SDP && /^v=0\r?\n/.test(sdp) &&
    sdp.includes("m=video");
}
async function handleMediaSignal(request, storage, origin) {
  if (origin !== ALLOWED_ORIGIN) return problem("FORBIDDEN", 403, origin);
  const pathname = new URL(request.url).pathname;
  const now = Date.now();
  const key = "bx-media-signal-v1";
  let entry = await storage.get(key);
  if (entry && entry.expiresAt <= now) {
    await storage.delete(key);
    entry = null;
  }
  if (pathname === "/v1/media/offer" && request.method === "POST") {
    if (entry) return problem("ROOM_BUSY", 409, origin);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipHash = await digest(ip);
    const rateKey = "bx-media-rate-v1";
    const rates = (await storage.get(rateKey)) || {};
    const rate = rates[ipHash] && now - rates[ipHash].at < 60000
      ? rates[ipHash] : { at: now, attempts: 0 };
    if (++rate.attempts > 3) return problem("RATE_LIMITED", 429, origin);
    // Keep only recent entries and bounded memory to reduce abuse.
    const alive = Object.entries(rates).filter(([, value]) => value &&
      now - value.at < 60000).slice(-63);
    const updated = Object.fromEntries(alive);
    updated[ipHash] = rate;
    await storage.put(rateKey, updated);
    const input = await readJson(request, MEDIA_SIGNAL_BYTES);
    if (!validSdp(input.sdp) || input.type !== "offer") {
      return problem("INVALID_OFFER", 400, origin);
    }
    const ticket = randomToken();
    await storage.put(key, {
      hash: await digest(ticket), offer: input.sdp,
      answer: null, joined: false, expiresAt: now + MEDIA_JOIN_MS
    });
    return reply({ code: ticket, expiresInSeconds: MEDIA_JOIN_MS / 1000,
      transport: "peer-webrtc", ps4SourceVerified: false }, 200, origin);
  }
  const ticket = authToken(request);
  if (!entry || !/^[a-f0-9]{64}$/.test(ticket || "") ||
      !ctEqual(await digest(ticket), entry.hash)) {
    return problem("MEDIA_ROOM_NOT_FOUND", 401, origin);
  }
  if (pathname === "/v1/media/offer" && request.method === "GET") {
    if (entry.joined) return problem("ROOM_ALREADY_JOINED", 409, origin);
    entry.joined = true;
    await storage.put(key, entry);
    return reply({ type: "offer", sdp: entry.offer }, 200, origin);
  }
  if (pathname === "/v1/media/answer" && request.method === "POST") {
    if (!entry.joined || entry.answer) return problem("ANSWER_NOT_EXPECTED", 409, origin);
    const input = await readJson(request, MEDIA_SIGNAL_BYTES);
    if (input.type !== "answer" || !validSdp(input.sdp)) {
      return problem("INVALID_ANSWER", 400, origin);
    }
    entry.answer = input.sdp;
    await storage.put(key, entry);
    return reply({ status: "received" }, 200, origin);
  }
  if (pathname === "/v1/media/answer" && request.method === "GET") {
    return reply(entry.answer ? { status: "ready", type: "answer", sdp: entry.answer }
      : { status: "waiting" }, 200, origin);
  }
  if (pathname === "/v1/media/close" && request.method === "POST") {
    await readJson(request);
    await storage.delete(key);
    return reply({ status: "closed" }, 200, origin);
  }
  return problem("NOT_FOUND", 404, origin);
}

export class BXPairingRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.queue = Promise.resolve();
  }
  async fetch(request) {
    // Serialize state transitions (claim/approve/revoke) within this DO.
    const result = this.queue.then(() => this.handle(request));
    this.queue = result.then(() => {}, () => {});
    return result;
  }
  async handle(request) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const path = url.pathname;
    const now = Date.now();
    try {
      if (path.startsWith("/v1/media/")) {
        return await handleMediaSignal(request, this.ctx.storage, origin);
      }
      if (protectedRoutes.has(path)) {
        if (!/^[0-9a-f]{64}$/.test(this.env.BX_RELAY_CONSOLE_TOKEN || "")) {
          return problem("BACKEND_NOT_CONFIGURED", 503, origin);
        }
        const supplied = authToken(request);
        if (!supplied || !ctEqual(await digest(supplied),
          await digest(this.env.BX_RELAY_CONSOLE_TOKEN))) {
          return problem("UNAUTHORIZED", 401, origin);
        }
      }
      const key = "active-pairing";
      let entry = (await this.ctx.storage.get(key)) || null;
      if (entry && entry.expiresAt <= now) {
        entry = null;
        await this.ctx.storage.delete(key);
      }

      if (path === "/v1/pair/heartbeat") {
        const heartbeat = await readJson(request);
        /* Owner-authenticated PS4 native ELF reports LOCAL loopback readiness.
         * No private IPs, gameplay data, PINs or accounts are accepted.
         * This does NOT mean a playable video/audio stream exists.
         */
        if (Object.prototype.hasOwnProperty.call(heartbeat, "remotePlayTcp9295")) {
          const probe = heartbeat.remotePlayTcp9295;
          if (probe !== true && probe !== false && probe !== null)
            return problem("INVALID_PROBE", 400, origin);
          await this.ctx.storage.put("native-remoteplay-probe", {
            tcp9295: probe, checkedAt: now
          });
        }
        await this.ctx.storage.put("last-console-heartbeat", now);
        return reply({ state: "online", leaseSeconds: PRESENCE_MS / 1000 }, 200, origin);
      }
      if (path === "/v1/pair/start") {
        await readJson(request);
        const heartbeat = await this.ctx.storage.get("last-console-heartbeat");
        if (!Number.isFinite(heartbeat) || now - heartbeat >= PRESENCE_MS) {
          return problem("CONSOLE_OFFLINE", 409, origin);
        }
        const code = randomCode();
        const requestId = randomToken();
        await this.ctx.storage.put(key, {
          codeHash: await digest(code), requestId,
          status: "waiting", expiresAt: now + CODE_MS,
          failedCodeAttempts: 0,
          claimId: null, claimHash: null
        });
        return reply({ code, requestId, expiresInSeconds: CODE_MS / 1000 }, 200, origin);
      }
      if (path === "/v1/pair/pending") {
        return reply(entry?.status === "pending_confirmation"
          ? { status: entry.status, claimId: entry.claimId }
          : { status: entry?.status || "idle", claimId: null }, 200, origin);
      }
      if (path === "/v1/pair/claim") {
        const input = await readJson(request);
        // Store only a hash of the IP; no account identifiers or IP are reported.
        const ip = request.headers.get("CF-Connecting-IP") || "no-ip";
        const ipHash = await digest(ip);
        const rateKey = "claim-rates-v1";
        const oldRates = (await this.ctx.storage.get(rateKey)) || {};
        // Prune old hashes and cap global distinct IP entries to prevent
        // unbounded database growth from a rotating set of addresses.
        const rates = Object.fromEntries(Object.entries(oldRates)
          .filter(([, value]) => value && now - value.startedAt < RATE_MS));
        if (!rates[ipHash] && Object.keys(rates).length >= 512) {
          return problem("RATE_LIMITED", 429, origin);
        }
        const rate = rates[ipHash] || { startedAt: now, attempts: 0 };
        rate.attempts++;
        rates[ipHash] = rate;
        await this.ctx.storage.put(rateKey, rates);
        if (rate.attempts > MAX_ATTEMPTS) return problem("RATE_LIMITED", 429, origin);
        if (entry?.status === "waiting" &&
            entry.failedCodeAttempts >= MAX_CODE_ATTEMPTS) {
          return problem("RATE_LIMITED", 429, origin);
        }
        if (typeof input.code !== "string" || !/^\d{8}$/.test(input.code)
            || !entry || entry.status !== "waiting"
            || !ctEqual(await digest(input.code), entry.codeHash)) {
          if (entry?.status === "waiting") {
            entry.failedCodeAttempts = (entry.failedCodeAttempts || 0) + 1;
            await this.ctx.storage.put(key, entry);
          }
          return problem("INVALID_CODE", 400, origin);
        }
        const claimToken = randomToken();
        entry.status = "pending_confirmation";
        entry.claimHash = await digest(claimToken);
        entry.claimId = randomToken();
        entry.expiresAt = now + CLAIM_MS;
        await this.ctx.storage.put(key, entry);
        return reply({ claimToken, expiresInSeconds: CLAIM_MS / 1000 }, 200, origin);
      }
      if (path === "/v1/pair/decide") {
        const input = await readJson(request);
        if (!entry || entry.status !== "pending_confirmation"
            || typeof input.allow !== "boolean"
            || typeof input.requestId !== "string" || typeof input.claimId !== "string"
            || !ctEqual(input.requestId, entry.requestId)
            || !ctEqual(input.claimId, entry.claimId)) {
          return problem("NO_PENDING_CLAIM", 409, origin);
        }
        entry.status = input.allow ? "approved" : "denied";
        entry.expiresAt = now + APPROVAL_MS;
        await this.ctx.storage.put(key, entry);
        return reply({ status: entry.status, controlAvailable: false }, 200, origin);
      }
      if (path === "/v1/pair/status") {
        const supplied = authToken(request);
        if (!entry || typeof supplied !== "string" || !entry.claimHash
            || !ctEqual(await digest(supplied), entry.claimHash)) {
          return problem("INVALID_CLAIM", 401, origin);
        }
        // This Worker has no console input/media transport. NEVER return a
        // player token nor advertise a real Remote Play session.
        const response = { status: entry.status, controlAvailable: false };
        if (entry.status === "approved") {
          const probe = await this.ctx.storage.get("native-remoteplay-probe");
          /* Only the approved short-lived claimant may inspect diagnostics.
           * A stale probe must never be described as current availability.
           */
          if (probe && Number.isFinite(probe.checkedAt)
              && now - probe.checkedAt >= 0
              && now - probe.checkedAt <= 90000
              && [true, false, null].includes(probe.tcp9295)) {
            response.remotePlayProbe = {
              loopbackTcp9295: probe.tcp9295,
              checkedSecondsAgo: Math.floor((now - probe.checkedAt) / 1000)
            };
          }
        }
        return reply(response, 200, origin);
      }
      if (path === "/v1/pair/revoke") {
        await readJson(request);
        await this.ctx.storage.delete(key);
        return reply({ status: "revoked" }, 200, origin);
      }
      return problem("NOT_FOUND", 404, origin);
    } catch (error) {
      if (error && Number.isInteger(error.status)) {
        return problem(error.code, error.status, origin);
      }
      // No user-supplied values or bearer tokens go to logs.
      return problem("INTERNAL_ERROR", 500, origin);
    }
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    if (url.protocol !== "https:" || url.search || url.hash ||
        (origin && origin !== ALLOWED_ORIGIN)) {
      return problem("FORBIDDEN", 403, origin);
    }
    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) return problem("FORBIDDEN", 403);
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "120",
          "Cache-Control": "no-store",
          "Vary": "Origin"
        }
      });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return reply({
        status: "ok", mode: "control-prototype",
        pairing: true, pairingBackend: "cloudflare-durable-object",
        configured: /^[0-9a-f]{64}$/.test(env.BX_RELAY_CONSOLE_TOKEN || ""),
        ps4Control: false, video: false,
        mediaSignaling: true, mediaTransport: "browser-p2p-only"
      }, 200, origin);
    }
    if (url.pathname === "/v1/link") {
      return problem("CONTROL_TRANSPORT_NOT_IMPLEMENTED", 501, origin);
    }
    if (!routes.has(request.method + " " + url.pathname)) {
      return problem("NOT_FOUND", 404, origin);
    }
    // A public browser should never be invited to guess a PIN when no
    // console credential can be configured and no PS4 can start a session.
    if (url.pathname === "/v1/pair/claim" &&
        !/^[0-9a-f]{64}$/.test(env.BX_RELAY_CONSOLE_TOKEN || "")) {
      return problem("BACKEND_NOT_CONFIGURED", 503, origin);
    }
    if (!env.PAIRING_ROOM) return problem("BACKEND_NOT_CONFIGURED", 503, origin);
    try {
      const room = env.PAIRING_ROOM.get(env.PAIRING_ROOM.idFromName("bx-primary-console"));
      return await room.fetch(request);
    } catch {
      return problem("BACKEND_UNAVAILABLE", 503, origin);
    }
  }
};
