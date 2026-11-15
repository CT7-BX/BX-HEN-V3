/**
 * One-target PS4 discovery on the local network.
 * Sends exactly one harmless Device Discovery Protocol (DDP) search to
 * UDP/987. Never wakes the PS4, scans subnets, or opens remote ports.
 */
import dgram from "node:dgram";
import { pathToFileURL } from "node:url";
import { isPrivateIPv4 } from "./ps4-lan-probe.mjs";

const PORT = 987;
const PROBE = Buffer.from(
  "SRCH * HTTP/1.1\n" +
  "device-discovery-protocol-version:00020020\n\0",
  "utf8"
);

function parseResponse(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > 2048 || buffer.length < 12) return null;
  const text = buffer.toString("utf8").replace(/\0+$/, "");
  const lines = text.split(/\r?\n/);
  const first = /^HTTP\/1\.1\s+(\d{3})(?:\s|$)/.exec(lines[0] || "");
  if (!first) return null;
  const fields = new Map();
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (value.length <= 120) fields.set(key, value);
  }
  const hostType = fields.get("host-type") || "";
  if (!/^PS4(?:-PRO|-SLIM)?$/i.test(hostType)) return null;
  return {
    status: Number(first[1]),
    statusLabel: Number(first[1]) === 200 ? "LIGADO" : Number(first[1]) === 620 ? "REPOUSO" : "DESCONHECIDO",
    hostType,
    // For privacy, deliberately do not include host-id or account details.
    hostName: (fields.get("host-name") || "").slice(0, 80),
    discoveryVersion: (fields.get("device-discovery-protocol-version") || "").slice(0, 32)
  };
}

export { parseResponse };

export function discoverSinglePS4({
  host, port = PORT, timeoutMs = 1300, allowTestLoopback = false
} = {}) {
  if (!isPrivateIPv4(host, { loopback: allowTestLoopback })) {
    return Promise.reject(new Error("Informe um IPv4 privado da rede local."));
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return Promise.reject(new Error("Porta UDP inválida."));
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 150 || timeoutMs > 10000) {
    return Promise.reject(new Error("Tempo limite inválido."));
  }
  return new Promise(resolve => {
    const socket = dgram.createSocket("udp4");
    const started = performance.now();
    let finished = false;
    const timer = setTimeout(() => finish({ found: false, reason: "TIMEOUT" }), timeoutMs);

    function finish(outcome) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      resolve({
        host, port,
        elapsedMs: Math.round(performance.now() - started),
        ...outcome
      });
    }

    socket.on("error", error => finish({ found: false, reason: error.code || "NETWORK_ERROR" }));
    socket.on("message", (message, remote) => {
      if (remote.address !== host) return;
      const parsed = parseResponse(message);
      if (!parsed) return;
      finish({ found: true, reason: "DDP_REPLY", device: parsed });
    });
    socket.send(PROBE, port, host, error => {
      if (error) finish({ found: false, reason: error.code || "SEND_FAILED" });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  discoverSinglePS4({ host: process.argv[2] })
    .then(result => {
      console.log("BX-REMOTE-PLAY | Descoberta PS4 LAN");
      console.log("Destino:", result.host + ":" + result.port, "UDP");
      if (result.found) {
        console.log("PS4 detectado:", result.device.statusLabel, result.device.hostType);
        console.log("Nome:", result.device.hostName || "(não informado)");
      } else {
        console.log("Sem resposta:", result.reason);
        process.exitCode = 2;
      }
      console.log("Este teste NÃO registra nem inicia o Remote Play.");
    })
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
