#ifndef BX_REMOTE_PROBE_CONTRACT_H
#define BX_REMOTE_PROBE_CONTRACT_H

#include <stddef.h>

/* Public, unprivileged probe. Never contains pairing credentials or console IDs. */
#define BX_REMOTE_PROBE_MARKER "BX-REMOTE-PLAY/PS4-PROBE/1\n"

/* Exact byte comparison: reject empty, partial, or misleading HTTP bodies. */
int bx_remote_probe_matches(const char *bytes, size_t length);

#endif
