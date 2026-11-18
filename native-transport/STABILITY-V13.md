# v13 — immediate internet downlink candidate

Measured physical v12 transport samples: RTT 150/139/144/140 ms, 20/31/23/21 batches in flight, output queue 16 bytes (empty envelope). User reported improvement. These are transport samples, not total input-to-display measurements.

The v13 console opts into X-BX-Downlink: push-v1 over the existing authenticated verified WSS. Once its current epoch has been acknowledged, browser socket records are pushed immediately with sequence zero rather than waiting for the next console batch. The payload validates complete framing and matching epoch before delivering records, without consuming the ACK window. Commands are never retried/replayed on a new session. Existing v12/HTTP paths retain queued ACK delivery. Queue limits, reset barriers and ownership checks remain.

This removes a batch wait, not internet RTT or TCP head-of-line blocking. No paid service, new host, credentials or BX-HEN change. Use only bx-rp-stream-v13.elf; preserve v12 for rollback and never run both. The existing PKG still embeds v09. Native compilation, synthetic protocol tests and physical gameplay must be reported separately.
