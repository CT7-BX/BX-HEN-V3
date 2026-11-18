# Free direct LAN candidate — v11

This candidate exchanges authenticated SDP over the existing HTTPS service, then
sends the existing Chiaki socket records directly between browser and PS4 using
WebRTC DTLS/SCTP over UDP. During setup/gameplay it does not poll HTTPS. One
reliable ordered binary channel is used initially; this is not an unreliable
media transport. It is explicitly a LAN candidate, not validated internet ICE.
No paid hosting, third-party STUN/TURN or home PC is required by this LAN mode.

Networking base: Control4Free, GPL-3.0, commit
`f18f4a80c05bee31a354a5792b47f4aafe71bfdd`,
https://github.com/MoHadiShibli/Control4Free . The exact source archive is SHA256
`0e9c41570e3154174dcbd05d8a100063750c0dfe8abb54120944dc6727a41973`.
`fetch-source.py` imports only RTC, STUN, SCTP, their headers and the bundled
Mbed TLS 3.6 source/configuration (Apache-2.0). No controller/HEN code is built.
Changes add bounded binary records, a one-peer limit, longer idle tolerance,
queue budget/RTT helpers, a bounded fingerprint formatter and a 65535-byte message limit. Upstream licenses,
original archive and modified sources accompany the ELF artifact.

Build:

1. Use the existing pinned payload SDK/13.52 CRT and TLS bundle.
2. `python3 direct/fetch-source.py build/direct/deps`
3. `make -f payload.mk MODE=direct`

Separate output: `bx-rp-direct-v11.elf`. Never run together with v09/v10. Existing
`/user/data/bx-rp-transport.cfg` is reused; credentials are not changed. The public
LAN IPv4 of the PS4 must be in `/data/bx-rp-direct-ip.txt`, one RFC1918 IPv4 line.
The UDP listener uses port 4285. The shared stop/lock/report paths are preserved.
Report transport is `webrtc-direct-lan`; `direct_rtt_ms` is SCTP acknowledgement
RTT, not display latency. `bytes_in/out` and queue size contain no secrets.

Player choice: “Direto gratuito — mesma rede, experimental”. Relay mode remains
the default. Registration and saved-device profile remain compatible. Signaling
requires the existing authenticated owner session and a short-lived offer ID;
SDP is kept only in ephemeral room memory and is never logged or put in URLs.

Tests include real desktop browser/native DTLS interoperability, binary messages
through 65535 bytes, the WebSocket-compatible adapter, and TCP/UDP loopback echo
through the existing socket bridge. These do not establish PS4 compatibility,
video/audio/controller performance, Safari behavior or internet connectivity.
Physical validation is required before calling the candidate functional/stable.

Browser/OS background suspension may still stop RTC. Direct setup is LAN-only;
keep the existing relay payload available for internet use. No paid route is
activated. BX-HEN is not modified.
