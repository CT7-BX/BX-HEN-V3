#include "native_diag.h"
#include <string.h>

/* Stage names only. Labels fit the native 5x7 ASCII font without truncation. */
typedef struct BXDiagnosticStage {
    const char *key;
    const char *label;
    const char *hint;
    unsigned progress;
    enum BXDiagnosticLevel level;
} BXDiagnosticStage;

static const BXDiagnosticStage stages[] = {
    {"VERIFICANDO CONFIGURACAO", "VERIFICANDO CONFIG", "CONFIRA A CONFIG PRIVADA NO PS4", 1, BX_DIAG_WAIT},
    {"config_missing", "CONFIG AUSENTE", "ENVIE CFG PRIVADA VIA FTP E PRESSIONE X", 0, BX_DIAG_WARNING},
    {"config_invalid", "CONFIG INVALIDA", "CONFIRA O FORMATO DA CFG PRIVADA", 0, BX_DIAG_FAILURE},
    {"CONECTANDO HTTPS", "CONECTANDO HTTPS", "AGUARDE O SERVIDOR SEGURO", 2, BX_DIAG_WAIT},
    {"network_init_failed", "FALHA DE REDE", "REINICIE O APP E CONFIRA A REDE", 0, BX_DIAG_FAILURE},
    {"PROCURANDO ATUALIZACOES", "VERIFICANDO ATUALIZACAO", "HTTPS PUBLICO SEM USAR TOKEN DO PS4", 2, BX_DIAG_WAIT},
    {"ota_download_begin", "BAIXANDO PKG", "CONFIRME ENERGIA E ESPACO LIVRE", 2, BX_DIAG_WAIT},
    {"ota_download_failed", "FALHA NO DOWNLOAD", "PKG ANTERIOR MANTIDO", 2, BX_DIAG_FAILURE},
    {"ota_sha256_verified", "PKG VERIFICADO", "SHA256 CONFIRMADO ANTES DE INSTALAR", 3, BX_DIAG_GOOD},
    {"ota_install_failed", "INSTALACAO FALHOU", "USE O PACKAGE INSTALLER MANUAL", 2, BX_DIAG_FAILURE},
    {"ota_install_timeout", "TEMPO DE INSTALACAO", "USE O PACKAGE INSTALLER MANUAL", 2, BX_DIAG_WARNING},
    {"resident_elf_prepared", "ELF PREPARADO", "INICIE MANUALMENTE NO GOLDHEN", 2, BX_DIAG_GOOD},
    {"resident_elf_prepare_failed", "FALHA NO SERVICO", "CONFIRA ESPACO E PERMISSOES VIA FTP", 1, BX_DIAG_FAILURE},
    {"CONFIGURAR SERVICO ELF", "CONFIGURAR SERVICO", "TRIANGULO PREPARA O ELF OU X SEGUE", 2, BX_DIAG_WAIT},
    {"VERIFICANDO SERVIDOR", "VERIFICANDO SERVIDOR", "SEM VIDEO OU CONTROLE DE JOGO", 2, BX_DIAG_WAIT},
    {"heartbeat_failed", "SERVIDOR INDISPONIVEL", "CONFIRA A REDE E O RELAY HTTPS", 2, BX_DIAG_FAILURE},
    {"heartbeat_lost", "CONEXAO INTERROMPIDA", "CONFIRA A REDE E O RELAY HTTPS", 2, BX_DIAG_FAILURE},
    {"GERANDO CODIGO", "GERANDO CODIGO", "AGUARDE O CODIGO DE VINCULO", 3, BX_DIAG_WAIT},
    {"start_http_failed", "FALHA NO CODIGO", "CONFIRA STATUS HTTPS E CONFIGURACAO", 2, BX_DIAG_FAILURE},
    {"start_response_invalid", "RESPOSTA INVALIDA", "SERVIDOR RETORNOU DADOS INVALIDOS", 2, BX_DIAG_FAILURE},
    {"AGUARDANDO VINCULO", "AGUARDANDO VINCULO", "DIGITE O CODIGO NO IPHONE", 3, BX_DIAG_WAIT},
    {"AUTORIZACAO NO PS4", "AUTORIZAR VINCULO", "X APROVA OU O RECUSA", 3, BX_DIAG_WAIT},
    {"invalid_claim", "VINCULO INVALIDO", "GERE OUTRO CODIGO NO PS4", 3, BX_DIAG_FAILURE},
    {"pending_http_failed", "FALHA NO VINCULO", "CONFIRA STATUS HTTPS E IPHONE", 3, BX_DIAG_FAILURE},
    {"pending_response_invalid", "RESPOSTA INVALIDA", "SERVIDOR RETORNOU DADOS INVALIDOS", 3, BX_DIAG_FAILURE},
    {"decision_failed", "APROVACAO FALHOU", "TENTE NOVO VINCULO", 3, BX_DIAG_FAILURE},
    {"approved_pairing_only", "VINCULO APROVADO", "HTTPS ATIVO SEM VIDEO OU CONTROLES", 4, BX_DIAG_GOOD},
    {"VINCULO APROVADO", "VINCULO APROVADO", "HTTPS ATIVO SEM VIDEO OU CONTROLES", 4, BX_DIAG_GOOD},
    {"approved_waiting_exit", "VINCULO APROVADO", "OPTIONS REVOKA E ENCERRA A SESSAO", 4, BX_DIAG_GOOD},
    {"denied_by_console", "ACESSO RECUSADO", "O PS4 RECUSOU O VINCULO", 4, BX_DIAG_WARNING},
    {"expired_or_denied", "CODIGO EXPIRADO", "REABRA O APP PARA NOVO CODIGO", 4, BX_DIAG_WARNING},
    {"timeout", "TEMPO ESGOTADO", "REABRA O APP PARA NOVO CODIGO", 4, BX_DIAG_WARNING},
    {"VINCULO ENCERRADO", "VINCULO ENCERRADO", "CONSULTE O RELATORIO PARA DETALHES", 4, BX_DIAG_WAIT},
    {"cancelled", "CANCELADO", "ACESSO NAO CONCEDIDO", 4, BX_DIAG_WARNING},
    {"cleanup_complete", "FINALIZACAO SEGURA", "FECHAR PELO MENU PS", 4, BX_DIAG_GOOD},
    {"idle_ready_for_ps4_close", "TESTE ENCERRADO", "FECHAR PELO MENU PS", 4, BX_DIAG_GOOD},
    {"TESTE ENCERRADO", "TESTE ENCERRADO", "FECHAR PELO MENU PS", 4, BX_DIAG_GOOD}
};

