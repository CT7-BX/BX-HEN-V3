#include "probe_diagnostics.h"

#include <string.h>

static int is_stage(const char *stage, const char *expected)
{
    return stage != 0 && strcmp(stage, expected) == 0;
}

int bx_probe_should_retry(const char *stage, int http_status)
{
    if (is_stage(stage, "http_status") && (
        http_status == 502 || http_status == 503 || http_status == 504)) {
        return 1;
    }
    return is_stage(stage, "net_init") ||
        is_stage(stage, "https_connect") ||
        is_stage(stage, "https_request") ||
        is_stage(stage, "https_send") ||
        (is_stage(stage, "http_status") && http_status == 0) ||
        is_stage(stage, "http_body");
}

const char *bx_probe_hint(const char *stage, int http_status)
{
    if (is_stage(stage, "validate_marker")) return "Resposta inesperada do site";
    if (is_stage(stage, "http_status")) {
        if (http_status == 404) return "Arquivo de teste nao encontrado";
        if (http_status >= 500) return "Site indisponivel temporariamente";
        return "Resposta HTTP inesperada";
    }
    if (is_stage(stage, "http_body")) return "Falha ao receber resposta";
    if (is_stage(stage, "net_init") || is_stage(stage, "net_pool")) {
        return "Falha ao iniciar rede do console";
    }
    if (is_stage(stage, "ssl_init") || is_stage(stage, "http_init") ||
        is_stage(stage, "http_template")) {
        return "Falha ao iniciar bibliotecas de rede";
    }
    if (is_stage(stage, "connect_timeout") || is_stage(stage, "resolve_timeout") ||
        is_stage(stage, "send_timeout")) {
        return "Erro ao definir limites de espera";
    }
    if (is_stage(stage, "https_connect") || is_stage(stage, "https_request") ||
        is_stage(stage, "https_send")) {
        return "Verifique internet, data/hora e HTTPS";
    }
    return "Falha de rede; consulte o relatorio";
}
