#ifndef BX_GTA_MENU_CORE_H
#define BX_GTA_MENU_CORE_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    BX_KEY_NONE = 0, BX_KEY_TOGGLE, BX_KEY_UP,
    BX_KEY_DOWN, BX_KEY_SELECT, BX_KEY_BACK, BX_KEY_FAVORITE
} BxKey;

typedef enum {
    BX_NO_CHANGE = 0, BX_MOVED, BX_OPENED, BX_CLOSED, BX_SELECTED
} BxResult;

typedef struct {
    int opened;
    int category;
    int item;
    int in_category;
} BxMenu;

/* Portable logical controller flags: independent of Orbis SDK values. */
enum {
    BX_PAD_L1    = 1u << 0,
    BX_PAD_RIGHT = 1u << 1,
    BX_PAD_UP    = 1u << 2,
    BX_PAD_DOWN  = 1u << 3,
    BX_PAD_X     = 1u << 4,
    BX_PAD_O     = 1u << 5,
    BX_PAD_LEFT  = 1u << 6
};

typedef struct {
    uint32_t previous;
    uint32_t direction;
    unsigned held_cycles;
} BxPadFilter;

void bx_pad_reset(BxPadFilter *filter);
BxKey bx_pad_next(BxPadFilter *filter, uint32_t buttons);

void bx_menu_reset(BxMenu *menu);
BxResult bx_menu_input(BxMenu *menu, BxKey key);
int bx_menu_category_count(void);
int bx_menu_item_count(int category);
const char *bx_menu_category_name(int category);
const char *bx_menu_item_name(int category, int item);
int bx_menu_item_implemented(int category, int item);
int bx_menu_render(const BxMenu *menu, char *out, size_t capacity);

#ifdef __cplusplus
}
#endif
#endif
