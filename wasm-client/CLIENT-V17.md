# Client v17 — video loss recovery

User reports approximately 60 observed fps and an improvement with occasional frame drops, without session disconnects. Physical v15 samples during that report: RTT 134–160 ms (median 137), max 33 in-flight batches, all sampled error codes zero; sampled output queue 16 bytes. These do not measure input-to-display latency or establish long-term stability.

The pinned receiver already supports enable_idr_on_fec_failure, but the web session wrapper left it zero/disabled. The client now enables it. On an unrecoverable FEC frame the upstream receiver requests a complete frame and suppresses additional successful requests while waiting for an intra frame. This is the existing upstream protocol path, not new PS4/HEN code. It does not recover every network loss, eliminate relay RTT, or guarantee no frame drops.

The player displays the bounded native frames_lost count supplied with completed samples. This is the receiver's count, not browser/render drops or an exact loss percentage. Counter resets per playback. The requested 60fps/custom bitrate modes remain unchanged; no forced resolution/bitrate downgrade was added. Existing native auto-negotiation still applies.

Host fixture compiles the actual pinned FEC-failure branch with mocked network/mutex/event functions: feature flag, successful-request suppression over 60 further failures, leaving waiting state and failure state are checked. It is not physical PS4 or video recovery validation. Real-browser/JS tests check client loading and counter behavior. Full patched client source accompanies the rebuilt WASM. Payload remains v15; key/registration/BX-HEN unchanged; no paid service.
