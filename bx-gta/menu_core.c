#include "menu_core.h"
#include <stddef.h>

/* Read-only labels. Only the System page currently has active commands. */
typedef struct {
    const char *name;
    int implemented;
} BxMenuItem;

static const BxMenuItem system_items[] = {
    {"Status do plugin", 1}, {"Versao do GTA", 1},
    {"Controles", 1}, {"Compatibilidade", 1}, {"Fechar menu", 1}
};
static const BxMenuItem player_items[] = {
    {"Aparencia", 0}, {"Gestos", 0}, {"Animacoes", 0}
};
static const BxMenuItem vehicle_items[] = {
    {"Personalizacao", 0}, {"Garagem", 0}, {"Localizador", 0}
};
static const BxMenuItem map_items[] = {
    {"Locais", 0}, {"Marcadores", 0}, {"Viagem rapida", 0}
};
static const BxMenuItem world_items[] = {
    {"Clima", 0}, {"Horario", 0}, {"Ambiente", 0}
};
static const BxMenuItem camera_items[] = {
    {"Camera livre", 0}, {"Fotos", 0}, {"Enquadramento", 0}
};
static const BxMenuItem extras_items[] = {
    {"Ferramentas", 0}, {"Favoritos", 0}, {"Preferencias", 0}
};
static const BxMenuItem server_items[] = {
    {"Servidor atual", 0}, {"Permissoes", 0}, {"Acoes autorizadas", 0}
};

typedef struct {
    const char *name;
    const BxMenuItem *items;
    int count;
} BxCategory;

#define BX_ITEMS(array) (int)(sizeof(array) / sizeof((array)[0]))
static const BxCategory categories[] = {
    {"Sistema", system_items, BX_ITEMS(system_items)},
    {"Jogador", player_items, BX_ITEMS(player_items)},
    {"Veiculos", vehicle_items, BX_ITEMS(vehicle_items)},
    {"Mapa", map_items, BX_ITEMS(map_items)},
    {"Mundo", world_items, BX_ITEMS(world_items)},
    {"Camera", camera_items, BX_ITEMS(camera_items)},
    {"Extras", extras_items, BX_ITEMS(extras_items)},
    {"Servidor privado", server_items, BX_ITEMS(server_items)}
};

static int valid_category(int category) {
    return category >= 0 && category < BX_ITEMS(categories);
}
int bx_menu_category_count(void) { return BX_ITEMS(categories); }
int bx_menu_item_count(int category) {
    return valid_category(category) ? categories[category].count : 0;
}
const char *bx_menu_category_name(int category) {
    return valid_category(category) ? categories[category].name : "Invalido";
}
const char *bx_menu_item_name(int category, int item) {
    if (!valid_category(category) || item < 0 || item >= categories[category].count)
        return "Invalido";
    return categories[category].items[item].name;
}
int bx_menu_item_implemented(int category, int item) {
    if (!valid_category(category) || item < 0 || item >= categories[category].count)
        return 0;
    return categories[category].items[item].implemented;
}
void bx_menu_reset(BxMenu *menu) {
    if (!menu) return;
    menu->opened = 0;
    menu->category = 0;
    menu->item = 0;
    menu->in_category = 0;
}
BxResult bx_menu_input(BxMenu *menu, BxKey key) {
    if (!menu || key == BX_KEY_NONE) return BX_NO_CHANGE;
    if (key == BX_KEY_TOGGLE) {
        menu->opened = !menu->opened;
        if (!menu->opened) menu->in_category = 0;
        return menu->opened ? BX_OPENED : BX_CLOSED;
    }
    if (!menu->opened) return BX_NO_CHANGE;
    if (key == BX_KEY_BACK) {
        if (menu->in_category) {
            menu->in_category = 0;
            return BX_MOVED;
        }
        menu->opened = 0;
        return BX_CLOSED;
    }
    if (key == BX_KEY_SELECT) {
        if (!menu->in_category) {
            menu->in_category = 1;
            menu->item = 0;
            return BX_MOVED;
        }
        return BX_SELECTED;
    }
    if (key == BX_KEY_UP || key == BX_KEY_DOWN) {
        int *index = menu->in_category ? &menu->item : &menu->category;
        int total = menu->in_category
            ? bx_menu_item_count(menu->category) : bx_menu_category_count();
        if (total <= 0) return BX_NO_CHANGE;
        *index = (*index + (key == BX_KEY_UP ? total - 1 : 1)) % total;
        return BX_MOVED;
    }
    return BX_NO_CHANGE;
}
