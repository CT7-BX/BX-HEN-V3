#ifndef BX_HTTPS_CLIENT_H
#define BX_HTTPS_CLIENT_H
#include <stddef.h>
#include <stdint.h>
typedef struct BXHttpsClient {void *handle;char *ca;size_t ca_size;int global_ready,code;unsigned last_ms;const char *stage;} BXHttpsClient;
int bx_https_init(BXHttpsClient *client,const char *ca,size_t ca_size);
void bx_https_close(BXHttpsClient *client);
int bx_https_post(BXHttpsClient *client,const char *url,const char *token,const uint8_t *body,size_t size,uint8_t *output,size_t capacity,size_t *length,int *status);
#endif
