#include "menu_core.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

static int checks = 0;
static void check(int condition, const char *label) {
    ++checks;
    if (!condition) {
        fprintf(stderr, "FAILED (%d): %s\n", checks, label);
        exit(1);
    }
}
static void check_menu_bounds(const BxMenu *m) {
    check(m->category >= 0 && m->category < bx_menu_category_count(), "category bounds");
    check(m->item >= 0 && m->item < bx_menu_item_count(m->category), "item bounds");
}
static void test_menu(void) {
    BxMenu m;
    char output[256] = {0};
    bx_menu_reset(&m);
    check(!m.opened, "closed initially");
    check(bx_menu_category_count() == 8, "category count");
    check(bx_menu_item_count(0) == 7, "seven system actions");
    check(bx_menu_input(&m, BX_KEY_UP) == BX_NO_CHANGE, "ignore while closed");
    check(bx_menu_input(&m, BX_KEY_TOGGLE) == BX_OPENED, "open");
    check(bx_menu_render(&m, output, sizeof(output)) > 0, "render categories");
    check(strstr(output, "Sistema") != NULL, "render current category");
    check(bx_menu_input(&m, BX_KEY_UP) == BX_MOVED &&
        m.category == bx_menu_category_count()-1, "category wrap up");
    check(bx_menu_input(&m, BX_KEY_DOWN) == BX_MOVED && m.category == 0, "category wrap down");
    check(bx_menu_input(&m, BX_KEY_SELECT) == BX_MOVED && m.in_category, "enter category");
    check(bx_menu_render(&m, output, sizeof(output)) > 0, "render options");
    check(strstr(output, "Status do plugin") != NULL, "render selected option");
    check(bx_menu_input(&m, BX_KEY_UP) == BX_MOVED &&
        m.item == bx_menu_item_count(0)-1, "item wrap up");
    check(bx_menu_input(&m, BX_KEY_SELECT) == BX_SELECTED, "select option");
    check(bx_menu_item_implemented(0, 0) == 1, "system action implemented");
    check(bx_menu_item_implemented(1, 0) == 0, "game action blocked");
    check(bx_menu_input(&m, BX_KEY_BACK) == BX_MOVED && !m.in_category, "exit category");
    check(bx_menu_input(&m, BX_KEY_BACK) == BX_CLOSED, "close menu");
    check(bx_menu_input(&m, BX_KEY_SELECT) == BX_NO_CHANGE, "cannot select while closed");
    char tiny[5] = {'a','a','a','a','Z'};
    check(bx_menu_render(&m, tiny, 4) > 0 && tiny[3] == '\0' && tiny[4] == 'Z',
          "bounded rendering");
    check(bx_menu_render(NULL, tiny, 4) < 0, "reject null menu");
    check(bx_menu_render(&m, tiny, 0) < 0, "reject zero-size buffer");
    check(bx_menu_render(&m, NULL, 1) < 0, "reject null buffer");
    check(!strcmp(bx_menu_item_name(-1, 0), "Invalido"), "reject category");
    check(!strcmp(bx_menu_item_name(0, 200), "Invalido"), "reject item");
}
static void test_controller(void) {
    BxPadFilter filter;
    bx_pad_reset(&filter);
    const uint32_t combo = BX_PAD_L1 | BX_PAD_RIGHT;
    check(bx_pad_next(&filter, BX_PAD_L1) == BX_KEY_NONE, "L1 alone");
    check(bx_pad_next(&filter, combo) == BX_KEY_TOGGLE, "combo opens");
    check(bx_pad_next(&filter, combo) == BX_KEY_NONE, "no repeated combo");
    check(bx_pad_next(&filter, BX_PAD_RIGHT) == BX_KEY_NONE, "combo released");
    check(bx_pad_next(&filter, 0) == BX_KEY_NONE, "idle");
    check(bx_pad_next(&filter, combo) == BX_KEY_TOGGLE, "combo can close");
    check(bx_pad_next(&filter, BX_PAD_L1 | BX_PAD_X) == BX_KEY_NONE,
          "ignore other keys with L1");
    check(bx_pad_next(&filter, 0) == BX_KEY_NONE, "release L1");
    check(bx_pad_next(&filter, BX_PAD_DOWN) == BX_KEY_DOWN, "down edge");
    for (int i=0; i<5; ++i) {
        check(bx_pad_next(&filter, BX_PAD_DOWN) == BX_KEY_NONE, "repeat delay");
    }
    check(bx_pad_next(&filter, BX_PAD_DOWN) == BX_KEY_DOWN, "hold repeat");
    check(bx_pad_next(&filter, BX_PAD_DOWN) == BX_KEY_NONE, "repeat spaced");
    check(bx_pad_next(&filter, BX_PAD_UP) == BX_KEY_UP, "change direction");
    check(bx_pad_next(&filter, 0) == BX_KEY_NONE, "release direction");
    check(bx_pad_next(&filter, BX_PAD_X) == BX_KEY_SELECT, "select edge");
    check(bx_pad_next(&filter, BX_PAD_X) == BX_KEY_NONE, "held select not repeated");
    check(bx_pad_next(&filter, BX_PAD_O) == BX_KEY_BACK, "back edge");
    check(bx_pad_next(NULL, BX_PAD_UP) == BX_KEY_NONE, "null filter");
}
static void test_stress(void) {
    BxPadFilter filter;
    BxMenu menu;
    bx_pad_reset(&filter);
    bx_menu_reset(&menu);
    uint32_t seed = 0xA54B89u;
    for (int i=0; i<100000; ++i) {
        seed = seed * 1664525u + 1013904223u;
        const uint32_t mask = seed >> 26;
        BxKey key = bx_pad_next(&filter, mask);
        if (key != BX_KEY_NONE) {
            BxResult result = bx_menu_input(&menu, key);
            (void)result;
        }
        check_menu_bounds(&menu);
    }
}
int main(void) {
    test_menu();
    test_controller();
    test_stress();
    printf("PASS: BX-GTA v0.8 %d assertions including 100k controller ticks\n", checks);
    return 0;
}
