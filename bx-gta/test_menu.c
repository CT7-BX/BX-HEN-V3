#include "menu_core.h"
#include <stdio.h>
#include <stdlib.h>

static void check(int value, const char *name) {
    if (!value) {
        fprintf(stderr, "FAILED: %s\n", name);
        exit(1);
    }
}
int main(void) {
    BxMenu m;
    bx_menu_reset(&m);
    check(!m.opened, "closed initially");
    check(bx_menu_category_count() == 8, "category count");
    check(bx_menu_input(&m, BX_KEY_SELECT) == BX_NO_CHANGE, "ignore while closed");
    check(bx_menu_input(&m, BX_KEY_TOGGLE) == BX_OPENED, "open");
    check(bx_menu_input(&m, BX_KEY_DOWN) == BX_MOVED && m.category == 1, "category down");
    check(bx_menu_input(&m, BX_KEY_UP) == BX_MOVED && m.category == 0, "category up");
    check(bx_menu_input(&m, BX_KEY_SELECT) == BX_MOVED && m.in_category, "enter category");
    check(bx_menu_input(&m, BX_KEY_SELECT) == BX_SELECTED, "select option");
    check(bx_menu_item_implemented(0, 0) == 1, "system action implemented");
    check(bx_menu_item_implemented(1, 0) == 0, "game action not implemented");
    check(bx_menu_input(&m, BX_KEY_BACK) == BX_MOVED && !m.in_category, "back");
    for (int i = 0; i < 30000; ++i) {
        bx_menu_input(&m, (i & 1) ? BX_KEY_DOWN : BX_KEY_UP);
        check(m.category >= 0 && m.category < bx_menu_category_count(), "category bounds");
    }
    check(bx_menu_input(&m, BX_KEY_BACK) == BX_CLOSED, "close");
    check(bx_menu_input(&m, BX_KEY_UP) == BX_NO_CHANGE, "ignore after close");
    puts("PASS: BX-GTA menu navigation, bounds, actions and 30k events");
    return 0;
}
