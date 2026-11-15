#ifndef BX_REMOTE_PROBE_DIAGNOSTICS_H
#define BX_REMOTE_PROBE_DIAGNOSTICS_H

/* One retry, only for transient network errors and temporary HTTP failures.
 * Do not retry unexpected content, malformed marker or HTTP 404. */
int bx_probe_should_retry(const char *stage, int http_status);
const char *bx_probe_hint(const char *stage, int http_status);

#endif
