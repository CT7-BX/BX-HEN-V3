/*
 * BX-REMOTE-PLAY PS4 diagnostic v0.21 (EXPERIMENTAL).
 *
 * Performs at most two public HTTPS GET requests to an exact diagnostic marker.
 * Does not create inbound sockets, run in background, contact accounts, capture
 * games, transmit media, install a plugin or implement Remote Play.
 *
 * Every extra validation here is best-effort until tested on a physical PS4.
 */
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#include <orbis/Net.h>
#include <orbis/Ssl.h>
#include <orbis/Http.h>
#include <orbis/SysUtil.h>

#include "probe_contract.h"
#include "probe_diagnostics.h"

#define PROBE_URL "https://ct7-bx.github.io/BX-REMOTE-PLAY/remote/ps4-probe.txt"
#define PROBE_LOG "/data/bx-remote-play-probe.txt"
#define PROBE_LOG_FALLBACK "/user/data/bx-remote-play-probe.txt"
#define APP_VERSION "0.21"
#define RESPONSE_CAP 128
#define POOL_BYTES (256 * 1024)
#define SSL_BYTES (128 * 1024)
#define HTTP_BYTES (128 * 1024)

typedef struct ProbeOutcome {
    const char *stage;
    int error;
    int status;
    int matched;
    int attempts;
    size_t received;
} ProbeOutcome;

static void log_result(const ProbeOutcome *outcome)
{
    FILE *file = fopen(PROBE_LOG, "w");
    const char *saved_at = PROBE_LOG;
    FILE *streams[2];
    int i;

    if (file == NULL) {
        file = fopen(PROBE_LOG_FALLBACK, "w");
        saved_at = file != NULL ? PROBE_LOG_FALLBACK : "stdout_only";
    }
    streams[0] = stdout;
    streams[1] = file;

    for (i = 0; i < 2; ++i) {
        FILE *out = streams[i];
        if (out == NULL) continue;
        fprintf(out, "BX-REMOTE-PLAY PS4 probe %s\n", APP_VERSION);
        fprintf(out, "site=%s\n", PROBE_URL);
        fprintf(out, "stage=%s\n", outcome->stage);
        fprintf(out, "result=%s\n", outcome->matched ? "OK" : "FAILED");
        fprintf(out, "hint=%s\n", outcome->matched
            ? "HTTPS confirmado (sem Remote Play)"
            : bx_probe_hint(outcome->stage, outcome->status));
        fprintf(out, "attempts=%d\n", outcome->attempts);
        fprintf(out, "error=%d\n", outcome->error);
        fprintf(out, "error_hex=0x%08x\n", (unsigned int)outcome->error);
        fprintf(out, "http_status=%d\n", outcome->status);
        fprintf(out, "body_bytes=%lu\n", (unsigned long)outcome->received);
        fprintf(out, "streaming=NOT_IMPLEMENTED\n");
        fprintf(out, "control_bridge=NOT_IMPLEMENTED\n");
        fprintf(out, "report=%s\n", saved_at);
        fflush(out);
    }
    if (file != NULL) fclose(file);
}

