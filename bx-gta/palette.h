#ifndef BX_GTA_PALETTE_H
#define BX_GTA_PALETTE_H
#include <stdint.h>
typedef struct { uint32_t panel, text, secondary, highlight, danger; } BxPalette;
const char *bx_theme_name(unsigned theme);
const char *bx_accent_name(unsigned accent);
BxPalette bx_palette_select(unsigned theme, unsigned accent);
#endif
