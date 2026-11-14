#include "feature_catalog.h"
#include <ctype.h>
#include <string.h>

/* Core READY means the preference/catalog logic is testable, NOT that
   the selected GTA V engine function has been implemented. */
static const BxFeature features[] = {
    {"Painel grafico dentro do GTA", "Interface", "overlay", BX_PLANNED},
    {"Temas e cores personalizaveis", "Interface", "themes", BX_CORE_READY},
    {"Personalizacao de roupas", "Jogador", "outfits", BX_PLANNED},
    {"Lista de veiculos por categoria", "Veiculos", "vehicle-list", BX_PLANNED},
    {"Teleporte por marcador", "Mapa", "waypoint-teleport", BX_PLANNED},
    {"Diagnostico GoldHEN", "Sistema", "diagnostics", BX_DIAG_READY},
    {"Deteccao automatica de CUSA", "Sistema", "title-detection", BX_DIAG_READY},
    {"Registros de erro", "Sistema", "error-log", BX_DIAG_READY},
    {"Personalizacao de cores e rodas", "Veiculos", "wheels", BX_PLANNED},
    {"Reparo de veiculos", "Veiculos", "repair", BX_PLANNED},
    {"Garagem e favoritos", "Veiculos", "garage", BX_PLANNED},
    {"Velocimetro", "Veiculos", "speedometer", BX_PLANNED},
    {"Presets de aparencia", "Jogador", "character-preset", BX_PLANNED},
    {"Animacoes e gestos", "Jogador", "emotes", BX_PLANNED},
    {"Modelos de personagem compativeis", "Jogador", "ped-models", BX_PLANNED},
    {"Pesquisa e navegacao rapida", "Interface", "search", BX_CORE_READY},
    {"Favoritos e opcoes recentes", "Interface", "favorites", BX_CORE_READY},
    {"Salvar preferencias", "Sistema", "save-settings", BX_CORE_READY},
    {"Permissoes do servidor privado", "Servidor", "server-permissions", BX_PLANNED},
    {"Scripts Lua compativeis", "Sistema", "lua-scripts", BX_PLANNED},
    {"Perfis de configuracao", "Sistema", "profiles", BX_CORE_READY},
    {"Presets cinematograficos", "Camera", "cinematic", BX_PLANNED},
    {"Filtros visuais", "Camera", "filters", BX_PLANNED},
    {"Ocultar elementos da HUD", "Camera", "hide-hud", BX_PLANNED},
    {"Camera livre", "Camera", "free-camera", BX_PLANNED},
    {"Locais favoritos", "Mapa", "favorite-locations", BX_PLANNED},
    {"Clima e horario", "Mundo", "weather-time", BX_PLANNED},
    {"Marcadores personalizados", "Mapa", "custom-waypoints", BX_PLANNED}
};
#define BX_COUNT ((int)(sizeof(features) / sizeof(features[0])))
int bx_feature_count(void) { return BX_COUNT; }
const BxFeature *bx_feature_at(int id) {
    return id >= 0 && id < BX_COUNT ? &features[id] : NULL;
}
static int contains_ci(const char *haystack, const char *needle) {
    if (!haystack || !needle) return 0;
    if (!*needle) return 1;
    for (const char *start=haystack; *start; ++start) {
        const char *h=start, *n=needle;
        while (*h && *n && tolower((unsigned char)*h)==tolower((unsigned char)*n)) {
            ++h; ++n;
        }
        if (!*n) return 1;
    }
    return 0;
}
int bx_feature_find(const char *query, int *ids, int capacity) {
    if (!query || !ids || capacity <= 0) return 0;
    int count=0;
    for (int i=0; i<BX_COUNT && count<capacity; ++i)
        if (contains_ci(features[i].name, query) ||
            contains_ci(features[i].category, query) ||
            contains_ci(features[i].key, query))
            ids[count++]=i;
    return count;
}
