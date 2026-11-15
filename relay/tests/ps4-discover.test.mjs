import { test } from "node:test";
import assert from "node:assert/strict";
import dgram from "node:dgram";
import { discoverSinglePS4, parseResponse } from "../tools/ps4-discover.mjs";

test("rejects public IPs and unapproved addresses", async () => {
  await assert.rejects(discoverSinglePS4({ host: "8.8.8.8" }), /privado/);
  await assert.rejects(discoverSinglePS4({ host: "example.org" }), /privado/);
  await assert.rejects(discoverSinglePS4({ host: "127.0.0.1" }), /privado/);
  await assert.rejects(discoverSinglePS4({ host: "192.168.1.20", port: 0 }), /Porta/);
});

test("parses only plausible PS4 discovery replies and excludes hardware identifiers", () => {
  const reply = Buffer.from([
    "HTTP/1.1 200 OK",
    "host-type:PS4",
    "host-name:Living Room",
    "host-id:PRIVATE12345",
    "device-discovery-protocol-version:00020020",
    ""
  ].join("\n"));
  const result = parseResponse(reply);
  assert.equal(result.statusLabel, "LIGADO");
  assert.equal(result.hostName, "Living Room");
  assert.equal(result.hostType, "PS4");
  assert.equal(JSON.stringify(result).includes("PRIVATE12345"), false);
  assert.equal(parseResponse(Buffer.from("HTTP/1.1 200 OK\nhost-type:OTHER\n")), null);
  assert.equal(parseResponse(Buffer.from("gibberish")), null);
});

test("one UDP unicast request receives a matching PS4 status from a test fixture", async t => {
  const fixture = dgram.createSocket("udp4");
  await new Promise(resolve => fixture.bind(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => fixture.close(resolve)));

  let requests = 0;
  fixture.on("message", (data, remote) => {
    requests++;
    assert.match(data.toString(), /^SRCH \* HTTP\/1\.1/);
    assert.match(data.toString(), /device-discovery-protocol-version:00020020/);
    const response = Buffer.from("HTTP/1.1 620 Standby\nhost-type:PS4\nhost-name:Fixture\n");
    fixture.send(response, remote.port, remote.address);
  });

  const { port } = fixture.address();
  const result = await discoverSinglePS4({
    host: "127.0.0.1", port, timeoutMs: 1000, allowTestLoopback: true
  });
  assert.equal(requests, 1);
  assert.equal(result.found, true);
  assert.equal(result.device.statusLabel, "REPOUSO");
});

test("unanswered target times out rather than reporting an invented PS4", async t => {
  const fixture = dgram.createSocket("udp4");
  await new Promise(resolve => fixture.bind(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => fixture.close(resolve)));
  const { port } = fixture.address();
  const result = await discoverSinglePS4({
    host: "127.0.0.1", port, timeoutMs: 180, allowTestLoopback: true
  });
  assert.equal(result.found, false);
  assert.equal(result.reason, "TIMEOUT");
});
