# PS4 transport v15 — proportional packet scratch buffer

Keeps v13 immediate opt-in downlink, sequencing, TLS, queue bounds and stop/lock/config behavior. A bridge output previously allocated and zero-initialized 65535 stack bytes even for a 28-byte reply. It now validates size before allocating a bounded 28+payload VLA, zeroes all 28 header bytes and copies the full payload. No data beyond the emitted length is sent. Normal socket reads are capped at 16384 bytes; short replies use correspondingly less stack. Maximum supported output remains 65535 bytes and invalid lengths are rejected before allocation.

New fixture checks exact header and payload at 0/1/64/1400/16384/65507 bytes, alternating maximum/empty packets, null payload and oversized/SIZE_MAX rejection under ASan/UBSan. Existing native TCP/UDP and browser fixtures remain. A local -O2 microbenchmark compares actual before/after code over repeated trials; it measures only host function cost, not PS4 FPS or end-to-end latency. Large-packet and small-packet results must be reported separately; no global speedup is promised.

Separate bx-rp-stream-v15.elf, existing config/key/registration unchanged. Preserve v13 for rollback and never launch both. Client remains v14. BX-HEN unchanged, no paid infrastructure. Physical gameplay validation remains pending until the candidate is launched and compared.
