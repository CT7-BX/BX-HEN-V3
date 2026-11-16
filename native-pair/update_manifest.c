#include "update_manifest.h"
#include <stdio.h>
#include <string.h>

#define REPO_PREFIX "https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/"
#define UPDATE_TITLE "BRPM00001"

static int hex_lower(char c) {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
}

static int parse_version(const char *str, unsigned *major, unsigned *minor) {
    unsigned a = 0, b = 0;
    int position = 0;
    if (!str || strlen(str) > 10 || !*str) return 0;
    for (; str[position] >= '0' && str[position] <= '9'; ++position) {
        if (a > 999) return 0;
        a = a * 10 + (unsigned)(str[position] - '0');
    }
    if (!position || str[position++] != '.') return 0;
    {
        int first = position;
        for (; str[position] >= '0' && str[position] <= '9'; ++position) {
            if (b > 999) return 0;
            b = b * 10 + (unsigned)(str[position] - '0');
        }
        if (position == first || str[position] != '\0' || a > 999 || b > 999) return 0;
    }
    *major = a;
    *minor = b;
    return 1;
}

int bx_update_parse(const char *text, BXUpdateManifest *out) {
    BXUpdateManifest value = {0};
    unsigned seen = 0;
    const char *p;
    if (!text || !out || strlen(text) >= 950) return 0;
    p = text;
    while (*p) {
        const char *end = strchr(p, '\n');
        size_t length = end ? (size_t)(end - p) : strlen(p);
        char line[350];
        char *equals;
        if (!length || length >= sizeof(line)) return 0;
        memcpy(line, p, length);
        line[length] = '\0';
        if (length && line[length - 1] == '\r') line[--length] = '\0';
        equals = strchr(line, '=');
        if (!equals) return 0;
        *equals++ = '\0';
        if (!strcmp(line, "title_id") && !(seen & 1u)) {
            if (strcmp(equals, UPDATE_TITLE)) return 0;
            seen |= 1u;
        } else if (!strcmp(line, "version") && !(seen & 2u)) {
            if (strlen(equals) >= sizeof(value.version) ||
                !parse_version(equals, &value.major, &value.minor)) return 0;
            strcpy(value.version, equals);
            seen |= 2u;
        } else if (!strcmp(line, "sha256") && !(seen & 4u)) {
            size_t i;
            if (strlen(equals) != 64) return 0;
            for (i = 0; i < 64; ++i) if (!hex_lower(equals[i])) return 0;
            memcpy(value.sha256, equals, 65);
            seen |= 4u;
        } else if (!strcmp(line, "pkg_url") && !(seen & 8u)) {
            size_t n = strlen(equals);
            size_t prefix = strlen(REPO_PREFIX);
            if (n <= prefix || n >= sizeof(value.pkg_url) ||
                strncmp(equals, REPO_PREFIX, prefix) ||
                strchr(equals, '?') || strchr(equals, '#') ||
                n < 4 || strcmp(equals + n - 4, ".pkg")) return 0;
            /* Require release tag and PKG filename to match the declared version.
             * A valid checksum alone must not permit cross-version metadata.
             */
            {
                char expected[256];
                int written = snprintf(expected, sizeof(expected),
                    REPO_PREFIX "pair-test-v%s/BX-REMOTE-PLAY-Pair-Test-v%s.pkg",
                    value.version, value.version);
                if (!(seen & 2u) || written < 0 ||
                    (size_t)written >= sizeof(expected) ||
                    strcmp(equals, expected)) return 0;
            }
            memcpy(value.pkg_url, equals, n + 1);
            seen |= 8u;
        } else return 0;
        p = end ? end + 1 : p + strlen(p);
    }
    if (seen != 15u) return 0;
    *out = value;
    return 1;
}

int bx_update_is_newer(const BXUpdateManifest *manifest, unsigned major, unsigned minor) {
    if (!manifest) return 0;
    return manifest->major > major ||
        (manifest->major == major && manifest->minor > minor);
}
