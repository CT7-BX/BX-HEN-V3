#include "pair_protocol.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

static int ishex(char value) {
    return (value >= '0' && value <= '9') || (value >= 'a' && value <= 'f');
}

int bx_pair_valid_origin(const char *origin) {
    const char *s;
    size_t len;
    if (!origin || strncmp(origin, "https://", 8) != 0) return 0;
    s = origin + 8;
    len = strlen(s);
    if (len < 4 || len > 180 || s[0] == '.' || s[0] == ':') return 0;
    for (; *s; ++s) {
        if (!((*s >= 'a' && *s <= 'z') ||
              (*s >= 'A' && *s <= 'Z') ||
              (*s >= '0' && *s <= '9') ||
              *s == '.' || *s == '-' || *s == ':')) return 0;
    }
    return 1;
}

int bx_pair_valid_token(const char *token) {
    size_t i;
    if (!token || strlen(token) != 64) return 0;
    for (i = 0; i < 64; i++) if (!ishex(token[i])) return 0;
    return 1;
}

int bx_pair_field(const char *json, const char *name, char *out, size_t capacity) {
    char key[80];
    const char *p;
    size_t len;
    if (!json || !name || !out || capacity < 2 || strlen(name) >= 70) return 0;
    if (snprintf(key, sizeof(key), "\"%s\"", name) < 0) return 0;
    p = strstr(json, key);
    if (!p) return 0;
    p += strlen(key);
    while (*p == ' ' || *p == '\t') p++;
    if (*p++ != ':') return 0;
    while (*p == ' ' || *p == '\t') p++;
    if (*p++ != '"') return 0;
    len = 0;
    while (p[len] && p[len] != '"' && len < capacity) {
        unsigned char value = (unsigned char)p[len];
        if (value < 33 || value > 126 || value == '\\') return 0;
        len++;
    }
    if (p[len] != '"' || len == 0 || len >= capacity) return 0;
    memcpy(out, p, len);
    out[len] = '\0';
    return 1;
}

int bx_pair_code(const char *json, char out[9]) {
    size_t i;
    if (!bx_pair_field(json, "code", out, 9) || strlen(out) != 8) return 0;
    for (i = 0; i < 8; i++) if (out[i] < '0' || out[i] > '9') return 0;
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
    if (!bx_pair_field(json, "status", out, 32)) return 0;
    return strcmp(out, "waiting") == 0 ||
        strcmp(out, "pending_confirmation") == 0 ||
        strcmp(out, "approved") == 0 ||
        strcmp(out, "denied") == 0 ||
        strcmp(out, "idle") == 0;
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
