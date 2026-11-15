import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { isPrivateIPv4, checkRemotePlayPort } from "../tools/ps4-lan-probe.mjs";

test("only private IPv4 LAN addresses are allowed by default", () => {
  for (const host of ["10.0.0.8", "172.16.1.3", "172.31.250.90", "192.168.1.120"]) {
    assert.equal(isPrivateIPv4(host), true, host);
  }
  for (const host of ["", "localhost", "127.0.0.1", "8.8.8.8", "172.32.0.1",
    "169.254.0.1", "192.169.0.1", "https://192.168.1.3", "192.168.1.3:9295", "::1"]) {
    assert.equal(isPrivateIPv4(host), false, host);
  }
});

test("invalid target addresses and ports do not open sockets", async () => {
  await assert.rejects(checkRemotePlayPort({ host: "8.8.8.8" }), /privado/);
  await assert.rejects(checkRemotePlayPort({ host: "example.com" }), /privado/);
  await assert.rejects(checkRemotePlayPort({ host: "192.168.1.2", port: 70000 }), /Porta/);
  await assert.rejects(checkRemotePlayPort({ host: "192.168.1.2", timeoutMs: 15 }), /limite/);
});

test("one reachable local TCP listener can be detected with loopback test override", async (t) => {
  const server = net.createServer(socket => socket.end());
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const outcome = await checkRemotePlayPort({
    host: "127.0.0.1", port, timeoutMs: 900, allowTestLoopback: true
  });
  assert.equal(outcome.reachable, true);
  assert.equal(outcome.reason, "TCP_ACCEPTED");
  assert.ok(outcome.elapsedMs >= 0);
});

test("closed local port gives non-success without asserting PS4 streaming", async () => {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const outcome = await checkRemotePlayPort({
    host: "127.0.0.1", port, timeoutMs: 900, allowTestLoopback: true
  });
  assert.equal(outcome.reachable, false);
  assert.notEqual(outcome.reason, "TCP_ACCEPTED");
});
