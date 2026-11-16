#ifndef BX_SHA256_H
#define BX_SHA256_H
#include <stddef.h>
#include <stdint.h>
typedef struct {
    uint32_t state[8];
    uint64_t bytes;
    uint8_t block[64];
    size_t used;
} BXHash256;
void bx_sha256_init(BXHash256 *ctx);
void bx_sha256_update(BXHash256 *ctx, const void *data, size_t length);
void bx_sha256_finish(BXHash256 *ctx, char hex[65]);
#endif
