const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validEndpoint, resourceUrl, createReceiver } = require("../media-whep.js");

const base = "https://media.example.test/live/ps4/whep";
class FakeStream {
  tracks = [];
  getTracks() { return this.tracks; }
  addTrack(track) { this.tracks.push(track); }
}
class FakePeer {
  transceivers = [];
  iceGatheringState = "complete";
  connectionState = "new";
  closed = false;
  addTransceiver(kind, options) { this.transceivers.push([kind, options.direction]); }
  async createOffer() { return { type: "offer", sdp: "v=0\r\nmock=offer\r\n" }; }
  async setLocalDescription(offer) { this.localDescription = offer; }
  async setRemoteDescription(answer) {
    this.remoteDescription = answer;
    this.ontrack({ track: { id: "real-track-1" } });
  }
  close() { this.closed = true; }
}

function goodResponse(location = "/sessions/abc") {
  return {
    status: 201,
    headers: { get(name) {
      if (name === "location") return location;
      if (name === "content-type") return "application/sdp";
      return null;
    } },
    text: async () => "v=0\r\nmock=answer\r\n"
  };
}

test("only user-supplied HTTPS WHEP endpoints or localhost HTTP are accepted", () => {
  assert.equal(validEndpoint(base), base);
  assert.equal(validEndpoint("http://localhost:8889/live/whep"), "http://localhost:8889/live/whep");
  for (const input of ["https://media.example.test/", "http://media.example.test/live/whep",
    "wss://media.example.test/live/whep", "https://user:pass@media.example.test/whep",
    "https://media.example.test/whep?token=private", "https://media.example.test/whep#x"]) {
    assert.equal(validEndpoint(input), null, input);
  }
  assert.equal(resourceUrl("/sessions/abc", base), "https://media.example.test/sessions/abc");
  assert.equal(resourceUrl("https://bad.example.test/private", base), null);
  assert.equal(resourceUrl("javascript:alert(1)", base), null);
});

test("WHEP negotiates recvonly audio+video, attaches real tracks, and revokes same-origin session", async () => {
  const calls = [], attached = [], statuses = [], peer = new FakePeer();
  const receiver = createReceiver({
    endpoint: base, token: "separate-media-token",
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return options.method === "POST" ? goodResponse() : { status: 200 };
    },
    createPeer: () => peer,
    createStream: () => new FakeStream(),
    onStream: stream => attached.push(stream),
    onStatus: status => statuses.push(status)
  });
  assert.equal(await receiver.start(), true);
  assert.deepEqual(peer.transceivers, [["video", "recvonly"], ["audio", "recvonly"]]);
  assert.equal(peer.remoteDescription.type, "answer");
  assert.equal(calls[0].url, base);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer separate-media-token");
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(attached[0].getTracks()[0].id, "real-track-1");
  assert.ok(statuses.some(s => s.includes("WebRTC")));
  receiver.stop();
  assert.equal(peer.closed, true);
  assert.equal(attached.at(-1), null);
  assert.equal(calls.at(-1).options.method, "DELETE");
  assert.equal(calls.at(-1).url, "https://media.example.test/sessions/abc");
  assert.equal(calls.at(-1).options.headers.Authorization, "Bearer separate-media-token");
});

test("does not follow cross-origin WHEP session links or leak bearer credentials", async () => {
  const calls = [];
  const peer = new FakePeer();
  const receiver = createReceiver({
    endpoint: base, token: "private-media-token",
    createPeer: () => peer, createStream: () => new FakeStream(),
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return goodResponse("https://other.example.test/steal-token");
    }
  });
  await assert.rejects(receiver.start(), /invalid_session_url/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, base);
  assert.equal(peer.closed, true);
});

test("rejects fake media HTTP responses instead of reporting a PS4 video stream", async () => {
  const streams = [], peer = new FakePeer();
  const receiver = createReceiver({
    endpoint: base,
    createPeer: () => peer, createStream: () => new FakeStream(),
    onStream: stream => streams.push(stream),
    fetcher: async () => ({ status: 200, headers: { get: () => null } })
  });
  await assert.rejects(receiver.start(), /whep_http_200/);
  assert.equal(peer.closed, true);
  assert.deepEqual(streams, [null]);
});

test("real WebRTC stats distinguish decoded video and received audio without proving PS4 origin", async () => {
  const measurements = [], peer = new FakePeer();
  peer.getStats = async () => new Map([
    ["video", { type: "inbound-rtp", isRemote: false, kind: "video",
      bytesReceived: 192000, framesDecoded: 42, frameWidth: 1280, frameHeight: 720, packetsLost: 2 }],
    ["audio", { type: "inbound-rtp", isRemote: false, kind: "audio",
      bytesReceived: 20480, packetsReceived: 30, packetsLost: 1 }],
    ["sender", { type: "outbound-rtp", kind: "video", bytesSent: 1234567 }]
  ]);
  const receiver = createReceiver({
    endpoint: base, createPeer: () => peer, createStream: () => new FakeStream(),
    fetcher: async (url, options) => options.method === "POST" ? goodResponse() : { status: 200 },
    onMetrics: metric => measurements.push(metric)
  });
  assert.equal(await receiver.start(), true);
  assert.equal(measurements.length, 1);
  assert.equal(measurements[0].videoFramesDecoded, 42);
  assert.equal(measurements[0].videoBytesReceived, 192000);
  assert.equal(measurements[0].audioBytesReceived, 20480);
  assert.equal(measurements[0].audioPacketsReceived, 30);
  assert.equal(measurements[0].videoWidth, 1280);
  assert.equal(measurements[0].videoHeight, 720);
  assert.equal(measurements[0].packetsLost, 3);
  assert.equal("ps4Verified" in measurements[0], false);
  receiver.stop();
});

