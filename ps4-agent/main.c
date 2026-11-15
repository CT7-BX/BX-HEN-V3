/*
 * BX-REMOTE-PLAY PS4 diagnostic application (experimental).
 *
 * Public GET-only connectivity probe using the PS4's sceNet/sceSsl/sceHttp
 * interfaces. Does NOT open ports, capture a game, inject controller inputs,
 * send console identifiers, or establish a Remote Play session.
 *
 * No firmware offsets, GoldHEN private APIs, or exploit components.
 * Inspect ps4-agent/README.md before attempting a hardware build.
 */
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include <orbis/Net.h>
#include <orbis/Ssl.h>
#include <orbis/Http.h>

#include "probe_contract.h"

#define PROBE_URL "https://ct7-bx.github.io/BX-REMOTE-PLAY/remote/ps4-probe.txt"
#define PROBE_LOG "/data/bx-remote-play-probe.txt"
#define RESPONSE_CAP 128
#define POOL_BYTES (256 * 1024)
#define SSL_BYTES (128 * 1024)
#define HTTP_BYTES (128 * 1024)

typedef struct ProbeOutcome {
    const char *stage;
    int error;
    int status;
    int matched;
    size_t received;
} ProbeOutcome;

static void log_result(const ProbeOutcome *outcome)
{
    FILE *file = fopen(PROBE_LOG, "w");
    FILE *streams[2] = { stdout, file };
    int i;

    for (i = 0; i < 2; ++i) {
        FILE *out = streams[i];
        if (out == NULL) continue;
        fprintf(out, "BX-REMOTE-PLAY PS4 probe 0.1\n");
        fprintf(out, "site=%s\n", PROBE_URL);
        fprintf(out, "stage=%s\n", outcome->stage);
        fprintf(out, "result=%s\n", outcome->matched ? "OK" : "FAILED");
        fprintf(out, "error=%d\n", outcome->error);
        fprintf(out, "http_status=%d\n", outcome->status);
        fprintf(out, "body_bytes=%lu\n", (unsigned long)outcome->received);
        fprintf(out, "streaming=NOT_IMPLEMENTED\n");
        fprintf(out, "control_bridge=NOT_IMPLEMENTED\n");
        fprintf(out, "report=%s\n", PROBE_LOG);
        fflush(out);
    }
    if (file != NULL) fclose(file);
}

int main(void)
{
    ProbeOutcome result = { "init", 0, 0, 0, 0 };
    int net_ready = 0;
    int pool_id = -1;
    int ssl_id = -1;
    int http_id = -1;
    int template_id = -1;
    int connection_id = -1;
    int request_id = -1;
    char response[RESPONSE_CAP];
    int n;

    memset(response, 0, sizeof(response));

    result.stage = "net_init";
    result.error = sceNetInit();
    if (result.error < 0) goto finish;
    net_ready = 1;

    result.stage = "net_pool";
    pool_id = sceNetPoolCreate("bx_remote_probe", POOL_BYTES, 0);
    if (pool_id < 0) { result.error = pool_id; goto finish; }

    result.stage = "ssl_init";
    ssl_id = sceSslInit(SSL_BYTES);
    if (ssl_id < 0) { result.error = ssl_id; goto finish; }

    result.stage = "http_init";
    http_id = sceHttpInit(pool_id, ssl_id, HTTP_BYTES);
    if (http_id < 0) { result.error = http_id; goto finish; }

    result.stage = "http_template";
    template_id = sceHttpCreateTemplate(
        http_id, "BX-REMOTE-PLAY-PS4-Probe/0.1", ORBIS_HTTP_VERSION_1_1, 1);
    if (template_id < 0) { result.error = template_id; goto finish; }

    result.stage = "https_connect";
    connection_id = sceHttpCreateConnectionWithURL(template_id, PROBE_URL, false);
    if (connection_id < 0) { result.error = connection_id; goto finish; }

    result.stage = "https_request";
    request_id = sceHttpCreateRequestWithURL(
        connection_id, ORBIS_METHOD_GET, PROBE_URL, 0);
    if (request_id < 0) { result.error = request_id; goto finish; }

    /* Keep HTTPS certificate verification enabled (do not disable checks). */
    sceHttpSetConnectTimeOut(request_id, 10000000);
    sceHttpSetResolveTimeOut(request_id, 10000000);
    sceHttpSetSendTimeOut(request_id, 10000000);

    result.stage = "https_send";
    result.error = sceHttpSendRequest(request_id, NULL, 0);
    if (result.error < 0) goto finish;

    result.stage = "http_status";
    result.error = sceHttpGetStatusCode(request_id, &result.status);
    if (result.error < 0) goto finish;
    if (result.status != 200) {
        result.error = -2; /* HTTP response, but not expected 200. */
        goto finish;
    }

    result.stage = "http_body";
    for (;;) {
        if (result.received >= sizeof(response)) {
            result.error = -3; /* Avoid unbounded or overlong responses. */
            goto finish;
        }
        n = sceHttpReadData(
            request_id, response + result.received,
            (uint32_t)(sizeof(response) - result.received));
        if (n < 0) { result.error = n; goto finish; }
        if (n == 0) break;
        result.received += (size_t)n;
    }

    result.stage = "validate_marker";
    result.matched = bx_remote_probe_matches(response, result.received);
    if (!result.matched) result.error = -4;

finish:
    if (request_id >= 0) sceHttpDeleteRequest(request_id);
    if (connection_id >= 0) sceHttpDeleteConnection(connection_id);
    if (template_id >= 0) sceHttpDeleteTemplate(template_id);
    if (http_id >= 0) sceHttpTerm(http_id);
    if (ssl_id >= 0) sceSslTerm(ssl_id);
    if (pool_id >= 0) sceNetPoolDestroy(pool_id);
    if (net_ready) sceNetTerm();

    log_result(&result);
    return result.matched ? 0 : 1;
}