static const BXDiagnosticStage *lookup(const char *stage) {
    size_t i;
    if (!stage) return NULL;
    for (i = 0; i < sizeof(stages)/sizeof(stages[0]); ++i)
        if (strcmp(stage, stages[i].key) == 0) return &stages[i];
    return NULL;
}
const char *bx_diag_label(const char *stage) {
    const BXDiagnosticStage *result = lookup(stage);
    return result ? result->label : "ETAPA DO SISTEMA";
}
const char *bx_diag_hint(const char *stage, int http_status) {
    const BXDiagnosticStage *result = lookup(stage);
    if (http_status == 401) return "TOKEN HTTPS RECUSADO CONFIRA CFG";
    if (http_status == 403) return "ACESSO NEGADO CONFIRA SERVIDOR";
    if (http_status == 404) return "ROTA HTTPS NAO DISPONIVEL";
    if (http_status == 429) return "SERVIDOR OCUPADO TENTE MAIS TARDE";
    if (http_status >= 500 && http_status <= 599)
        return "SERVIDOR INDISPONIVEL TENTE DEPOIS";
    return result ? result->hint : "CONSULTE O RELATORIO LOCAL";
}
unsigned bx_diag_progress(const char *stage) {
    const BXDiagnosticStage *result = lookup(stage);
    return result ? result->progress : 0u;
}
enum BXDiagnosticLevel bx_diag_level(const char *stage, int http_status) {
    const BXDiagnosticStage *result = lookup(stage);
    if (http_status == 401 || http_status == 403 ||
        (http_status >= 500 && http_status <= 599)) return BX_DIAG_FAILURE;
    return result ? result->level : BX_DIAG_WAIT;
}
