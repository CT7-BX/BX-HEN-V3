#ifndef BX_GTA_MENU_V2_H
#define BX_GTA_MENU_V2_H
#include <stddef.h>
#include "menu_v1.h"
/* 0 sections, 1 subgroup list, 2 submenu options, 3 catalog groups */
typedef struct {
 int opened;
 int depth;
 int section;
 int subgroup;
 int option;
 int library;
 int catalog_group;
} BxMenuV2;

void bx_v2_reset(BxMenuV2 *state);
int bx_v2_section_count(void);
const char *bx_v2_section_title(int section);
int bx_v2_subgroup_count(int section);
const char *bx_v2_subgroup_title(int section,int subgroup);
int bx_v2_option_count(int section,int subgroup);
const BxOption *bx_v2_option(int section,int subgroup,int option);
int bx_v2_total_options(void);
int bx_v2_current_feature(const BxMenuV2 *state);
BxUiEvent bx_v2_input(BxMenuV2 *state,BxKey key);
int bx_v2_render(const BxMenuV2 *state,char *out,size_t capacity);
#endif
