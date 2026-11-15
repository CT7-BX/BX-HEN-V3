#ifndef BX_PAIR_CONFIG_H
#define BX_PAIR_CONFIG_H
#include <stddef.h>
typedef struct BXPairConfig {
    char relay_origin[192];
    char console_token[65];
} BXPairConfig;
/* Explicit config file, never embedded credentials. */
int bx_pair_parse_config(const char *text, BXPairConfig *config);
#endif
