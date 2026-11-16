#ifndef BX_OTA_INSTALL_H
#define BX_OTA_INSTALL_H
/* Must only be called after SHA-256 verification and explicit DualShock X.
 * The package remains available at /data/pkg when installation is rejected.
 * Return 0 on install success, negative native return/error on failure.
 */
int bx_ota_install_with_consent(const char *verified_pkg_path);
#endif
