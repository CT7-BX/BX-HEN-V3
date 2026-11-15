/**
 * BX-REMOTE-PLAY pairing v0.3: explicit, one-time, console-approved linking.
 *
 * Research backend only. No real PS4 is enrolled by this module.
 * All secrets are in RAM, never URLs, cookies or GitHub Pages.
 * Production requires HTTPS/WSS termination, abuse controls at the edge,
 * owner/device accounts and persistent revocation.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const CODE_LIFETIME_MS = 2 * 60 * 1000;
const CLAIM_LIFETIME_MS = 2 * 60 * 1000;
const SESSION_LIFETIME_MS = 15 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;

function digest(input) {
  return createHash("sha256").update(input).digest();
}

function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  return timingSafeEqual(digest(a), digest(b));
}

function secret() {
  return randomBytes(32).toString("hex");
}

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  return error;
}

export function createPairingStore({ now = Date.now } = {}) {
  let active = null;
  const attemptsByIp = new Map();

  function expire() {
    if (!active) return;
    if (now() > active.expiresAt) {
      active = null;
    }
  }

  function begin() {
    expire();
    const code = randomInt(0, 100000000).toString().padStart(8, "0");
    const requestId = secret();
    active = {
      codeHash: digest(code),
      requestId,
      expiresAt: now() + CODE_LIFETIME_MS,
      status: "waiting",
      claimId: null,
      claimHash: null,
      sessionHash: null,
      sessionToken: null,
      sessionExpiresAt: 0
    };
    return {
      code,
      requestId,
      expiresInSeconds: CODE_LIFETIME_MS / 1000
    };
  }

  function rateLimit(ip = "unknown") {
    if (attemptsByIp.size > 1500) attemptsByIp.clear();
    const key = String(ip).slice(0, 100);
    const stamp = now();
    const old = attemptsByIp.get(key);
    const info = !old || stamp - old.start >= RATE_WINDOW_MS
      ? { start: stamp, count: 0 } : old;
    info.count++;
    attemptsByIp.set(key, info);
    if (info.count > 8) throw fail("RATE_LIMITED");
  }

  function claim(code, ip) {
    rateLimit(ip);
    expire();
    if (typeof code !== "string" || !/^[0-9]{8}$/.test(code)) {
      throw fail("INVALID_CODE");
    }
    if (!active || active.status !== "waiting"
        || !timingSafeEqual(digest(code), active.codeHash)) {
      throw fail("INVALID_CODE");
    }
    const claimToken = secret();
    active.claimId = secret();
    active.claimHash = digest(claimToken);
    active.status = "pending_confirmation";
    active.expiresAt = now() + CLAIM_LIFETIME_MS;
    return {
      claimToken,
      expiresInSeconds: CLAIM_LIFETIME_MS / 1000
    };
  }

  function pending() {
    expire();
    if (!active) return { status: "idle" };
    return {
      status: active.status,
      claimId: active.status === "pending_confirmation" ? active.claimId : null
    };
  }

  function decide({ requestId, claimId, allow }) {
    expire();
    if (!active || active.status !== "pending_confirmation"
        || !equal(requestId, active.requestId)
        || !equal(claimId, active.claimId)
        || typeof allow !== "boolean") {
      throw fail("NO_PENDING_CLAIM");
    }
    if (!allow) {
      active.status = "denied";
      return { status: "denied" };
    }
    const token = secret();
    active.sessionHash = digest(token);
    active.sessionToken = token;
    active.sessionExpiresAt = now() + SESSION_LIFETIME_MS;
    active.status = "approved";
    return { status: "approved", expiresInSeconds: SESSION_LIFETIME_MS / 1000 };
  }

  function status(claimToken) {
    expire();
    if (!active || !active.claimHash ||
        typeof claimToken !== "string" ||
        !timingSafeEqual(digest(claimToken), active.claimHash)) {
      throw fail("INVALID_CLAIM");
    }
    const state = active.status;
    if (state === "approved") {
      if (now() >= active.sessionExpiresAt) {
        active = null;
        throw fail("EXPIRED");
      }
      return {
        status: state,
        // Released only to claimant after explicit console approval.
        playerToken: active.sessionToken,
        expiresInSeconds: Math.max(0, Math.ceil((active.sessionExpiresAt - now()) / 1000))
      };
    }
    return { status: state };
  }

  function authorizedPlayer(token) {
    expire();
    return Boolean(active && active.status === "approved"
      && now() < active.sessionExpiresAt
      && typeof token === "string"
      && active.sessionHash && timingSafeEqual(digest(token), active.sessionHash));
  }

  function revoke() {
    active = null;
    return { status: "revoked" };
  }

  return { begin, claim, pending, decide, status, authorizedPlayer, revoke };
}
