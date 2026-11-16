#ifndef BX_REMOTEPLAY_PROBE_H
#define BX_REMOTEPLAY_PROBE_H
/* Probe PS4 built-in Remote Play TCP listener on localhost:9295.
 * Returns 1=open, 0=closed/inaccessible, -1=socket error.
 * NOT proof of a playable Remote Play video/audio session.
 */
int bx_remoteplay_probe_loopback(void);
#endif
