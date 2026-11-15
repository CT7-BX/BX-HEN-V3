/*
 * SIMULATED PS4 ONLY. Does not run on PS4 or control a real console.
 * Intended for localhost end-to-end relay protocol tests.
 */
import WebSocket from "ws";

const url = process.env.BX_RELAY_URL || "ws://127.0.0.1:8765/v1/link";
const token = process.env.BX_RELAY_CONSOLE_TOKEN;
if (!token) {
  console.error("Defina BX_RELAY_CONSOLE_TOKEN por variável de ambiente.");
  process.exit(1);
}
if (!url.startsWith("wss://") && !/^ws:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/)/.test(url)) {
  console.error("Use wss:// para rede externa e ws:// somente no localhost.");
  process.exit(1);
}

const ws = new WebSocket(url, { perMessageDeflate: false });
ws.on("open", () => {
  ws.send(JSON.stringify({ type: "hello", role: "console", token }));
});
ws.on("message", payload => {
  let data;
  try { data = JSON.parse(payload.toString()); }
  catch { return; }
  if (data.type === "authenticated") {
    console.log("Console simulado autenticado; nenhum PS4 conectado.");
    ws.send(JSON.stringify({ type: "status", state: "ready" }));
  } else if (data.type === "peer") {
    console.log("Navegador de teste presente:", data.connected);
  } else if (data.type === "reset") {
    console.log("Controles soltos pelo relay:", data.reason);
  } else if (data.type === "input") {
    console.log("Pacote virtual recebido, seq:", data.seq);
    ws.send(JSON.stringify({ type: "ack", seq: data.seq }));
  }
});
ws.on("close", (code) => {
  console.log("Simulação encerrada:", code);
});
ws.on("error", err => {
  console.error("Falha de rede:", err.message);
  process.exitCode = 1;
});
