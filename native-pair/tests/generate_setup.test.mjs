import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSetup, validOrigin } from "../tools/generate_setup.mjs";

test("accept HTTPS origin only, without credentials, path or query", () => {
  assert.equal(validOrigin("https://relay.example.org"), "https://relay.example.org");
  assert.equal(validOrigin("https://relay.example.org:8443"), "https://relay.example.org:8443");
  for (const invalid of [
    "", "http://relay.example.org", "https://relay.example.org/path",
    "https://user:password@relay.example.org", "https://relay.example.org?token=123",
    "https://relay.example.org#fragment", "https://relay..example.org",
    "https://-relay.example.org", "https://relay.example.org:65536",
    "https://relay_example.org", "https://relay.example.org\\@attacker.net"
  ]) assert.equal(validOrigin(invalid), null, invalid);
});

test("generate locally matching separate console and relay secrets with private permissions", async t => {
  const temp = await mkdtemp(join(tmpdir(), "bx-pair-generator-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const result = await generateSetup({
    origin: "https://relay.example.org", out: join(temp, "private")
  });
  const ps4 = await readFile(result.ps4Path, "utf8");
  const env = await readFile(result.relayPath, "utf8");
  assert.match(ps4, /^relay_base=https:\/\/relay\.example\.org\n/m);
  assert.match(ps4, /^console_token=[a-f0-9]{64}$/m);
  assert.doesNotMatch(ps4, /BX_RELAY_PLAYER_TOKEN/);
  const consoleToken = ps4.match(/^console_token=([a-f0-9]{64})$/m)[1];
  const playerToken = env.match(/^export BX_RELAY_PLAYER_TOKEN='([a-f0-9]{64})'$/m)[1];
  assert.ok(env.includes("export BX_RELAY_CONSOLE_TOKEN='" + consoleToken + "'"));
  assert.notEqual(consoleToken, playerToken);
  assert.equal((await stat(result.directory)).mode & 0o077, 0);
  assert.equal((await stat(result.ps4Path)).mode & 0o077, 0);
  assert.equal((await stat(result.relayPath)).mode & 0o077, 0);
  await assert.rejects(
    generateSetup({ origin: "https://relay.example.org", out: result.directory }),
    /already exists/
  );
});

test("never write secrets into the source checkout", async () => {
  await assert.rejects(
    generateSetup({ origin: "https://relay.example.org", out: "./native-pair/private" }),
    /Git repository/
  );
  await assert.rejects(
    generateSetup({ origin: "https://relay.example.org", out: "./bad" }),
    /Git repository/
  );
});

test("reject invalid endpoint before creating output directory", async t => {
  const temp = await mkdtemp(join(tmpdir(), "bx-pair-invalid-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const output = join(temp, "no-secret");
  await assert.rejects(
    generateSetup({ origin: "http://insecure.example.org", out: output }),
    /public HTTPS/
  );
  await assert.rejects(stat(output), { code: "ENOENT" });
});
