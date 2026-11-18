# Client v14 — bounded queues and disconnect recovery

Keeps the existing v13 PS4 payload and relay protocol. No ELF/configuration/registration replacement is required. The v13 physical report was idle with push_messages=817, confirming receipt of pushed envelopes but not end-to-end gameplay performance. The user still reports lag, stalls and disconnects.

The pinned upstream virtual receive queue evicted the oldest packet on overflow for both UDP and TCP. TCP byte eviction corrupts a stream. The client now tracks queue bytes, limits each TCP socket to 2 MiB/2048 packets and fails the transport on TCP overflow/allocation failure instead of silently losing bytes. UDP remains atomic and retains the existing oldest-datagram eviction policy with an additional 512 KiB bound. These are memory limits, not network latency guarantees.

Transport failure now causes pending recv/select readers to wake and report failure. WebSocket errors clear readiness and explicit disconnect wakes condition waiters. The UI can release the failed connection and reconnect using the saved registration; no automatic gameplay restart is added.

DEBUG logs are excluded before formatting/proxying to the UI thread; INFO/WARNING/ERROR registration diagnostics remain. Gamepad sampling changes from 33 to 16 ms; unchanged values are coalesced, with a 100 ms active-state refresh and immediate changed/neutral input. This is not a measured PS4 input-to-display improvement.

The host fault fixture compiles actual patched queue/read/select functions and tests partial TCP reads, TCP overflow, UDP byte accounting/atomic eviction, indefinite read/select wakeup, and error readiness. JavaScript tests cover faster sampling, coalescing and neutral release along with existing features. Build/source provenance remains pinned; the complete patched Chiaki source accompanies the new WASM artifact. PS4 gameplay and Safari validation remain necessary. No paid resources or BX-HEN edits.
