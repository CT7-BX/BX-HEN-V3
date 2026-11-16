/*
 * BX-REMOTE-PLAY PS4 Pairing Proof v0.23
 *
 * NEW, SEPARATE PKG. Not the existing HTTPS diagnostic.
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
#include <sys/stat.h>

#include <orbis/Net.h>
#include <orbis/Ssl.h>
#include <orbis/Http.h>
#include <orbis/SysUtil.h>
#include <orbis/UserService.h>
#include <orbis/Pad.h>

#include "pair_config.h"
#include "pair_protocol.h"
#include "update_manifest.h"
#include "ota_download.h"
#include "ota_install.h"
#include "resident_install.h"
#include "native_ui.h"
#include "native_diag.h"

#define REPORT_PATH "/data/bx-remote-pairing-report.txt"
#define CONFIG_PATH "/user/data/bx-remote-pair.cfg"
#define CONFIG_FALLBACK "/data/bx-remote-pair.cfg"
#define MAX_RESPONSE_BYTES 1024
#define HTTP_POOL_BYTES (256 * 1024)
#define SSL_POOL_BYTES (128 * 1024)
#define HTTP_MEMORY_BYTES (128 * 1024)
#define POLL_ROUNDS 60
#define APPROVAL_POLL_TICKS 80
#define APPROVED_HOLD_TICKS 1200 /* at most two minutes; user can exit earlier */
#define CONFIG_RETRY_TICKS 1200 /* two minutes; safe first-run window */
#define CONFIG_AUTO_RECHECK_TICKS 50 /* re-read .cfg every five seconds */
#define UPDATE_MANIFEST_URL "https://ct7-bx.github.io/BX-REMOTE-PLAY/remote/update.txt"
#define CURRENT_UPDATE_MAJOR 0u
#define CURRENT_UPDATE_MINOR 23u

typedef struct HttpContext {
    int initialized_net;
    int pool;
    int ssl;
    int http;
    int tmpl;
} HttpContext;

static void notice(const char *message) {
    /* Native dashboard is primary; notifications remain a safe fallback. */
    if (bx_ui_enabled()) bx_ui_status(message);
    else sceSysUtilSendSystemNotificationWithText(222, message);
}

static void report(const char *stage, int code, int status) {
    bx_ui_stage(stage);
    /* Keep the entire finite cleanup / OTA timeline instead of overwriting
     * every previous checkpoint. Cap the diagnostic file to 64 KiB. */
    const char *location = REPORT_PATH;
    FILE *f = fopen(location, "a+");
    long size = 0;
    if (!f) {
        location = "/user/data/bx-remote-pairing-report.txt";
        f = fopen(location, "a+");
    }
    if (!f) return;
    if (fseek(f,0,SEEK_END)==0) size=ftell(f);
    if (size>65536) {
        fclose(f);
        f=fopen(location,"w");
        if (!f) return;
    }
    fprintf(f, "BX-REMOTE-PLAY native pairing test 0.23\n");
    fprintf(f, "stage=%s\n", stage ? stage : "unknown");
    fprintf(f, "result_code=%d\nhttp_status=%d\n", code, status);
    fprintf(f, "recovery=%s\n", bx_diag_hint(stage, status));
    fprintf(f, "streaming=NOT_IMPLEMENTED\n");
    fprintf(f, "input_transport=NOT_IMPLEMENTED\n");
    fprintf(f, "autorun=DISABLED\n");
    fclose(f);
}

/* OpenOrbis' libc exit path has caused CE-34878-0 on physical PS4s.
 * A finished foreground proof must therefore remain idle until the user
 * closes the application from the PS button menu. No background agent.
 */
static void idle_until_ps4_close(void) __attribute__((noreturn));
static void idle_until_ps4_close(void) {
    report("idle_ready_for_ps4_close", 0, 0);
    bx_ui_stage("TESTE ENCERRADO");
    notice("BX-REMOTE: Teste encerrado. Feche o app pelo menu PS.");
    for (;;) sleep(1);
}

