#!/usr/bin/env node
/**
 * Generates one unique local console credential for a PRIVATE PS4 pairing test
 * and the matching Node relay environment variables.
 *
 * This script writes credentials to a caller-chosen NEW directory OUTSIDE the
 * repository; it never logs a secret, makes network calls or modifies GitHub.
 */
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function validOrigin(raw) {
  if (typeof raw !== "string" || !raw.startsWith("https://")
      || raw.length > 180 || /[\s\\]/.test(raw)) return null;
  let parsed;
  try { parsed = new URL(raw); } catch { return null; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password
      || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
  // Match the deliberately narrow native PS4 HTTPS origin grammar.
  const host = parsed.hostname;
  if (host.length < 3 || !host.includes(".") || host.endsWith(".")
      || !host.split(".").every(label =>
        label.length >= 1 && label.length <= 63
        && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return null;
  if (parsed.port && (!/^\d{1,5}$/.test(parsed.port)
      || +parsed.port < 1 || +parsed.port > 65535)) return null;
  // URL normalizes :443; both canonical and explicitly requested standard TLS are supported.
  return parsed.origin;
}

function outsideRepo(destination) {
  const rel = relative(repoRoot, destination);
  return rel !== "" && rel !== "." && (rel === ".." || rel.startsWith("../") || isAbsolute(rel));
}

export async function generateSetup({ origin, out }) {
  const cleanOrigin = validOrigin(origin);
  if (!cleanOrigin) throw new Error("Use a public HTTPS DNS origin without path or credentials.");
  if (!out || typeof out !== "string") throw new Error("Provide a new --out directory.");
  const dest = resolve(out);
  if (!outsideRepo(dest)) throw new Error("Refusing to write private credentials inside the Git repository.");
  // Fail closed instead of accidentally overwriting/reusing credentials.
  try {
    await stat(dest);
    throw new Error("Output directory already exists; choose a new empty name.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(dest, { mode: 0o700 });
  const consoleToken = randomBytes(32).toString("hex");
  const playerToken = randomBytes(32).toString("hex");
  const ps4Path = resolve(dest, "bx-remote-pair.cfg");
  const relayPath = resolve(dest, "relay-private.env");
  const ps4Config = "relay_base=" + cleanOrigin + "\n" +
    "console_token=" + consoleToken + "\n";
  const relayConfig =
    "export BX_RELAY_CONSOLE_TOKEN='" + consoleToken + "'\n" +
    "export BX_RELAY_PLAYER_TOKEN='" + playerToken + "'\n" +
    "export BX_RELAY_ALLOWED_ORIGINS='https://ct7-bx.github.io'\n" +
    "export BX_RELAY_HOST='127.0.0.1'\n";
  await writeFile(ps4Path, ps4Config, { flag: "wx", mode: 0o600 });
  await writeFile(relayPath, relayConfig, { flag: "wx", mode: 0o600 });
  return { directory: dest, ps4Path, relayPath };
}

async function main(args) {
  const values = new Map();
  for (let i = 0; i < args.length; i += 2) {
    if (!["--origin", "--out"].includes(args[i]) || args[i + 1] === undefined) {
      throw new Error("Usage: node native-pair/tools/generate_setup.mjs --origin https://relay.example.org --out /tmp/bx-pair-private");
    }
    if (values.has(args[i])) throw new Error("Duplicate option: " + args[i]);
    values.set(args[i], args[i + 1]);
  }
  const result = await generateSetup({ origin: values.get("--origin"), out: values.get("--out") });
  console.log("Private pairing files created (contents are never printed):");
  console.log("PS4 file:", result.ps4Path, "(copy to /user/data/bx-remote-pair.cfg)");
  console.log("Relay env:", result.relayPath, "(load locally on the relay server)");
  console.log("Do NOT upload these files or their contents to GitHub or an issue.");
  console.log("This config alone does not deploy a backend or enable PS4 Remote Play.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error("Setup failed:", error.message);
    process.exitCode = 1;
  });
}
