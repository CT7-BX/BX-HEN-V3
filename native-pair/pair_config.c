#include "pair_config.h"
#include "pair_protocol.h"
#include <string.h>

static int copy_trimmed(char *dest, size_t size, const char *start, size_t length) {
    while (length && (start[length - 1] == '\r' || start[length - 1] == ' ')) length--;
    if (!length || length >= size) return 0;
    memcpy(dest, start, length);
    dest[length] = '\0';
    return 1;
}

int bx_pair_parse_config(const char *text, BXPairConfig *config) {
    char base[192] = {0};
    char secret[65] = {0};
    int bases = 0, secrets = 0;
    const char *cursor;
    if (!text || !config || strlen(text) > 1000) return 0;
    for (cursor = text; *cursor;) {
        const char *end = strchr(cursor, '\n');
        size_t length = end ? (size_t)(end - cursor) : strlen(cursor);
        if (length > 250) return 0;
        if (length >= 11 && strncmp(cursor, "relay_base=", 11) == 0) {
            if (++bases != 1 || !copy_trimmed(base, sizeof(base), cursor + 11, length - 11)) return 0;
        } else if (length >= 14 && strncmp(cursor, "console_token=", 14) == 0) {
            if (++secrets != 1 || !copy_trimmed(secret, sizeof(secret), cursor + 14, length - 14)) return 0;
        } else if (length && cursor[0] != '#') {
            /* Fail closed on unrecognized keys instead of silently ignoring. */
            return 0;
        }
        cursor = end ? end + 1 : cursor + length;
    }
    if (!bases || !secrets || !bx_pair_valid_origin(base) || !bx_pair_valid_token(secret)) return 0;
    memcpy(config->relay_origin, base, sizeof(base));
    memcpy(config->console_token, secret, sizeof(secret));
    memset(secret, 0, sizeof(secret));
    return 1;
}
