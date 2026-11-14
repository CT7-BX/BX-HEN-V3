#ifndef BX_GTA_PROFILE_H
#define BX_GTA_PROFILE_H
#include <stdint.h>
#define BX_PROFILE_COUNT 3
#define BX_RECENT_CAP 8
#define BX_QUERY_CAP 28
typedef struct {
    unsigned theme;
    unsigned accent;
    unsigned slot;
    uint32_t favorites; /* 28 catalog items */
    int recent[BX_RECENT_CAP];
    unsigned recent_count;
    char query[BX_QUERY_CAP];
} BxPreferences;

void bx_prefs_defaults(BxPreferences *prefs);
int bx_prefs_set_theme(BxPreferences *prefs, unsigned theme);
int bx_prefs_set_accent(BxPreferences *prefs, unsigned accent);
int bx_prefs_set_slot(BxPreferences *prefs, unsigned slot);
int bx_prefs_toggle_favorite(BxPreferences *prefs, int feature_id);
int bx_prefs_is_favorite(const BxPreferences *prefs, int feature_id);
int bx_prefs_add_recent(BxPreferences *prefs, int feature_id);
int bx_prefs_write(const BxPreferences *prefs, const char *filename);
int bx_prefs_read(BxPreferences *prefs, const char *filename);
#endif
