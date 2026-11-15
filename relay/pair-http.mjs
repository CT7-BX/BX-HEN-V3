/**
 * Minimal pairing HTTP API for the Node relay (research).
 * Do not expose this on plain HTTP to the Internet. Reverse proxy MUST
 * terminate HTTPS, apply abuse control and only accept expected origins.
 */
import { createHash, timingSafeEqual } from "node:crypto";

function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest()
  );
}

function bearer(req) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !/^Bearer [^\s]+$/.test(authorization)) return null;
  return authorization.slice(7);
}

async function jsonBody(req) {
  const chunks = [];
  let count = 0;
  for await (const bytes of req) {
    count += bytes.length;
    if (count > 1024) throw new Error("BODY_TOO_LARGE");
    chunks.push(bytes);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("BAD_JSON"); }
  if (!body || Array.isArray(body) || typeof body !== "object") throw new Error("BAD_JSON");
  return body;
}

export function createPairingHttpHandler({ pairing, consoleToken, allowedOrigins, consoleOnline = () => true, consoleSocketOnline = () => false }) {
  const routes = new Map([
    ["POST /v1/pair/start", "console"],
    ["POST /v1/pair/heartbeat", "console"],
    ["POST /v1/pair/claim", "browser"],
    ["GET /v1/pair/pending", "console"],
    ["POST /v1/pair/decide", "console"],
    ["GET /v1/pair/status", "claimant"],
    ["POST /v1/pair/revoke", "console"]
  ]);

  return async (req, res) => {
    let url;
    try { url = new URL(req.url, "http://127.0.0.1"); }
    catch { return false; }
    if (!url.pathname.startsWith("/v1/pair/")) return false;
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Vary": "Origin"
    };
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
      headers["Access-Control-Max-Age"] = "120";
    }
    const reply = (status, data) => {
      res.writeHead(status, headers);
      res.end(JSON.stringify(data));
    };
    // Never allow tokens in the URL, even on local tests.
    if (url.search || url.hash || (origin && !allowedOrigins.includes(origin))) {
      reply(403, { error: "FORBIDDEN" });
      return true;
    }
    if (req.method === "OPTIONS") {
      if (!origin) reply(403, { error: "FORBIDDEN" });
      else { res.writeHead(204, headers); res.end(); }
      return true;
    }
    const role = routes.get(req.method + " " + url.pathname);
    if (!role) {
      reply(404, { error: "NOT_FOUND" });
      return true;
    }
    const token = bearer(req);
    if (role === "console" && !equal(token, consoleToken)) {
      reply(401, { error: "UNAUTHORIZED" });
      return true;
    }
    if (role === "claimant" && !token) {
      reply(401, { error: "UNAUTHORIZED" });
      return true;
    }
    if (req.method === "POST" && !["application/json", "application/json; charset=utf-8"].includes(
      String(req.headers["content-type"] || "").toLowerCase()
    )) {
      reply(415, { error: "UNSUPPORTED_MEDIA_TYPE" });
      return true;
    }
    try {
      let output;
      switch (url.pathname) {
        case "/v1/pair/heartbeat":
          await jsonBody(req);
          output = pairing.consoleHeartbeat();
          break;
        case "/v1/pair/start":
          if (!consoleOnline()) { reply(409, { error: "CONSOLE_OFFLINE" }); return true; }
          await jsonBody(req);
          output = pairing.begin();
          break;
        case "/v1/pair/claim": {
          const data = await jsonBody(req);
          output = pairing.claim(data.code, req.socket.remoteAddress);
          break;
        }
        case "/v1/pair/pending":
          output = pairing.pending();
          break;
        case "/v1/pair/decide": {
          const data = await jsonBody(req);
          output = pairing.decide({
            requestId: data.requestId, claimId: data.claimId, allow: data.allow
          });
          break;
        }
        case "/v1/pair/status":
          output = pairing.status(token);
          if (output.status === "approved") output.controlAvailable = consoleSocketOnline();
          break;
        case "/v1/pair/revoke":
          await jsonBody(req);
          output = pairing.revoke();
          break;
        default:
          reply(404, { error: "NOT_FOUND" });
          return true;
      }
      reply(200, output);
    } catch (error) {
      const reason = String(error?.code || error?.message || "ERROR");
      const code = reason === "RATE_LIMITED" ? 429
        : reason === "BODY_TOO_LARGE" ? 413
        : ["INVALID_CODE", "BAD_JSON", "NO_PENDING_CLAIM"].includes(reason) ? 400
        : ["INVALID_CLAIM", "EXPIRED"].includes(reason) ? 401
        : 400;
      reply(code, { error: reason });
    }
    return true;
  };
}
