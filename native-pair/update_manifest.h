#ifndef BX_UPDATE_MANIFEST_H
#define BX_UPDATE_MANIFEST_H
#include <stddef.h>
typedef struct BXUpdateManifest {
    unsigned major;
    unsigned minor;
    char version[12];
    char sha256[65];
    char pkg_url[256];
} BXUpdateManifest;
/* Strict HTTPS-only release metadata. Never install based on this text alone. */
int bx_update_parse(const char *text, BXUpdateManifest *out);
int bx_update_is_newer(const BXUpdateManifest *manifest, unsigned major, unsigned minor);
#endif
