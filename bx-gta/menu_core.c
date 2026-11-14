#include "menu_core.h"
#include <stddef.h>
#include <stdio.h>

/*
 * Navigation and controller filtering are portable and unit-tested.
 * Gameplay options stay disabled until a server-specific adapter exists.
 */
typedef struct {
    const char *name;
    int implemented;
} BxMenuItem;

static const BxMenuItem system_items[] = {
    {"Status do plugin", 1},
    {"Versao do GTA", 1},
    {"Controles", 1},
    {"Compatibilidade", 1},
    {"Teste de notificacao", 1},
    {"Reiniciar navegacao", 1},
    {"Fechar menu", 1}
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

void bx_pad_reset(BxPadFilter *filter) {
    if (!filter) return;
    filter->previous = 0;
    filter->direction = 0;
    filter->held_cycles = 0;
}
BxKey bx_pad_next(BxPadFilter *filter, uint32_t buttons) {
    if (!filter) return BX_KEY_NONE;
    const uint32_t previous = filter->previous;
    filter->previous = buttons;
    const uint32_t combo = BX_PAD_L1 | BX_PAD_RIGHT;
    if ((buttons & combo) == combo) {
        filter->direction = 0;
        filter->held_cycles = 0;
        return (previous & combo) != combo ? BX_KEY_TOGGLE : BX_KEY_NONE;
    }
    if (buttons & BX_PAD_L1) {
        filter->direction = 0;
        filter->held_cycles = 0;
        return BX_KEY_NONE;
    }
    const uint32_t pressed = buttons & ~previous;
    if (pressed & BX_PAD_O) {
        filter->direction = 0;
        filter->held_cycles = 0;
        return BX_KEY_BACK;
    }
    if (pressed & BX_PAD_X) {
        filter->direction = 0;
        filter->held_cycles = 0;
        return BX_KEY_SELECT;
    }
    const uint32_t direction = (buttons & BX_PAD_UP) ? BX_PAD_UP :
                               (buttons & BX_PAD_DOWN) ? BX_PAD_DOWN : 0;
    if (!direction) {
        filter->direction = 0;
        filter->held_cycles = 0;
        return BX_KEY_NONE;
    }
    const BxKey key = direction == BX_PAD_UP ? BX_KEY_UP : BX_KEY_DOWN;
    if (direction != filter->direction) {
        filter->direction = direction;
        filter->held_cycles = 0;
        return key;
    }
    if (filter->held_cycles < 100000) ++filter->held_cycles;
    if (filter->held_cycles >= 6 && (filter->held_cycles - 6) % 3 == 0)
        return key;
    return BX_KEY_NONE;
}

int bx_menu_render(const BxMenu *menu, char *out, size_t capacity) {
    if (!menu || !out || capacity == 0) return -1;
    if (!menu->opened)
        return snprintf(out, capacity, "BX-GTA v0.8 | Menu fechado");
    if (!valid_category(menu->category))
        return snprintf(out, capacity, "BX-GTA | Categoria invalida");
    if (!menu->in_category) {
        const char *previous = bx_menu_category_name(
            (menu->category + bx_menu_category_count() - 1) % bx_menu_category_count());
        const char *next = bx_menu_category_name(
            (menu->category + 1) % bx_menu_category_count());
        return snprintf(out, capacity,
            "BX-GTA v0.8 | Categorias\n"
            "  %s\n> %s (%d/%d)\n  %s",
            previous, bx_menu_category_name(menu->category),
            menu->category + 1, bx_menu_category_count(), next);
    }
    const int count = bx_menu_item_count(menu->category);
    if (menu->item < 0 || menu->item >= count)
        return snprintf(out, capacity, "BX-GTA | Opcao invalida");
    return snprintf(out, capacity,
        "BX-GTA > %s\n"
        "[%d/%d] %s\n"
        "%s",
        bx_menu_category_name(menu->category), menu->item + 1, count,
        bx_menu_item_name(menu->category, menu->item),
        bx_menu_item_implemented(menu->category, menu->item)
            ? "X selecionar | O voltar" : "Ainda nao integrado | O voltar");
}
