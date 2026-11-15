#ifndef BX_GTA_UI_FAVORITES_H
#define BX_GTA_UI_FAVORITES_H
#include <stdint.h>
#define BX_UI_OPTION_CAP 190
#define BX_UI_RECENT_CAP 12
typedef struct {
    unsigned char favorite[BX_UI_OPTION_CAP];
    int recent[BX_UI_RECENT_CAP];
    unsigned recent_count;
} BxUiFavorites;
void bx_ui_defaults(BxUiFavorites *p);
int bx_ui_is_favorite(const BxUiFavorites *p,int id);
int bx_ui_toggle(BxUiFavorites *p,int id);
int bx_ui_count(const BxUiFavorites *p);
int bx_ui_add_recent(BxUiFavorites *p,int id);
int bx_ui_write(const BxUiFavorites *p,const char *path);
int bx_ui_read(BxUiFavorites *p,const char *path);
#endif
