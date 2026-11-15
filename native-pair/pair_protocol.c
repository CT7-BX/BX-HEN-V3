#include "pair_protocol.h"

#include <stdio.h>
#include <string.h>

static int ishex(char value) {
    return (value >= '0' && value <= '9') || (value >= 'a' && value <= 'f');
}

static int isalnum_ascii(char c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
        || (c >= '0' && c <= '9');
}

static int isspace_json(char c) {
    return c == ' ' || c == '\t' || c == '\n' || c == '\r';
}

/* Accept only plain DNS names and optional valid TCP port. Reject userinfo,
 * query strings, paths, empty port, malformed labels, and characters that
 * could make a serialized URL different from its validated origin.
 * Native pairing requires a trusted HTTPS certificate; never disable TLS.
 */
int bx_pair_valid_origin(const char *origin) {
    const char *host;
    const char *s;
    size_t n;
    unsigned long port = 0;
    int dots = 0;
    int label = 0;

    if (!origin || strncmp(origin, "https://", 8) != 0) return 0;
    if (strlen(origin) > 180) return 0;
    host = origin + 8;
    if (!isalnum_ascii(*host)) return 0;

    for (s = host; *s != '\0' && *s != ':'; ++s) {
        if (*s == '.') {
            if (label == 0 || s[-1] == '-') return 0;
            dots++;
            label = 0;
        } else if (isalnum_ascii(*s) || *s == '-') {
            if (label == 0 && *s == '-') return 0;
            if (++label > 63) return 0;
        } else return 0;
    }
    if (label == 0 || s[-1] == '-' || dots < 1) return 0;

    if (*s == '\0') return 1;
    ++s;
    if (!*s) return 0;
    for (n = 0; s[n]; ++n) {
        if (s[n] < '0' || s[n] > '9' || n >= 5) return 0;
        port = port * 10u + (unsigned)(s[n] - '0');
    }
    return port > 0 && port <= 65535;
}

int bx_pair_valid_token(const char *token) {
    size_t i;
    if (!token || strlen(token) != 64) return 0;
    for (i = 0; i < 64; i++) if (!ishex(token[i])) return 0;
    return 1;
}

/* Minimal strict parser for the flat JSON responses of this relay.
 * Does NOT accept nesting, JSON string escapes or duplicate requested keys.
 * Copy into output only after validating the entire response.
 * This avoids choosing a key from inside a quoted value or a malformed body.
 */
int bx_pair_field(const char *json, const char *name, char *out, size_t capacity) {
    const char *p;
    const char *found = NULL;
    size_t length = 0;
    int count = 0;

    if (!json || !name || !out || !*name || capacity < 2 || strlen(json) > 1024)
        return 0;
    p = json;
    while (isspace_json(*p)) ++p;
    if (*p++ != '{') return 0;
    while (isspace_json(*p)) ++p;
    if (*p == '}') return 0;

    for (;;) {
        const char *key;
        const char *value = NULL;
        size_t key_length, value_length = 0;

        if (*p++ != '"') return 0;
        key = p;
        while (*p && *p != '"') {
            if (*p == '\\' || (unsigned char)*p < 32) return 0;
            ++p;
        }
        if (*p != '"') return 0;
        key_length = (size_t)(p - key);
        if (!key_length) return 0;
        ++p;
        while (isspace_json(*p)) ++p;
        if (*p++ != ':') return 0;
        while (isspace_json(*p)) ++p;

        if (*p == '"') {
            ++p;
            value = p;
            while (*p && *p != '"') {
                if (*p == '\\' || (unsigned char)*p < 32) return 0;
                ++p;
            }
            if (*p != '"') return 0;
            value_length = (size_t)(p - value);
            ++p;
        } else {
            const char *primitive = p;
            while (*p && *p != ',' && *p != '}' && !isspace_json(*p)) {
                if (*p == '{' || *p == '[' || *p == '"') return 0;
                ++p;
            }
            if (p == primitive) return 0;
            value_length = (size_t)(p - primitive);
            if (!((value_length == 4 && memcmp(primitive, "null", 4) == 0)
               || (value_length == 4 && memcmp(primitive, "true", 4) == 0)
               || (value_length == 5 && memcmp(primitive, "false", 5) == 0)
               || (primitive[0] >= '0' && primitive[0] <= '9'))) return 0;
        }

        if (key_length == strlen(name) && memcmp(key, name, key_length) == 0) {
            if (++count != 1 || !value || !value_length || value_length >= capacity)
                return 0;
            found = value;
            length = value_length;
        }
        while (isspace_json(*p)) ++p;
        if (*p == '}') {
            ++p;
            break;
        }
        if (*p++ != ',') return 0;
        while (isspace_json(*p)) ++p;
    }

    while (isspace_json(*p)) ++p;
    if (*p != '\0' || count != 1) return 0;
    memcpy(out, found, length);
    out[length] = '\0';
    return 1;
}

int bx_pair_code(const char *json, char out[9]) {
    char candidate[9];
    size_t i;
    if (!out || !bx_pair_field(json, "code", candidate, sizeof(candidate))
        || strlen(candidate) != 8) return 0;
    for (i = 0; i < 8; i++) if (candidate[i] < '0' || candidate[i] > '9') return 0;
    memcpy(out, candidate, sizeof(candidate));
    return 1;
}

int bx_pair_identifier(const char *json, const char *field, char out[65]) {
    char candidate[65];
    size_t i;
    if (!out || !bx_pair_field(json, field, candidate, sizeof(candidate))
        || strlen(candidate) != 64) return 0;
    for (i = 0; i < 64; i++) if (!ishex(candidate[i])) return 0;
    memcpy(out, candidate, sizeof(candidate));
    return 1;
}

int bx_pair_status(const char *json, char out[32]) {
    char candidate[32];
    if (!out || !bx_pair_field(json, "status", candidate, sizeof(candidate)))
        return 0;
    if (strcmp(candidate, "waiting") != 0 &&
        strcmp(candidate, "pending_confirmation") != 0 &&
        strcmp(candidate, "approved") != 0 &&
        strcmp(candidate, "denied") != 0 &&
        strcmp(candidate, "idle") != 0) return 0;
    memcpy(out, candidate, strlen(candidate) + 1);
    return 1;
}

int bx_pair_decision_json(char *dest, size_t cap, const char *request, const char *claim, int allow) {
    int n;
    size_t i;
    if (!dest || !request || !claim || strlen(request) != 64 || strlen(claim) != 64) return 0;
    for (i = 0; i < 64; i++) if (!ishex(request[i]) || !ishex(claim[i])) return 0;
    n = snprintf(dest, cap,
        "{\"requestId\":\"%s\",\"claimId\":\"%s\",\"allow\":%s}",
        request, claim, allow ? "true" : "false");
    return n > 0 && (size_t)n < cap;
}
