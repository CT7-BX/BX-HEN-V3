# DNS study and performance controls — client v16

Read-only study: seven A lookups per provider for bx-native-stream.4rt949zpj8.workers.dev, from the local computer with dig. Median: configured_default 38 ms; Cloudflare 31 ms; Google 35 ms; Quad9 18 ms. Maxima: 54/39/38/55 ms. All 28 succeeded; all providers returned the same two IPv4 addresses. This is a small warm/cache-dependent sample, not a PS4 measurement, an IPv6 comparison, or a game latency measurement.

The existing console uses a persistent verified WSS, not DNS on each media packet. Faster lookup can help connection setup/reconnection; there is no measured gain for ongoing gameplay here. No system/router/PS4 resolver was changed, no IP was pinned, and no unverified DNS fallback was added. The safe implementation is the reproducible read-only tool tools/benchmark_dns.py plus the recorded report delivered to the user.

Primary references:
- https://everything.curl.dev/transfers/conn/reuse.html : connection reuse is checked before DNS.
- https://curl.se/libcurl/c/CURLOPT_DNS_CACHE_TIMEOUT.html : cache default and advice against unnecessary cache tuning.
- https://developers.cloudflare.com/1.1.1.1/ip-addresses/ : public resolver addresses.

Client v16 removes the previous menu ceiling of 30 fps / 3 Mbps: default 720p60 with protocol-preset bitrate (10 Mbps in pinned Chiaki); optional 1080p60 uses preset 15 Mbps and depends on console support. A custom profile accepts valid 360/540/720/1080 resolution presets, 30/60 fps and nonnegative integer kbps up to the signed C API range, instead of silently clipping to 3 Mbps. Zero means use the preset's rate, not adaptive unlimited bandwidth. The PS4 can reject/downgrade unsupported requests; no physical confirmation of 60fps/1080p or custom rates is claimed.

Finite queues, framing/memory checks, stale-media cleanup, TLS and authentication remain: these are correctness and bounded-latency protections, not throughput throttles. Removing them permits unbounded memory/latency or breaks the wire protocol. No artificial sleep/frame throttle was removed without evidence. Video timestamps now use the requested FPS rather than always 33333 microseconds.

The PS4 payload remains v15, the previous client WASM remains unchanged, and saved registration/key are preserved. More bandwidth/FPS can increase load and stutter; stability presets remain available. BX-HEN is unchanged; no paid service added. Physical comparison is still required after reopening the client.
