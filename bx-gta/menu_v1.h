#ifndef BX_GTA_MENU_V1_H
#define BX_GTA_MENU_V1_H
#include <stddef.h>
#include "menu_core.h"
#include "synapse_catalog.h"
typedef enum {
 BX_ACT_NONE=0, BX_ACT_SUMMARY, BX_ACT_FAVORITES, BX_ACT_RECENT,
 BX_ACT_SEARCH, BX_ACT_THEME, BX_ACT_ACCENT, BX_ACT_PROFILE,
 BX_ACT_SAVE, BX_ACT_LOAD, BX_ACT_CUSA, BX_ACT_GOLDHEN,
 BX_ACT_LOG, BX_ACT_HELP, BX_ACT_NOTIFY, BX_ACT_CATALOG_INFO,
 BX_ACT_UNAVAILABLE, BX_ACT_OPEN_CATALOG
} BxAction;
typedef struct {
 const char *title;
 BxAction action;
 int library;
 int feature_id;
} BxOption;
typedef struct {
 int opened;
 int depth; /* 0 = main list; 1 = section options; 2 = catalog group list */
 int section;
 int option;
 int group;
 int library;
} BxMenuV1;
typedef struct {
 int changed;
 BxAction action;
 int feature_id;
} BxUiEvent;
void bx_v1_reset(BxMenuV1 *state);
int bx_v1_section_count(void);
const char *bx_v1_section_title(int section);
int bx_v1_option_count(int section);
const BxOption *bx_v1_option(int section,int index);
int bx_v1_current_feature(const BxMenuV1 *state);
BxUiEvent bx_v1_input(BxMenuV1 *state,BxKey key);
int bx_v1_render(const BxMenuV1 *state,char *buffer,size_t size);
#endif
