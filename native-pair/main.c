/*
 * BX-REMOTE-PLAY PS4 Pairing Proof v0.11
 *
 * NEW, SEPARATE PKG. Not the existing v0.21 HTTPS diagnostic.
 * Foreground-only console-side HTTP pairing test, with local DualShock consent.
 * NO persistent payload, NO controller injection, NO game streaming or audio.
 *
 * Requires a privately installed config file; repository/PKG contain NO keys.
 * Compatible with OpenOrbis v0.5.4 headers; hardware execution unverified.
 */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <orbis/Net.h>
#include <orbis/Ssl.h>
#include <orbis/Http.h>
#include <orbis/SysUtil.h>
#include <orbis/UserService.h>
#include <orbis/Pad.h>

#include "pair_config.h"
#include "pair_protocol.h"

#define REPORT_PATH "/data/bx-remote-pairing-report.txt"
#define CONFIG_PATH "/user/data/bx-remote-pair.cfg"
#define CONFIG_FALLBACK "/data/bx-remote-pair.cfg"
#define MAX_RESPONSE_BYTES 1024
#define HTTP_POOL_BYTES (256 * 1024)
#define SSL_POOL_BYTES (128 * 1024)
#define HTTP_MEMORY_BYTES (128 * 1024)
#define POLL_ROUNDS 60

typedef struct HttpContext {
    int initialized_net;
    int pool;
    int ssl;
    int http;
    int tmpl;
} HttpContext;

static void notice(const char *message) {
    sceSysUtilSendSystemNotificationWithText(222, message);
}

static void report(const char *stage, int code, int status) {
    FILE *f = fopen(REPORT_PATH, "w");
    if (!f) f = fopen("/user/data/bx-remote-pairing-report.txt", "w");
    if (!f) return;
    fprintf(f, "BX-REMOTE-PLAY native pairing test 0.11\n");
    fprintf(f, "stage=%s\n", stage ? stage : "unknown");
    fprintf(f, "result_code=%d\nhttp_status=%d\n", code, status);
    fprintf(f, "streaming=NOT_IMPLEMENTED\n");
    fprintf(f, "input_transport=NOT_IMPLEMENTED\n");
    fprintf(f, "autorun=DISABLED\n");
    fclose(f);
}

static void close_http(HttpContext *ctx) {
    if (ctx->tmpl >= 0) sceHttpDeleteTemplate(ctx->tmpl);
    if (ctx->http >= 0) sceHttpTerm(ctx->http);
    if (ctx->ssl >= 0) sceSslTerm(ctx->ssl);
    if (ctx->pool >= 0) sceNetPoolDestroy(ctx->pool);
    if (ctx->initialized_net) sceNetTerm();
}

static int open_http(HttpContext *ctx) {
    memset(ctx, 0, sizeof(*ctx));
    ctx->pool = ctx->ssl = ctx->http = ctx->tmpl = -1;
    if (sceNetInit() < 0) return 0;
    ctx->initialized_net = 1;
    ctx->pool = sceNetPoolCreate("bx_pair_net", HTTP_POOL_BYTES, 0);
    if (ctx->pool < 0) return 0;
    ctx->ssl = sceSslInit(SSL_POOL_BYTES);
    if (ctx->ssl < 0) return 0;
    ctx->http = sceHttpInit(ctx->pool, ctx->ssl, HTTP_MEMORY_BYTES);
    if (ctx->http < 0) return 0;
    ctx->tmpl = sceHttpCreateTemplate(ctx->http, "BX-REMOTE-PLAY-PS4-Pair/0.11",
        ORBIS_HTTP_VERSION_1_1, 1);
    return ctx->tmpl >= 0;
}

/* HTTPS client: origin is strictly validated and comes from private config.
 * The small fixed JSON body is sent only after verification and user action.
 * TLS validation stays enabled. No tokens in URL/logs.
 */
