#include "ota_install.h"
#include <orbis/AppInstUtil.h>
#include <string.h>

int bx_ota_install_with_consent(const char *verified_pkg_path) {
    char title_id[32] = {0};
    int is_app = 0, result, initialized = 0;
    if (!verified_pkg_path || strncmp(verified_pkg_path,
        "/data/pkg/BX-REMOTE-PLAY-Pair-Test-v", 35) != 0) return -100;
    result = sceAppInstUtilInitialize();
    if (result != 0) return result;
    initialized = 1;
    result = sceAppInstUtilGetTitleIdFromPkg(verified_pkg_path,title_id,&is_app);
    if (result != 0) goto finish;
    /* A newer package must be for this exact installed homebrew. */
    if (!is_app || strcmp(title_id,"BRPM00001")) {result=-101;goto finish;}
    result = sceAppInstUtilAppPrepareOverwritePkg(verified_pkg_path);
    if (result != 0) goto finish;
    result = sceAppInstUtilAppInstallPkg(verified_pkg_path,NULL);
finish:
    if (initialized) sceAppInstUtilTerminate();
    return result;
}