static void probe_once(ProbeOutcome *result)
{
    int net_ready = 0;
    int pool_id = -1;
    int ssl_id = -1;
    int http_id = -1;
    int template_id = -1;
    int connection_id = -1;
    int request_id = -1;
    char response[RESPONSE_CAP];
    int n;

    result->stage = "init";
    result->error = 0;
    result->status = 0;
    result->matched = 0;
    result->received = 0;
    memset(response, 0, sizeof(response));

    result->stage = "net_init";
    result->error = sceNetInit();
    if (result->error < 0) goto finish;
    net_ready = 1;

    result->stage = "net_pool";
    pool_id = sceNetPoolCreate("bx_remote_probe", POOL_BYTES, 0);
    if (pool_id < 0) { result->error = pool_id; goto finish; }

    result->stage = "ssl_init";
    ssl_id = sceSslInit(SSL_BYTES);
    if (ssl_id < 0) { result->error = ssl_id; goto finish; }

    result->stage = "http_init";
    http_id = sceHttpInit(pool_id, ssl_id, HTTP_BYTES);
    if (http_id < 0) { result->error = http_id; goto finish; }

    result->stage = "http_template";
    template_id = sceHttpCreateTemplate(
        http_id, "BX-REMOTE-PLAY-PS4-Probe/" APP_VERSION,
        ORBIS_HTTP_VERSION_1_1, 1);
    if (template_id < 0) { result->error = template_id; goto finish; }

    result->stage = "https_connect";
    connection_id = sceHttpCreateConnectionWithURL(
        template_id, PROBE_URL, false);
    if (connection_id < 0) { result->error = connection_id; goto finish; }

    result->stage = "https_request";
    request_id = sceHttpCreateRequestWithURL(
        connection_id, ORBIS_METHOD_GET, PROBE_URL, 0);
    if (request_id < 0) { result->error = request_id; goto finish; }

    /* Keep TLS certificate verification enabled; never bypass HTTPS. */
    result->stage = "connect_timeout";
    result->error = sceHttpSetConnectTimeOut(request_id, 10000000);
    if (result->error < 0) goto finish;

    result->stage = "resolve_timeout";
    result->error = sceHttpSetResolveTimeOut(request_id, 10000000);
    if (result->error < 0) goto finish;

    result->stage = "send_timeout";
    result->error = sceHttpSetSendTimeOut(request_id, 10000000);
    if (result->error < 0) goto finish;

    result->stage = "https_send";
    result->error = sceHttpSendRequest(request_id, NULL, 0);
    if (result->error < 0) goto finish;

    result->stage = "http_status";
    result->error = sceHttpGetStatusCode(request_id, &result->status);
    if (result->error < 0) goto finish;
    if (result->status != 200) {
        result->error = -2;
        goto finish;
    }

    result->stage = "http_body";
    for (;;) {
        if (result->received >= sizeof(response)) {
            result->error = -3; /* Refuse oversized or unbounded body. */
            goto finish;
        }
        n = sceHttpReadData(
            request_id, response + result->received,
            (uint32_t)(sizeof(response) - result->received));
        if (n < 0) { result->error = n; goto finish; }
        if (n == 0) break;
        result->received += (size_t)n;
    }

    result->stage = "validate_marker";
    result->matched = bx_remote_probe_matches(response, result->received);
    if (!result->matched) {
        result->error = -4;
        goto finish;
    }
    result->stage = "complete";
    result->error = 0;

finish:
    if (request_id >= 0) sceHttpDeleteRequest(request_id);
    if (connection_id >= 0) sceHttpDeleteConnection(connection_id);
    if (template_id >= 0) sceHttpDeleteTemplate(template_id);
    if (http_id >= 0) sceHttpTerm(http_id);
    if (ssl_id >= 0) sceSslTerm(ssl_id);
    if (pool_id >= 0) sceNetPoolDestroy(pool_id);
    if (net_ready) sceNetTerm();
}

int main(void)
{
    ProbeOutcome result = { "init", 0, 0, 0, 0, 0 };
    char notice[224];
    result.attempts = 1;
    probe_once(&result);

    /* Exactly one extra GET when a transient network failure is likely.
     * A 404 or unexpected content must not be hidden by silent retries.
     */
    if (!result.matched && bx_probe_should_retry(result.stage, result.status)) {
        sleep(1);
        result.attempts = 2;
        probe_once(&result);
    }

    log_result(&result);
    if (result.matched) {
        snprintf(notice, sizeof(notice),
            "BX-REMOTE-PLAY v%s: HTTPS OK. Sem streaming ainda.",
            APP_VERSION);
    } else {
        snprintf(notice, sizeof(notice),
            "BX-REMOTE-PLAY v%s: %s. Etapa %s, erro 0x%08x.",
            APP_VERSION, bx_probe_hint(result.stage, result.status),
            result.stage, (unsigned int)result.error);
    }
    /* Toast is best-effort; keep the app alive briefly to make it readable.
     * The persisted report is the primary diagnostic artifact.
     */
    sceSysUtilSendSystemNotificationWithText(222, notice);
    sleep(4);
    return result.matched ? 0 : 1;
}
