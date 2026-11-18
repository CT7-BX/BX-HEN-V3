# Local device profile

The explicit Save on this device button stores a validated registration and player authorization key in IndexedDB on the current origin/browser. PIN, Account-ID, raw logs and arbitrary imported fields are excluded. No device profile is uploaded to the relay. This is local browser storage, not a cloud account or cross-device sync, and does not protect against a compromised browser/origin.

Connect and play restores the validated profile, primes Web Audio during the user's click, authorizes the existing relay path, and requests a session without registration or file import. Import/export remain available. Forget deletes the persisted profile; the user can explicitly disconnect the active session separately. Storage failures preserve manual flows. Browser data clearing/private-mode restrictions can remove/prevent persistence.

A saved registration belongs to the console/account, not the Wi-Fi network. Changing networks may interrupt a live connection, but does not by itself require a new registration/PIN. Revocation, resetting the console/account, or invalid registration credentials can require registration again.

Validation: relay/player tests include simulated page reload, saved playback startup with no registration call, whitelisting, forgetting and storage failure. A real desktop browser IndexedDB test saved/read/deleted synthetic values and checked that PIN/Account-ID were excluded. This does not establish iPhone/Android persistence or actual gameplay.
