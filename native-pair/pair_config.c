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
    /* Some private files copied from desktop editors begin with UTF-8 BOM.
     * Tolerate it and blank CRLF lines; never weaken URL/token validation.
     */
    cursor = text;
    if (strncmp(cursor, "\xEF\xBB\xBF", 3) == 0) cursor += 3;
    for (; *cursor;) {
        const char *end = strchr(cursor, '\n');
        size_t length = end ? (size_t)(end - cursor) : strlen(cursor);
        const char *line = cursor;
        while (length && (line[0] == ' ' || line[0] == '\t')) {
            line++;
            length--;
        }
        while (length && (line[length - 1] == '\r' ||
                          line[length - 1] == ' ' || line[length - 1] == '\t')) length--;
        if (length > 250) return 0;
        if (length == 0 || line[0] == '#') {
            cursor = end ? end + 1 : cursor + strlen(cursor);
            continue;
        }
        if (length >= 11 && strncmp(line, "relay_base=", 11) == 0) {
            if (++bases != 1 || !copy_trimmed(base, sizeof(base), line + 11, length - 11)) return 0;
        } else if (length >= 14 && strncmp(line, "console_token=", 14) == 0) {
            if (++secrets != 1 || !copy_trimmed(secret, sizeof(secret), line + 14, length - 14)) return 0;
        } else if (length) {
            /* Fail closed on unrecognized keys instead of silently ignoring. */
            return 0;
        }
        cursor = end ? end + 1 : cursor + strlen(cursor);
    }
    if (!bases || !secrets || !bx_pair_valid_origin(base) || !bx_pair_valid_token(secret)) return 0;
    memcpy(config->relay_origin, base, sizeof(base));
    memcpy(config->console_token, secret, sizeof(secret));
    memset(secret, 0, sizeof(secret));
    return 1;
}
