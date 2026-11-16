#include "../native_diag.h"
#include <stdio.h>
#include <string.h>

static int failures=0;
static void check(int ok, const char *description) {
    if (!ok) { ++failures; fprintf(stderr, "FAIL: %s\n", description); }
}
int main(void) {
    check(strcmp(bx_diag_label("config_missing"),"CONFIG AUSENTE")==0,
          "missing private config guidance");
    check(strcmp(bx_diag_hint("config_missing",0),
                 "ENVIE CFG PRIVADA VIA FTP E PRESSIONE X")==0,
          "first run recovery is actionable");
    check(strcmp(bx_diag_hint("heartbeat_failed",401),
                 "TOKEN HTTPS RECUSADO CONFIRA CFG")==0,
          "401 maps to auth issue, never logs a credential");
    check(strcmp(bx_diag_hint("start_http_failed",503),
                 "SERVIDOR INDISPONIVEL TENTE DEPOIS")==0,
          "503 maps to back-end outage");
    check(bx_diag_level("ota_download_failed",0)==BX_DIAG_FAILURE,
          "failed download is not successful");
    check(bx_diag_level("VINCULO APROVADO",200)==BX_DIAG_GOOD,
          "approval means HTTPS pairing success");
    check(bx_diag_progress("VERIFICANDO CONFIGURACAO")==1,
          "first step is config");
    check(bx_diag_progress("GERANDO CODIGO")==3,
          "pairing step is third");
    check(bx_diag_progress("approved_pairing_only")==4,
          "last step completes only on approval");
    check(strcmp(bx_diag_hint("approved_pairing_only",200),
                 "HTTPS ATIVO SEM VIDEO OU CONTROLES")==0,
          "never claim gameplay");
    check(strcmp(bx_diag_label(NULL),"ETAPA DO SISTEMA")==0,
          "null phase is safe");
    check(bx_diag_progress("unexpected_state")==0,
          "unknown phase never counts as complete");
    check(strcmp(bx_diag_hint("unexpected_state",0),
                 "CONSULTE O RELATORIO LOCAL")==0,
          "unknown phase never leaks raw strings");
    if (!failures) puts("BX native diagnostic helper passed");
    return failures ? 1 : 0;
}
