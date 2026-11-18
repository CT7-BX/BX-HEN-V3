# Persistent transport candidate v10

Experimental outgoing verified WSS replaces one-request/one-response HTTPS polling.
Uses the same BXN1 envelopes, separate player/console credentials, bounded 256 KiB
messages, a maximum of 64 outstanding batches and ordered acknowledgements.
A reset barrier discards old in-flight batches before accepting a fresh session.
Loss of the console stream closes the player's logical session, rather than
replaying stale control commands. Reconnect with the saved browser profile.

The v10 build uses the pinned curl 8.13.0 source plus `patch-curl-ws.py` to
preserve data-fragment state across interleaved ping/pong control frames. The
host test reproduces the failure with the original library. Build the patched
archive using the commands in the workflow; do not use the old prebuilt curl
for this candidate.

Build separately: `make -f payload.mk MODE=stream STREAM_CURL_DIR=build/stream-tls` with the same pinned SDK/TLS
libraries as v09. Output `bx-rp-stream-v10.elf`; the existing launcher PKG still
embeds v09. Never run both payloads together. Both use the existing configuration,
lock, stop and report paths. Preserve v09 as a rollback option.

Host tests cover sequencing/window bounds, reset isolation and relay access;
WSS integration tests use a local TLS server that withholds replies until eight
70,000-byte messages arrive, then returns fragmented binary with interleaved ping.
These are synthetic tests and do not validate capture, audio or controls on PS4.

This still uses TCP and a central relay. It does not implement WebRTC or direct
UDP, and cannot guarantee removal of internet latency or TCP head-of-line delays.
Physical PS4 validation and gameplay latency measurements are required before
calling this candidate more stable or faster than v09.