static void close_http(HttpContext *ctx) {
    /* These checkpoints isolate the failing native teardown API on hardware.
     * The associated PS4 error happens after an otherwise approved link. */
    if (ctx->tmpl >= 0) {
        report("cleanup_http_template", 0, 0);
        sceHttpDeleteTemplate(ctx->tmpl);
        ctx->tmpl = -1;
    }
    if (ctx->http >= 0) {
        report("cleanup_http_library", 0, 0);
        sceHttpTerm(ctx->http);
        ctx->http = -1;
    }
    if (ctx->ssl >= 0) {
        report("cleanup_http_ssl", 0, 0);
        sceSslTerm(ctx->ssl);
        ctx->ssl = -1;
    }
    if (ctx->pool >= 0) {
        report("cleanup_http_pool", 0, 0);
        sceNetPoolDestroy(ctx->pool);
        ctx->pool = -1;
    }
    if (ctx->initialized_net) {
        report("cleanup_http_net", 0, 0);
        sceNetTerm();
        ctx->initialized_net = 0;
    }
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
    ctx->tmpl = sceHttpCreateTemplate(ctx->http, "BX-REMOTE-PLAY-PS4-Pair/0.23",
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

/* Return 1 for valid private config, 0 for file missing, -1 for invalid.
 * Avoid treating a malformed file as if it were missing; never log its text.
 */
/* One public update probe per app launch, after HTTPS libraries initialize.
 * This deliberately does not use call_api(): that function includes the
 * console's PRIVATE Authorization token, which must never reach GitHub Pages.
 * The manifest can trigger a notice only. NO download, install, or self-modify.
 */
static int check_public_update(const HttpContext *ctx, BXUpdateManifest *available) {
    int connection = -1, request = -1, status = 0;
    char body[950];
    char message[150];
    BXUpdateManifest update = {0};
    int newer = 0;
    size_t total = 0;
    int n;
    memset(available, 0, sizeof(*available));
    connection = sceHttpCreateConnectionWithURL(ctx->tmpl, UPDATE_MANIFEST_URL, false);
    if (connection < 0) goto cleanup;
    request = sceHttpCreateRequestWithURL(connection, ORBIS_METHOD_GET,
                                        UPDATE_MANIFEST_URL, 0);
    if (request < 0) goto cleanup;
    if (sceHttpSetConnectTimeOut(request, 2500000) < 0 ||
        sceHttpSetResolveTimeOut(request, 2500000) < 0 ||
        sceHttpSetSendTimeOut(request, 2500000) < 0) goto cleanup;
    if (sceHttpSendRequest(request, NULL, 0) < 0) goto cleanup;
    if (sceHttpGetStatusCode(request, &status) < 0 || status != 200) goto cleanup;
    for (;;) {
        if (total >= sizeof(body) - 1) goto cleanup;
        n = sceHttpReadData(request, body + total, (uint32_t)(sizeof(body) - 1 - total));
        if (n < 0) goto cleanup;
        if (n == 0) break;
        total += (size_t)n;
    }
    body[total] = '\0';
    if (!bx_update_parse(body, &update)) goto cleanup;
    if (bx_update_is_newer(&update, CURRENT_UPDATE_MAJOR, CURRENT_UPDATE_MINOR)) {
        snprintf(message, sizeof(message),
            "BX-REMOTE: Nova versao v%s no GitHub Releases. Atualize o PKG.",
            update.version);
        notice(message);
        *available = update;
        newer = 1;
    }
cleanup:
    if (request >= 0) sceHttpDeleteRequest(request);
    if (connection >= 0) sceHttpDeleteConnection(connection);
    memset(&update, 0, sizeof(update));
    memset(body, 0, sizeof(body));
    return newer;
}

static int read_config(BXPairConfig *config) {
    FILE *f;
    size_t length;
    char buffer[1024] = {0};
    int result = -1;
    f = fopen(CONFIG_PATH, "rb");
    if (!f) f = fopen(CONFIG_FALLBACK, "rb");
    if (!f) return 0;
    length = fread(buffer, 1, sizeof(buffer) - 1, f);
    if (ferror(f)) goto done;
    if (!length || length == sizeof(buffer) - 1) goto done;
    buffer[length] = '\0';
    if (bx_pair_parse_config(buffer, config)) result = 1;
done:
    fclose(f);
    memset(buffer, 0, sizeof(buffer));
    return result;
}

/* UserService can be partially initialized when controller setup fails.
 * Keep ownership explicit; never terminate an uninitialized service.
 */
static int pad_open(int *user_initialized) {
    int user = -1;
    if (!*user_initialized) {
        if (sceUserServiceInitialize(NULL) < 0) return -1;
        *user_initialized = 1;
    }
    if (sceUserServiceGetInitialUser(&user) < 0) return -1;
    if (scePadInit() < 0) return -1;
    return scePadOpen(user, 0, 0, NULL);
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

static void offer_update(const HttpContext *http, const BXUpdateManifest *update,
                         int pad, uint32_t *last_buttons) {
    char pkg_path[BX_OTA_PATH_MAX];
    char message[170];
    int status=0, result, i;
    /* New releases are downloaded automatically; installation requires
     * an explicit NEW DualShock X press, not a held key at startup.
     * No installation is attempted for missing/invalid manifests.
     */
    notice("BX-REMOTE: Baixando atualizacao oficial HTTPS...");
    report("ota_download_begin", 0, 0);
    result=bx_ota_fetch_verified(http->tmpl,update,pkg_path,&status);
    if(result != 1) {
        report("ota_download_failed",result,status);
        notice("BX-REMOTE: Atualizacao falhou; versao atual preservada.");
        return;
    }
    report("ota_sha256_verified",0,status);
    snprintf(message,sizeof(message),"BX-REMOTE: v%s verificada. Aperte X instalar, O ignorar.",update->version);
    notice(message);
    for(i=0;i<6;++i) { (void)poll_decision(pad,last_buttons);usleep(100000); }
    for(i=0;i<300;++i) {
        int decision=poll_decision(pad,last_buttons);
        if(decision<0) {report("ota_install_declined",0,status);return;}
        if(decision==1) {
            /* OpenOrbis installer privileges vary by firmware and host.
             * Never elevate privileges or bypass failed authorization.
             * A failed install leaves the verified package on /data/pkg.
             */
            report("ota_install_begin",0,0);
            result=bx_ota_install_with_consent(pkg_path);
            if(result==0) {
                report("ota_install_submitted",0,0);
                notice("BX-REMOTE: Instalacao solicitada. Feche o app pelo menu PS.");
                idle_until_ps4_close();
            }
            report("ota_install_failed",result,0);
            notice("BX-REMOTE: Instalacao nao autorizada. Use Package Installer.");
            return;
        }
        usleep(100000);
    }
    report("ota_install_timeout",0,0);
}

/* Foreground PKG manager: installs a separate resident ELF only after a NEW
 * Triangle press. It never launches the ELF or enables GoldHEN AutoRun.
 * The ELF itself has no game control, video or player authorization yet.
 */
static void offer_resident_setup(int pad, uint32_t *last_buttons) {
    int tick;
    struct stat installed;
    char version[12] = {0};
    FILE *marker=fopen("/data/bx-remote-service.version","rb");
    if(marker) {
        size_t read=fread(version,1,sizeof(version)-1,marker);
        fclose(marker);
        if(read==5 && memcmp(version,"0.23\n",5)==0
          && stat("/data/payloads/bx-remote-service.elf",&installed)==0) {
            /* Already installed the current resident, skip repeat prompt. */
            return;
        }
    }
    notice("BX-REMOTE: TRIANGULO ATUALIZA servico ELF 0.23; X segue.");
    for (tick=0; tick<140; ++tick) {
        OrbisPadData state;
        uint32_t fresh;
        if (scePadReadState(pad, &state) < 0) {
            usleep(100000);
            continue;
        }
        fresh = state.buttons & ~(*last_buttons);
        *last_buttons = state.buttons;
        if (fresh & ORBIS_PAD_BUTTON_TRIANGLE) {
            int result=bx_resident_prepare();
            report(result==1?"resident_elf_prepared":"resident_elf_prepare_failed",result,0);
            if(result==1) {
                notice("BX-REMOTE: ELF em /data/payloads/. Inicie no GoldHEN LaunchPad.");
                sleep(3);
                notice("BX-REMOTE: AutoRun DESLIGADO. Servico HTTPS sem video/controle.");
            } else {
                notice("BX-REMOTE: Falha copiando ELF. Veja log e use FTP.");
            }
            break;
        }
        if (fresh & (ORBIS_PAD_BUTTON_CROSS |
                     ORBIS_PAD_BUTTON_CIRCLE |
                     ORBIS_PAD_BUTTON_OPTIONS)) break;
        usleep(100000);
    }
}

static void show_code(const char *code) {
    char message[180];
    bx_ui_code(code);
    bx_ui_stage("AGUARDANDO VINCULO");
    snprintf(message, sizeof(message),
        "BX-REMOTE: Codigo %s. Abra o site e escolha Vincular (LAB).", code);
    notice(message);
}

int main(void) {
    BXPairConfig config = {{0}, {0}};
    BXUpdateManifest available_update = {0};
    int has_update = 0;
    HttpContext http;
    char response[MAX_RESPONSE_BYTES];
    char code[9] = {0};
    char request_id[65] = {0};
    char claim_id[65] = {0};
    char state_name[32] = {0};
    char decision[250];
    char message[180];
    uint32_t last_buttons = 0;
    int pad = -1, user_initialized = 0, status = 0, result = -1, accepted = 0, round, i;
    const char *stage = "config";
    const char *final = "not_started";

    /* Draw a real fullscreen dashboard before any HTTPS operations. */
    (void)bx_ui_init();
    bx_ui_stage("VERIFICANDO CONFIGURACAO");

    /* The PS4 first-run may happen before the user copies a private .cfg.
     * The app remains open while FTP is available, and detects the file
     * automatically without requiring a restart or repeated X presses.
     */
    {
        int config_state = read_config(&config);
        if (config_state != 1) {
            int configured = 0;
            report(config_state == 0 ? "config_missing" : "config_invalid", -1, 0);
            notice(config_state == 0
                ? "BX-REMOTE: Config nao encontrada. Copie por FTP para /user/data/."
                : "BX-REMOTE: Config invalida. Confira bx-remote-pair.cfg.");
            pad = pad_open(&user_initialized);
            if (pad < 0) {
                notice("BX-REMOTE: Sem controle. Verifique a config e reinicie.");
                sleep(10);
            } else {
                notice("BX-REMOTE: FTP /user/data/bx-remote-pair.cfg. X tenta; OPTIONS sai.");
                for (i = 0; i < CONFIG_RETRY_TICKS; ++i) {
                    const int choice = poll_decision(pad, &last_buttons);
                    if (choice == -2) break;
                    if (choice == 1 || (i > 0 && i % CONFIG_AUTO_RECHECK_TICKS == 0)) {
                        config_state = read_config(&config);
                        if (config_state == 1) {
                            configured = 1;
                            notice("BX-REMOTE: Config OK. Conectando HTTPS...");
                            break;
                        }
                        if (choice == 1) {
                            notice(config_state == 0
                                ? "BX-REMOTE: Arquivo nao encontrado. Verifique o caminho FTP."
                                : "BX-REMOTE: Arquivo invalido. Confira URL e token privado.");
                        }
                    }
                    if (i > 0 && i % 150 == 0)
                        notice("BX-REMOTE: Aguardando config. X revalida; OPTIONS sai.");
                    usleep(100000);
                }
            }
            if (!configured) {
                report(config_state == 0 ? "config_missing" : "config_invalid", -1, 0);
                if (pad >= 0) scePadClose(pad);
                if (user_initialized) sceUserServiceTerminate();
                memset(&config, 0, sizeof(config));
                idle_until_ps4_close();
            }
        }
    }
    bx_ui_stage("CONECTANDO HTTPS");
    if (!open_http(&http)) {
        notice("BX-REMOTE: Falha ao iniciar bibliotecas HTTPS.");
        report("network_init_failed", -2, 0);
        close_http(&http);
        if (pad >= 0) scePadClose(pad);
        if (user_initialized) sceUserServiceTerminate();
        memset(&config, 0, sizeof(config));
        sleep(5);
        idle_until_ps4_close(); /* Do not return through OpenOrbis libc _exit. */
    }
    /* Best effort only: if GitHub Pages is offline, pairing still starts. */
    bx_ui_stage("PROCURANDO ATUALIZACOES");
    has_update = check_public_update(&http, &available_update);
    if (pad < 0) pad = pad_open(&user_initialized);
    if (pad < 0) {
        notice("BX-REMOTE: Controle nao encontrado; vinculo cancelado.");
        final = "no_local_controller";
        goto finish;
    }
    if (has_update) offer_update(&http, &available_update, pad, &last_buttons);
    memset(&available_update, 0, sizeof(available_update));
    bx_ui_stage("CONFIGURAR SERVICO ELF");
    offer_resident_setup(pad, &last_buttons);

    /* Only authenticated HTTPS originating from this PS4 homebrew can initiate. */
    stage = "heartbeat";
    bx_ui_stage("VERIFICANDO SERVIDOR");
    result = call_api(&http, &config, "/v1/pair/heartbeat", "{}", response, &status);
    if (result != 1) { final = "heartbeat_failed"; goto finish; }
    stage = "start";
    bx_ui_stage("GERANDO CODIGO");
    result = call_api(&http, &config, "/v1/pair/start", "{}", response, &status);
    if (result != 1) { final = "start_http_failed"; goto finish; }
    if (!bx_pair_code(response, code) ||
        !bx_pair_identifier(response, "requestId", request_id)) {
        final = "start_response_invalid";
        result = -16;
        goto finish;
    }
    show_code(code);
    stage = "poll";
    final = "timeout";
    /* Two-minute proof only; no service, no background process, no AutoRun. */
    for (round = 0; round < POLL_ROUNDS; ++round) {
        result = call_api(&http, &config, "/v1/pair/heartbeat", "{}", response, &status);
        if (result != 1) { final = "heartbeat_lost"; break; }
        result = call_api(&http, &config, "/v1/pair/pending", NULL, response, &status);
        if (result != 1) { final = "pending_http_failed"; break; }
        if (!bx_pair_status(response, state_name)) {
            final = "pending_response_invalid";
            result = -17;
            break;
        }
        if (strcmp(state_name, "pending_confirmation") == 0) {
            if (!bx_pair_identifier(response, "claimId", claim_id)) {
                final = "invalid_claim";
                result = -18;
                break;
            }
            bx_ui_stage("AUTORIZACAO NO PS4");
            notice("BX-REMOTE: Aprovar acesso de teste? X = SIM, O = NAO, OPTIONS sai.");
            stage = "user_consent";
            for (i = 0; i < APPROVAL_POLL_TICKS; ++i) {
                int choice = poll_decision(pad, &last_buttons);
                if (choice != 0) {
                    if (choice == -2) { final = "cancelled"; goto finish; }
                    if (!bx_pair_decision_json(decision, sizeof(decision), request_id,
                                               claim_id, choice > 0)) {
                        final = "decision_format_error";
                        result = -19;
                        goto finish;
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
    bx_ui_stage(accepted ? "VINCULO APROVADO" : "VINCULO ENCERRADO");
    /* Preserve native/HTTP failure code instead of converting all failures
     * to -1. The log is safe to share after checking for local information. */
    report(stage, accepted ? 0 : (result < 0 ? result : -1), status);
    if (accepted) {
        /* Never vanish shortly after success: keep this foreground-only proof
         * open while the user checks the browser. No resident agent is started.
         * OPTIONS revokes the temporary link; a bounded timeout is a fail-safe.
         */
        report("approved_waiting_exit", 0, status);
        notice("BX-REMOTE: Vinculo OK (sem video/audio). OPTIONS encerra o teste.");
        for (i = 0; i < APPROVED_HOLD_TICKS; ++i) {
            if (poll_decision(pad, &last_buttons) == -2) break;
            usleep(100000);
        }
    } else {
        if (status == 401) {
            notice("BX-REMOTE: Token recusado (401). Confira chave no PS4 e Cloudflare.");
        } else if (status == 503) {
            notice("BX-REMOTE: Servidor indisponivel (503). Confira Cloudflare.");
        } else if (status == 403) {
            notice("BX-REMOTE: Acesso negado (403). Verifique servidor HTTPS.");
        } else {
            snprintf(message, sizeof(message),
                "BX-REMOTE: HTTP %d, codigo %d. %s",
                status, result < 0 ? result : -1,
                bx_diag_hint(stage,status));
            notice(message);
        }
        sleep(5);
    }
    /* Record the last reached cleanup phase so a physical CE-34878-0
     * can be correlated with revoke, pad or network teardown. */
    report("cleanup_revoke_begin", accepted ? 0 : -1, status);
    if (http.tmpl >= 0) {
        int revoke_status = 0;
        int revoke_result = call_api(&http, &config, "/v1/pair/revoke",
                                     "{}", response, &revoke_status);
        report("cleanup_revoke_done", revoke_result, revoke_status);
    }
    report("cleanup_pad_begin", 0, 0);
    if (pad >= 0) scePadClose(pad);
    report("cleanup_pad_done", 0, 0);
    report("cleanup_http_begin", 0, 0);
    close_http(&http);
    report("cleanup_http_done", 0, 0);
    if (user_initialized) {
        report("cleanup_user_service_begin", 0, 0);
        sceUserServiceTerminate();
    }
    report("cleanup_complete", 0, 0);
    memset(&config, 0, sizeof(config));
    idle_until_ps4_close(); /* Never return through OpenOrbis libc _exit. */
}
