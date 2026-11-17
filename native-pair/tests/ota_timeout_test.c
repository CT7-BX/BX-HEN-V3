/* Executes the production downloader with HTTP/filesystem mocks only.
 * This cannot validate PS4 networking or ABI compatibility. */
#include "../ota_download.h"
#include <orbis/Http.h>
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
static int received_timeout, sent, deleted_requests, deleted_connections;
static int reject_timeout;
int bx_test_mkdir(const char *path, mode_t mode) { (void)path; (void)mode; return 0; }
int bx_test_remove(const char *path) { (void)path; return 0; }
int sceHttpGetAllResponseHeaders(int r, char **h, size_t *n) { (void)r; (void)h; (void)n; return -1; }
int sceHttpCreateConnectionWithURL(int t, const char *u, bool k) { (void)t; (void)u; (void)k; return 1; }
int sceHttpCreateRequestWithURL(int c, int m, const char *u, uint64_t n) { (void)c; (void)m; (void)u; (void)n; return 2; }
int sceHttpSetConnectTimeOut(int r, unsigned t) { (void)r; (void)t; return 0; }
int sceHttpSetResolveTimeOut(int r, unsigned t) { (void)r; (void)t; return 0; }
int sceHttpSetSendTimeOut(int r, unsigned t) { (void)r; (void)t; return 0; }
int sceHttpSetRecvTimeOut(int r, unsigned t) {
    assert(r == 2); assert(t == 7000000u); ++received_timeout;
    return reject_timeout ? -1 : 0;
}
int sceHttpSendRequest(int r, const void *b, size_t n) { (void)r; (void)b; (void)n; ++sent; return -77; }
int sceHttpGetStatusCode(int r, int *s) { (void)r; (void)s; assert(0); return -1; }
int sceHttpReadData(int r, void *b, size_t n) { (void)r; (void)b; (void)n; assert(0); return -1; }
int sceHttpDeleteRequest(int r) { assert(r == 2); ++deleted_requests; return 0; }
int sceHttpDeleteConnection(int c) { assert(c == 1); ++deleted_connections; return 0; }
int main(void) {
    BXUpdateManifest m = {0};
    char path[BX_OTA_PATH_MAX];
    int status, result;
    strcpy(m.version, "0.25");
    strcpy(m.pkg_url, "https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/pair-test-v0.25/BX-REMOTE-PLAY-Pair-Test-v0.25.pkg");
    for (reject_timeout = 0; reject_timeout <= 1; ++reject_timeout) {
        received_timeout = sent = deleted_requests = deleted_connections = 0;
        result = bx_ota_fetch_verified(1, &m, path, &status);
        assert(received_timeout == 1);
        assert(result == (reject_timeout ? -4 : -77));
        assert(sent == (reject_timeout ? 0 : 1));
        assert(path[0] == '\0' && status == 0);
        assert(deleted_requests == 1 && deleted_connections == 1);
    }
    puts("OTA receive timeout and cleanup verified with host mocks.");
    return 0;
}
