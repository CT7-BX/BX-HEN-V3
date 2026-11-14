#ifndef BX_GTA_MENU_CORE_H
#define BX_GTA_MENU_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    BX_KEY_NONE = 0, BX_KEY_TOGGLE, BX_KEY_UP,
    BX_KEY_DOWN, BX_KEY_SELECT, BX_KEY_BACK
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

void bx_menu_reset(BxMenu *menu);
BxResult bx_menu_input(BxMenu *menu, BxKey key);
int bx_menu_category_count(void);
int bx_menu_item_count(int category);
const char *bx_menu_category_name(int category);
const char *bx_menu_item_name(int category, int item);
int bx_menu_item_implemented(int category, int item);

#ifdef __cplusplus
}
#endif
#endif