test("WHEP connection timeout closes peer instead of hanging forever", async () => {
  const peer = new FakePeer(), attached = [];
  const receiver = createReceiver({
    endpoint: base, requestTimeoutMs: 30,
    createPeer: () => peer, createStream: () => new FakeStream(),
    onStream: stream => attached.push(stream),
    fetcher: () => new Promise(() => {})
  });
  await assert.rejects(receiver.start(), /gateway_timeout/);
  assert.equal(peer.closed, true);
  assert.equal(attached.at(-1), null);
});

test("WHEP handshake without decoded video warns clearly rather than claiming gameplay", async () => {
  const peer = new FakePeer(), statuses = [];
  peer.getStats = async () => new Map([
    ["video", { type: "inbound-rtp", kind: "video", bytesReceived: 0, framesDecoded: 0 }]
  ]);
  const receiver = createReceiver({
    endpoint: base, noVideoTimeoutMs: 30,
    createPeer: () => peer, createStream: () => new FakeStream(),
    fetcher: async (url, opts) => opts.method === "POST" ? goodResponse() : {status:200},
    onStatus: text => statuses.push(text)
  });
  await receiver.start();
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.ok(statuses.some(x => x.includes("nenhum quadro de vídeo foi decodificado")));
  assert.ok(statuses.every(x => !x.includes("jogo iniciado")));
  receiver.stop();
  assert.equal(peer.closed, true);
});

test("received video frames prevent the missing-video warning", async () => {
  const peer = new FakePeer(), statuses = [];
  peer.getStats = async () => new Map([
    ["video", { type: "inbound-rtp", kind: "video", bytesReceived: 1200, framesDecoded: 5 }]
  ]);
  const receiver = createReceiver({
    endpoint: base, noVideoTimeoutMs: 30,
    createPeer: () => peer, createStream: () => new FakeStream(),
    fetcher: async (url, opts) => opts.method === "POST" ? goodResponse() : {status:200},
    onStatus: text => statuses.push(text)
  });
  await receiver.start();
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(statuses.some(x => x.includes("nenhum quadro de vídeo foi decodificado")), false);
  receiver.stop();
});

test("main screen exposes WHEP controls separately from HTTP pairing and WSS simulator", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(html, /id="mediaSection"/);
  assert.match(html, /id="mediaEndpoint"/);
  assert.match(html, /id="mediaToken"[^>]+type="password"|id="mediaToken"/);
  assert.match(html, /id="mediaDisconnect"/);
  assert.match(html, /id="mediaConnectionMode"/);
  assert.match(html, /id="mediaGatewayFields" hidden/);
  assert.match(html, /id="mediaNoGateway"/);
  assert.match(html, /<video[^>]+autoplay muted playsinline/);
  assert.match(html, /Sem fonte de mídia conectada/);
  assert.match(html, /id="realAvTest"/);
  assert.match(html, /id="mediaHealth"/);
  assert.match(html, /não é o código de oito dígitos/);
  assert.match(html, /Chiaki-NG-Web/);
  assert.match(html, /src="\.\/media-whep\.js(?:\?v=[\d.]+)?"/);
  assert.match(html, /src="\.\/media-controls\.js(?:\?v=[\d.]+)?"/);
  assert.match(html, /o Worker BX-REMOTE-LINK não é um servidor WHEP/);
  assert.match(html, /id="pairSection"/);
  assert.match(html, /id="relaySection"/);
});

// Headers arriving do not mean the SDP body has finished arriving.
for (const cancel of [false, true]) {
  test(`WHEP stalled SDP body ${cancel ? "cancels promptly" : "times out"} and releases session`, { timeout: 1000 }, async () => {
    const peer = new FakePeer(), calls = [];
    let bodyStarted;
    const reading = new Promise(resolve => { bodyStarted = resolve; });
    const receiver = createReceiver({
      endpoint: base, requestTimeoutMs: 30,
      createPeer: () => peer, createStream: () => new FakeStream(),
      fetcher: async (url, options) => {
        calls.push({ url, options });
        if (options.method === "DELETE") return { status: 200 };
        return { ...goodResponse(), text: () => {
          bodyStarted();
          return new Promise(() => {}); // Ignores AbortSignal deliberately.
        } };
      }
    });
    const started = receiver.start();
    const rejected = assert.rejects(started, cancel ? /cancelled/ : /gateway_timeout/);
    await reading;
    if (cancel) receiver.stop();
    await rejected;
    assert.equal(peer.closed, true);
    assert.equal(peer.remoteDescription, undefined);
    assert.equal(calls.filter(call => call.options.method === "DELETE").length, 1);
  });
}