static int call_api(
    const HttpContext *ctx, const BXPairConfig *cfg,
    const char *path, const char *json_post,
    char response[MAX_RESPONSE_BYTES], int *http_status
) {
    char url[260];
    char authorization[80];
    int connection = -1, request = -1, ok = 0;
    int method = json_post ? ORBIS_METHOD_POST : ORBIS_METHOD_GET;
    int n;
    size_t total = 0;

    if (snprintf(url, sizeof(url), "%s%s", cfg->relay_origin, path) >= (int)sizeof(url)) return -10;
    if (snprintf(authorization, sizeof(authorization), "Bearer %s", cfg->console_token)
        >= (int)sizeof(authorization)) return -11;
    response[0] = '\0';
    *http_status = 0;

    connection = sceHttpCreateConnectionWithURL(ctx->tmpl, url, false);
    if (connection < 0) { ok = connection; goto done; }
    request = sceHttpCreateRequestWithURL(
        connection, method, url, json_post ? strlen(json_post) : 0);
    if (request < 0) { ok = request; goto done; }
    if (sceHttpAddRequestHeader(request, "Authorization", authorization, 0) < 0 ||
        (json_post && sceHttpAddRequestHeader(request, "Content-Type", "application/json", 0) < 0)) {
        ok = -12; goto done;
    }
    if (sceHttpSetConnectTimeOut(request, 6000000) < 0 ||
        sceHttpSetResolveTimeOut(request, 6000000) < 0 ||
        sceHttpSetSendTimeOut(request, 6000000) < 0) {
        ok = -13; goto done;
    }
    ok = sceHttpSendRequest(request,
        json_post ? (const void *)json_post : NULL,
        json_post ? strlen(json_post) : 0);
    if (ok < 0) goto done;
    ok = sceHttpGetStatusCode(request, http_status);
    if (ok < 0) goto done;
    if (*http_status != 200) { ok = -14; goto done; }

    for (;;) {
        if (total >= MAX_RESPONSE_BYTES - 1) { ok = -15; goto done; }
        n = sceHttpReadData(request, response + total,
            (uint32_t)(MAX_RESPONSE_BYTES - 1 - total));
        if (n < 0) { ok = n; goto done; }
        if (n == 0) break;
        total += (size_t)n;
    }
    response[total] = '\0';
    ok = 1;

done:
    if (request >= 0) sceHttpDeleteRequest(request);
    if (connection >= 0) sceHttpDeleteConnection(connection);
    memset(authorization, 0, sizeof(authorization));
    return ok;
}

static int read_config(BXPairConfig *config) {
    FILE *f;
    size_t length;
    char buffer[1024];
    f = fopen(CONFIG_PATH, "rb");
    if (!f) f = fopen(CONFIG_FALLBACK, "rb");
    if (!f) return 0;
    length = fread(buffer, 1, sizeof(buffer) - 1, f);
    fclose(f);
    if (!length || length == sizeof(buffer) - 1) return 0;
    buffer[length] = '\0';
    if (!bx_pair_parse_config(buffer, config)) {
        memset(buffer, 0, sizeof(buffer));
        return 0;
    }
    memset(buffer, 0, sizeof(buffer));
    return 1;
}

static int pad_open(void) {
    int user = -1, handle;
    if (sceUserServiceInitialize(NULL) < 0) return -1;
    if (sceUserServiceGetInitialUser(&user) < 0) return -1;
    if (scePadInit() < 0) return -1;
    handle = scePadOpen(user, 0, 0, NULL);
    return handle;
}

/* Only a NEW local press may authorize or reject a claim.
 * The PS4 controller cannot control games through this app.
 */
static int poll_decision(int handle, uint32_t *last_buttons) {
    OrbisPadData state;
    uint32_t fresh;
    if (handle < 0 || scePadReadState(handle, &state) < 0) return 0;
    fresh = state.buttons & ~(*last_buttons);
    *last_buttons = state.buttons;
    if (fresh & ORBIS_PAD_BUTTON_CROSS) return 1;
    if (fresh & ORBIS_PAD_BUTTON_CIRCLE) return -1;
    if (fresh & ORBIS_PAD_BUTTON_OPTIONS) return -2;
    return 0;
}

static void show_code(const char *code) {
    char message[180];
    snprintf(message, sizeof(message),
        "BX-REMOTE: Codigo %s. Abra o site e escolha Vincular (LAB).", code);
    notice(message);
}

