/* BX-REMOTE-PLAY — public release update center.
 * Displays official version metadata and GitHub download only.
 * DOES NOT send any command to the PS4, install a PKG or read private tokens.
 */
(function (root, factory) {
  "use strict";
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.BXPackageUpdates = core;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const TITLE_ID = "BRPM00001";
  const RELEASE_REPOSITORY = "CT7-BX/BX-REMOTE-PLAY";

  function expectedDownloadUrl(version) {
    return "https://github.com/" + RELEASE_REPOSITORY +
      "/releases/download/pair-test-v" + version +
      "/BX-REMOTE-PLAY-Pair-Test-v" + version + ".pkg";
  }

  function parseManifest(raw) {
    if (typeof raw !== "string" || raw.length < 12 || raw.length > 2048) {
      throw new Error("manifest_invalid");
    }
    const values = Object.create(null);
    const keys = new Set(["title_id", "version", "sha256", "pkg_url"]);
    for (const input of raw.replace(/\r\n/g, "\n").split("\n")) {
      const line = input.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) throw new Error("manifest_invalid");
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      if (!keys.has(key) || Object.prototype.hasOwnProperty.call(values, key) ||
          value.length < 1 || value.length > 300) throw new Error("manifest_invalid");
      values[key] = value;
    }
    if (Object.keys(values).length !== 4 || values.title_id !== TITLE_ID ||
        !/^[0-9]{1,3}\.[0-9]{1,3}(?:\.[0-9]{1,3})?$/.test(values.version) ||
        !/^[0-9a-f]{64}$/.test(values.sha256) ||
        values.pkg_url !== expectedDownloadUrl(values.version)) {
      throw new Error("manifest_invalid");
    }
    return Object.freeze({
      version: values.version,
      titleId: values.title_id,
      sha256: values.sha256,
      downloadUrl: values.pkg_url,
      releaseUrl: "https://github.com/" + RELEASE_REPOSITORY +
        "/releases/tag/pair-test-v" + values.version
    });
  }

  async function fetchManifest(fetcher, signal) {
    const request = fetcher || ((...args) => fetch(...args));
    let response;
    try {
      response = await request("./update.txt", {
        method: "GET", mode: "same-origin", credentials: "omit",
        cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal
      });
    } catch (error) {
      if (signal && signal.aborted) throw new Error("cancelled");
      throw new Error("manifest_network");
    }
    if (!response || response.status !== 200) throw new Error("manifest_http");
    return parseManifest(await response.text());
  }

  return Object.freeze({ TITLE_ID, expectedDownloadUrl, parseManifest, fetchManifest });
});

(function () {
  "use strict";
  if (typeof document === "undefined") return;
  const core = window.BXPackageUpdates;
  const $ = id => document.getElementById(id);
  const section = $("pkgUpdatesSection");
  const check = $("pkgUpdateCheck");
  const status = $("pkgUpdateStatus");
  const version = $("pkgLatestVersion");
  const sha = $("pkgLatestSHA");
  const download = $("pkgUpdateDownload");
  const release = $("pkgUpdateRelease");
  if (!core || !section || !check || !status || !version || !sha || !download || !release) return;

  let generation = 0;
  let controller = null;
  let installedVersion = null; // Unknown by design; web page cannot inspect installed PKGs.

  function resetLinks() {
    version.textContent = "Não consultada";
    sha.textContent = "—";
    download.removeAttribute("href");
    release.removeAttribute("href");
    download.hidden = true;
    release.hidden = true;
  }
  function cancel() {
    generation++;
    if (controller) controller.abort();
    controller = null;
    check.disabled = false;
  }
  async function checkLatest() {
    cancel();
    const requestId = generation;
    controller = new AbortController();
    const activeController = controller;
    resetLinks();
    check.disabled = true;
    status.dataset.state = "loading";
    status.textContent = "Consultando a versão oficial no GitHub Pages...";
    const timer = setTimeout(() => activeController.abort(), 9000);
    try {
      const info = await core.fetchManifest(null, activeController.signal);
      if (generation !== requestId || activeController.signal.aborted) return;
      version.textContent = "v" + info.version + " (publicada no GitHub)";
      sha.textContent = info.sha256;
      download.href = info.downloadUrl;
      release.href = info.releaseUrl;
      download.hidden = false;
      release.hidden = false;
      status.dataset.state = "ready";
      status.textContent = "Versão oficial encontrada. O site não detecta a versão instalada no PS4 e não consegue enviar ou instalar o PKG remotamente.";
    } catch (error) {
      if (generation !== requestId) return;
      status.dataset.state = "error";
      status.textContent = error.message === "manifest_invalid"
        ? "O manifesto publicado é inválido. Download bloqueado até corrigir a versão ou o endereço oficial."
        : "Não foi possível consultar a versão oficial. Verifique sua conexão e tente novamente.";
    } finally {
      clearTimeout(timer);
      if (generation === requestId) {
        check.disabled = false;
        controller = null;
      }
    }
  }

  resetLinks();
  check.addEventListener("click", checkLatest);
  section.addEventListener("toggle", () => {
    if (section.open && version.textContent === "Não consultada") void checkLatest();
  });
  window.addEventListener("pagehide", cancel);
  window.addEventListener("pageshow", event => {
    if (event && event.persisted) {
      cancel();
      resetLinks();
      status.textContent = "Dados antigos descartados. Consulte a versão novamente.";
      status.dataset.state = "idle";
    }
  });
})();
