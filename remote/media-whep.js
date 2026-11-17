/* BX-REMOTE-PLAY WHEP receiver: standards-based real WebRTC media, no demo frames.
 * The separate media gateway must already provide WHEP and a PS4 media source.
 * No account IDs, pairing PINs, or private console tokens are used here.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BXWhepMedia = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function validEndpoint(raw) {
    if (typeof raw !== "string" || raw.length > 512 || !raw.trim()) return null;
    let url;
    try { url = new URL(raw.trim()); } catch { return null; }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!(url.protocol === "https:" || (local && url.protocol === "http:"))) return null;
    if (url.username || url.password || url.search || url.hash || url.pathname === "/") return null;
    if (!url.hostname || /\s/.test(raw)) return null;
    return url.href;
  }

  function resourceUrl(location, endpoint) {
    if (!location) return null;
    try {
      const origin = new URL(endpoint);
      const url = new URL(location, endpoint);
      if (url.origin !== origin.origin || url.username || url.password || url.hash) return null;
      return url.href;
    } catch { return null; }
  }

  function waitForIce(peer, signal, timeoutMs) {
    if (peer.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve, reject) => {
      let done = false;
      const stop = (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        peer.removeEventListener("icegatheringstatechange", changed);
        signal.removeEventListener("abort", aborted);
        if (error) reject(error);
        else resolve();
      };
      const changed = () => {
        if (peer.iceGatheringState === "complete") stop();
      };
      const aborted = () => stop(new Error("cancelled"));
      const timer = setTimeout(() => stop(new Error("ice_timeout")), timeoutMs);
      peer.addEventListener("icegatheringstatechange", changed);
      signal.addEventListener("abort", aborted, { once: true });
      if (signal.aborted) aborted();
      else changed();
    });
  }

  function createReceiver(options) {
    const url = validEndpoint(options && options.endpoint);
    if (!url) throw new Error("invalid_endpoint");
    const fetcher = options.fetcher || ((...args) => fetch(...args));
    const createPeer = options.createPeer || (() => new RTCPeerConnection({ iceServers: [] }));
    const createStream = options.createStream || (() => new MediaStream());
    const onStream = options.onStream || (() => {});
    const onStatus = options.onStatus || (() => {});
    const onMetrics = options.onMetrics || (() => {});
    const requestTimeoutMs = Number.isInteger(options.requestTimeoutMs) &&
      options.requestTimeoutMs >= 20 && options.requestTimeoutMs <= 30000
      ? options.requestTimeoutMs : 15000;
    const noVideoTimeoutMs = Number.isInteger(options.noVideoTimeoutMs) &&
      options.noVideoTimeoutMs >= 20 && options.noVideoTimeoutMs <= 120000
      ? options.noVideoTimeoutMs : 20000;
    const token = options.token || "";
    if (typeof token !== "string" || token.length > 2048 || /[\r\n]/.test(token)) {
      throw new Error("invalid_token");
    }
    const auth = token ? { Authorization: "Bearer " + token } : {};
    const headers = Object.assign({ "Content-Type": "application/sdp", Accept: "application/sdp" }, auth);
    const controller = new AbortController();
    let active = true;
    let peer = null;
    let session = null;
    const media = createStream();
    let started = false;
    let metricsTimer = null;
    let metricsInFlight = false;
    let videoWatchdog = null;
    let decodedVideo = false;
    const observed = { videoTrack: false, audioTrack: false };

    async function sampleMetrics(current) {
      if (!active || current !== peer || metricsInFlight ||
          typeof current.getStats !== "function") return;
      metricsInFlight = true;
      try {
        const report = await current.getStats();
        if (!active || current !== peer) return;
        const snapshot = {
          videoTrack: observed.videoTrack, audioTrack: observed.audioTrack,
          videoFramesDecoded: 0, videoBytesReceived: 0,
          audioBytesReceived: 0, audioPacketsReceived: 0,
          videoWidth: 0, videoHeight: 0, packetsLost: 0
        };
        if (report && typeof report.forEach === "function") report.forEach(item => {
          if (!item || item.type !== "inbound-rtp" || item.isRemote === true) return;
          const kind = item.kind || item.mediaType;
          const positive = value => Number.isFinite(value) && value >= 0 ? value : 0;
          if (kind === "video") {
            snapshot.videoBytesReceived += positive(item.bytesReceived);
            snapshot.videoFramesDecoded += positive(item.framesDecoded);
            snapshot.videoWidth = Math.max(snapshot.videoWidth, positive(item.frameWidth));
            snapshot.videoHeight = Math.max(snapshot.videoHeight, positive(item.frameHeight));
          } else if (kind === "audio") {
            snapshot.audioBytesReceived += positive(item.bytesReceived);
            snapshot.audioPacketsReceived += positive(item.packetsReceived);
          }
          snapshot.packetsLost += positive(item.packetsLost);
        });
        if (snapshot.videoFramesDecoded > 0) {
          decodedVideo = true;
          if (videoWatchdog !== null) {
            clearTimeout(videoWatchdog);
            videoWatchdog = null;
          }
        }
        onMetrics(snapshot);
      } catch {
        /* Stats unavailable is not a connection failure. No fake success. */
      } finally {
        metricsInFlight = false;
      }
    }

    function stop() {
      if (!active) return;
      active = false;
      controller.abort();
      if (videoWatchdog !== null) {
        clearTimeout(videoWatchdog);
        videoWatchdog = null;
      }
      if (metricsTimer !== null) {
        clearInterval(metricsTimer);
        metricsTimer = null;
      }
      if (peer) {
        peer.ontrack = null;
        peer.onconnectionstatechange = null;
        try { peer.close(); } catch {}
        peer = null;
      }
      onStream(null);
      if (session) {
        const terminate = session;
        session = null;
        /* WHEP session deletion is best effort; never send a token elsewhere. */
        fetcher(terminate, {
          method: "DELETE", mode: "cors", credentials: "omit", redirect: "error",
          headers: auth, cache: "no-store", referrerPolicy: "no-referrer"
        }).catch(() => {});
      }
    }

    async function start() {
      if (started || !active) throw new Error("already_started");
      started = true;
      try {
        onStatus("Preparando vídeo e áudio via WebRTC...");
        peer = createPeer();
        peer.addTransceiver("video", { direction: "recvonly" });
        peer.addTransceiver("audio", { direction: "recvonly" });
        const current = peer;
        current.ontrack = (event) => {
          if (!active || current !== peer || !event.track) return;
          if (event.track.kind === "video") observed.videoTrack = true;
          if (event.track.kind === "audio") observed.audioTrack = true;
          if (!media.getTracks().some(track => track.id === event.track.id)) {
            media.addTrack(event.track);
          }
          onStream(media);
          onStatus("Trilha de mídia recebida; aguardando reprodução.");
        };
        current.onconnectionstatechange = () => {
          if (!active || current !== peer) return;
          if (current.connectionState === "connected") onStatus("WebRTC conectado; conferindo reprodução.");
          else if (["failed", "disconnected"].includes(current.connectionState)) {
            onStatus("A conexão WebRTC caiu. Confira o gateway de mídia.");
          }
        };
        const offer = await current.createOffer();
        if (!active) throw new Error("cancelled");
        await current.setLocalDescription(offer);
        await waitForIce(current, controller.signal, 12000);
        if (!active) throw new Error("cancelled");

        /* Bound a silent WHEP gateway or broken CORS request. Never wait forever.
         * Promise.race handles injected test fetchers that ignore AbortSignal.
         */
        let requestTimer = null;
        let requestExpired = false;
        let response;
        try {
          const request = fetcher(url, {
            method: "POST", mode: "cors", credentials: "omit", redirect: "error",
            headers, body: current.localDescription.sdp, signal: controller.signal,
            cache: "no-store", referrerPolicy: "no-referrer"
          });
          response = await Promise.race([
            request,
            new Promise((_, reject) => {
              requestTimer = setTimeout(() => {
                requestExpired = true;
                controller.abort();
                reject(new Error("gateway_timeout"));
              }, requestTimeoutMs);
            })
          ]);
        } catch (error) {
          if (requestExpired) throw new Error("gateway_timeout");
          if (error && (error.name === "TypeError" || error.name === "NetworkError"))
            throw new Error("gateway_network_error");
          throw error;
        } finally {
          if (requestTimer !== null) clearTimeout(requestTimer);
        }
        if (!active) throw new Error("cancelled");
        if (response.status !== 201) throw new Error("whep_http_" + response.status);
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (!contentType.includes("application/sdp")) throw new Error("invalid_sdp_type");
        const resource = resourceUrl(response.headers.get("location"), url);
        if (!resource) throw new Error("invalid_session_url");
        session = resource;
        /* The fetch timeout ends when headers arrive. Bound body reading too:
         * a gateway can return 201 and then never finish its SDP response.
         * Race cancellation explicitly even for readers ignoring AbortSignal.
         */
        const answer = await new Promise((resolve, reject) => {
          let bodyTimer = null;
          const finish = (error, value) => {
            if (bodyTimer !== null) clearTimeout(bodyTimer);
            controller.signal.removeEventListener("abort", cancelled);
            if (error) reject(error);
            else resolve(value);
          };
          const cancelled = () => finish(new Error("cancelled"));
          controller.signal.addEventListener("abort", cancelled, { once: true });
          if (controller.signal.aborted) { cancelled(); return; }
          bodyTimer = setTimeout(() => {
            finish(new Error("gateway_timeout"));
            controller.abort();
          }, requestTimeoutMs);
          Promise.resolve().then(() => response.text()).then(
            body => finish(null, body), error => finish(error)
          );
        });
        if (!/^v=0\r?\n/.test(answer) || answer.length > 200000) throw new Error("invalid_sdp");
        if (!active) throw new Error("cancelled");
        await current.setRemoteDescription({ type: "answer", sdp: answer });
        if (!active) throw new Error("cancelled");
        onStatus("Sessão WebRTC criada. Aguardando vídeo e áudio do gateway.");
        await sampleMetrics(current);
        if (active && current === peer && !decodedVideo) {
          videoWatchdog = setTimeout(() => {
            if (active && current === peer && !decodedVideo) {
              onStatus("Gateway respondeu, mas nenhum quadro de vídeo foi decodificado. Confira se há fonte real e conexão ICE/UDP.");
            }
          }, noVideoTimeoutMs);
        }
        if (active && current === peer) {
          metricsTimer = setInterval(() => { void sampleMetrics(current); }, 2000);
        }
        return true;
      } catch (error) {
        stop();
        throw error;
      }
    }

    return Object.freeze({ start, stop });
  }

  return Object.freeze({ validEndpoint, resourceUrl, createReceiver });
});
