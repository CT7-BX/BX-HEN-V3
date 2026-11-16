#ifndef BX_NATIVE_DIAG_H
#define BX_NATIVE_DIAG_H

/* Safe, self-contained classification of the PS4's pairing/OTA checkpoints.
 * Pure C: usable in host tests and in the OpenOrbis native VideoOut panel.
 * Never processes credentials, incoming command payloads or local IP data.
 */
enum BXDiagnosticLevel {
    BX_DIAG_WAIT = 0,
    BX_DIAG_GOOD = 1,
    BX_DIAG_WARNING = 2,
    BX_DIAG_FAILURE = 3
};
const char *bx_diag_label(const char *stage);
const char *bx_diag_hint(const char *stage, int http_status);
unsigned bx_diag_progress(const char *stage);
enum BXDiagnosticLevel bx_diag_level(const char *stage, int http_status);

#endif