int main(void) {
    BXPairConfig config = {{0}, {0}};
    HttpContext http;
    char response[MAX_RESPONSE_BYTES];
    char code[9] = {0};
    char request_id[65] = {0};
    char claim_id[65] = {0};
    char state_name[32] = {0};
    char decision[250];
    char message[180];
    uint32_t last_buttons = 0;
    int pad = -1, status = 0, result, accepted = 0, round, i;
    const char *stage = "config";
    const char *final = "not_started";

    if (!read_config(&config)) {
        notice("BX-REMOTE: Falta configurar servidor HTTPS e token privado.");
        report("missing_or_invalid_config", -1, 0);
        sleep(5);
        return 2;
    }
    if (!open_http(&http)) {
        notice("BX-REMOTE: Falha ao iniciar bibliotecas HTTPS.");
        report("network_init_failed", -2, 0);
        close_http(&http);
        memset(&config, 0, sizeof(config));
        sleep(5);
        return 3;
    }
    pad = pad_open();
    if (pad < 0) {
        notice("BX-REMOTE: Controle nao encontrado; vinculo cancelado.");
        final = "no_local_controller";
        goto finish;
    }

    /* Only authenticated HTTPS originating from this PS4 homebrew can initiate. */
    stage = "heartbeat";
    result = call_api(&http, &config, "/v1/pair/heartbeat", "{}", response, &status);
    if (result != 1) { final = "heartbeat_failed"; goto finish; }
    stage = "start";
    result = call_api(&http, &config, "/v1/pair/start", "{}", response, &status);
    if (result != 1 || !bx_pair_code(response, code) ||
        !bx_pair_identifier(response, "requestId", request_id)) {
        final = "start_failed"; goto finish;
    }
    show_code(code);
    stage = "poll";
    final = "timeout";
    /* Two-minute proof only; no service, no background process, no AutoRun. */
    for (round = 0; round < POLL_ROUNDS; ++round) {
        result = call_api(&http, &config, "/v1/pair/heartbeat", "{}", response, &status);
        if (result != 1) { final = "heartbeat_lost"; break; }
        result = call_api(&http, &config, "/v1/pair/pending", NULL, response, &status);
        if (result != 1 || !bx_pair_status(response, state_name)) {
            final = "pending_failed"; break;
        }
        if (strcmp(state_name, "pending_confirmation") == 0) {
            if (!bx_pair_identifier(response, "claimId", claim_id)) {
                final = "invalid_claim"; break;
            }
            notice("BX-REMOTE: Novo vinculo! X aprova, O recusa, OPTIONS sai.");
            stage = "user_consent";
            for (i = 0; i < 20; ++i) {
                int choice = poll_decision(pad, &last_buttons);
                if (choice != 0) {
                    if (choice == -2) { final = "cancelled"; goto finish; }
                    if (!bx_pair_decision_json(decision, sizeof(decision), request_id,
                                               claim_id, choice > 0)) {
                        final = "decision_format_error"; goto finish;
                    }
                    result = call_api(&http, &config, "/v1/pair/decide",
                        decision, response, &status);
                    if (result != 1) { final = "decision_failed"; goto finish; }
                    accepted = choice > 0;
                    final = accepted ? "approved_pairing_only" : "denied_by_console";
                    goto finish;
                }
                usleep(100000);
            }
            stage = "poll";
        } else if (strcmp(state_name, "idle") == 0 ||
                   strcmp(state_name, "denied") == 0) {
            final = "expired_or_denied"; break;
        }
        if (round % 6 == 5) show_code(code);
        for (i = 0; i < 20; ++i) {
            if (poll_decision(pad, &last_buttons) == -2) {
                final = "cancelled"; goto finish;
            }
            usleep(100000);
        }
    }

finish:
    stage = final;
    report(stage, accepted ? 0 : -1, status);
    if (accepted) {
        notice("BX-REMOTE: Vinculo aprovado (HTTP). SEM VIDEO OU CONTROLE.");
        /* Allow the paired browser to fetch approval before revocation. */
        sleep(12);
    } else {
        snprintf(message, sizeof(message),
            "BX-REMOTE: %s (HTTP %d). Confira relatorio.", stage, status);
        notice(message);
        sleep(5);
    }
    /* Revoke short-lived proof. Do not leave an unattended controller session. */
    if (http.tmpl >= 0) {
        call_api(&http, &config, "/v1/pair/revoke", "{}", response, &status);
    }
    if (pad >= 0) scePadClose(pad);
    sceUserServiceTerminate();
    close_http(&http);
    memset(&config, 0, sizeof(config));
    return accepted ? 0 : 1;
}
