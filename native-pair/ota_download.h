#ifndef BX_OTA_DOWNLOAD_H
#define BX_OTA_DOWNLOAD_H
#include "update_manifest.h"
#define BX_OTA_PATH_MAX 192
/* Download a strict GitHub Release PKG into /data/pkg and verify SHA-256.
 * No private console token is sent, and no package is installed by this call.
 * Return 1 on verified success, negative on failure.
 */
int bx_ota_fetch_verified(int http_template, const BXUpdateManifest *manifest,
                          char out_path[BX_OTA_PATH_MAX], int *http_status);
#endif
