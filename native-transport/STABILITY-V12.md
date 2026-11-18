# Stability candidate v12 — evidence and limits

The player now detects an active direct-only payload in Automatic mode, preserves the internet relay route when available, locks route selection during connection and gives a specific error for a relay/direct mismatch. Native availability is not confused with successful Remote Play playback.

Relay session expiry renews with valid transport activity; expired sessions still reset and never replay control writes. Native v12 uses the same verified persistent WSS and configuration as v10, with optimized compilation, TCP_NODELAY on loopback stream sockets, stat-based stop checks and monotonic report timestamps. No external relay provider or paid resource was added. The relay still traverses the existing server; these changes do not eliminate geographical RTT or TCP head-of-line blocking.

Audio scheduled more than 100 ms ahead is cleared before adding current audio. Decoded frames delayed over 100 ms inside the browser are released rather than displayed; dependent encoded frames are still decoded normally, with the existing keyframe recovery on decoder saturation. These bounds do not measure total PS4-to-display latency.

Direct v11 remains LAN-only and cannot run alongside v12. Use bx-rp-stream-v12.elf for internet and Automatic on the site. Credentials and saved registrations remain unchanged. Never delete a live payload lock; confirm stopped or reboot first. BX-HEN is unchanged.

Validation must distinguish unit tests, real localhost TCP/UDP/browser fixtures, PS4 compilation, and physical PS4 gameplay. Physical comparison of v12 lag/continuity on Wi-Fi and cellular is pending. No claim of maximum or stable performance is justified yet.
