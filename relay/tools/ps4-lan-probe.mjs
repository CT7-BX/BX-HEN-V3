/**
 * BX-REMOTE-PLAY: single-host, LAN-only connectivity check for the native
 * PS4 Remote Play TCP session port. This is not device discovery, pairing,
 * video transport, a port scanner or a proxy.
 */
import net from "node:net";
import { pathToFileURL } from "node:url";

export function isPrivateIPv4(host, { loopback = false } = {}) {
  if (typeof host !== "string" || net.isIP(host) !== 4) return false;
  const octets = host.split(".").map(Number);
  return (octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
    || (loopback && octets[0] === 127));
}

export function checkRemotePlayPort({
  host, port = 9295, timeoutMs = 1500, allowTestLoopback = false
}) {
  if (!isPrivateIPv4(host, { loopback: allowTestLoopback })) {
    return Promise.reject(new Error("Informe um IPv4 privado da LAN."));
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return Promise.reject(new Error("Porta inválida."));
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) {
    return Promise.reject(new Error("Tempo limite inválido."));
  }
  return new Promise(resolve => {
    const started = performance.now();
    const socket = net.createConnection({ host, port });
    let settled = false;
    function finish(reachable, error) {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        reachable,
        host, port,
        elapsedMs: Math.round(performance.now() - started),
        reason: reachable ? "TCP_ACCEPTED" : (error || "UNREACHABLE")
      });
    }
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false, "TIMEOUT"));
    socket.once("error", error => {
      // Do not log environment details, and do not expose a raw socket.
      finish(false, error?.code || "CONNECT_FAILED");
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.argv[2];
  checkRemotePlayPort({ host }).then(result => {
    const label = result.reachable ? "ACESSÍVEL" : "NÃO ACESSÍVEL";
    console.log("BX-REMOTE-PLAY | diagnóstico LAN");
    console.log("Destino:", result.host + ":" + result.port);
    console.log("TCP:", label, "| tempo:", result.elapsedMs + "ms", "|", result.reason);
    console.log("Esse teste NÃO autentica, não faz pareamento e não transmite imagem do PS4.");
    if (!result.reachable) process.exitCode = 2;
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
