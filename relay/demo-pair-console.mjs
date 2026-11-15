/*
 * BX-REMOTE-PLAY — console SIMULATOR, not a PS4 homebrew or payload.
 * Enables end-to-end testing of the approval ceremony on localhost.
 */
import WebSocket from "ws";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const consoleToken = process.env.BX_RELAY_CONSOLE_TOKEN;
const wsUrl = process.env.BX_RELAY_URL || "ws://127.0.0.1:8765/v1/link";
const browserOrigin = process.env.BX_RELAY_ALLOWED_ORIGINS || "";

if (!consoleToken || consoleToken.length < 32) {
  console.error("Configure BX_RELAY_CONSOLE_TOKEN (mínimo 32 caracteres).");
  process.exit(1);
}
const endpoint = new URL(wsUrl);
if (endpoint.pathname !== "/v1/link" || endpoint.search || endpoint.hash
    || !["wss:", "ws:"].includes(endpoint.protocol)) {
  console.error("Use um WSS válido com /v1/link.");
  process.exit(1);
}
if (endpoint.protocol === "ws:" && !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)) {
  console.error("Conexões remotas exigem WSS. Nunca exponha tokens por WS público.");
  process.exit(1);
}

const root = new URL(endpoint.href);
root.protocol = endpoint.protocol === "wss:" ? "https:" : "http:";
root.pathname = "/";
const base = root.origin;

async function call(path, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: "Bearer " + consoleToken,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "API failed");
  return data;
}

const rl = createInterface({ input: stdin, output: stdout });
const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
let running = true;
const pause = duration => new Promise(resolve => setTimeout(resolve, duration));

async function main() {
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  const authenticated = new Promise((resolve, reject) => {
    function onMessage(data) {
      const frame = JSON.parse(data.toString());
      if (frame.type === "authenticated") {
        ws.off("message", onMessage);
        resolve();
      }
    }
    ws.on("message", onMessage);
    ws.once("close", () => reject(new Error("Console simulated disconnected")));
  });
  ws.send(JSON.stringify({ type: "hello", role: "console", token: consoleToken }));
  await authenticated;
  console.log("Console SIMULADO autenticado. Não existe PS4 conectado.");
  ws.on("message", payload => {
    const frame = JSON.parse(payload.toString());
    if (frame.type === "input") {
      console.log("Controle do navegador (SIMULAÇÃO), seq:", frame.seq);
      ws.send(JSON.stringify({ type: "ack", seq: frame.seq }));
    } else if (frame.type === "reset") {
      console.log("SIMULAÇÃO: comandos soltos:", frame.reason);
    }
  });
  ws.on("close", () => { running = false; });

  const started = await call("/v1/pair/start", {});
  console.log("\nCódigo de vínculo de TESTE:", started.code);
  console.log("Válido por", started.expiresInSeconds, "segundos.");
  console.log("Informe este código na página BX-REMOTE-PLAY no navegador.");
  while (running) {
    const pending = await call("/v1/pair/pending");
    if (pending.status === "pending_confirmation" && pending.claimId) {
      const answer = (await rl.question("\nAprovar acesso ao CONSOLE SIMULADO? Digite SIM: "))
        .trim().toUpperCase();
      const allowed = answer === "SIM";
      await call("/v1/pair/decide", {
        requestId: started.requestId,
        claimId: pending.claimId,
        allow: allowed
      });
      console.log(allowed ? "Aprovado (simulação)." : "Negado.");
      break;
    }
    if (pending.status !== "waiting") {
      console.log("Pareamento expirado ou encerrado:", pending.status);
      break;
    }
    await pause(1000);
  }
  console.log("Console SIMULADO ativo; pressione Ctrl+C para encerrar.");
}

process.on("SIGINT", () => {
  running = false;
  ws.terminate();
  rl.close();
  process.exitCode = 0;
});
main().catch(err => {
  console.error("Falha no laboratório de pareamento:", err.message);
  ws.terminate();
  process.exitCode = 1;
}).finally(() => {
  if (!running) rl.close();
});
