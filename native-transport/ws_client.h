#ifndef BX_WS_CLIENT_H
#define BX_WS_CLIENT_H
#include "https_client.h"
#define BX_WS_LIMIT (256u*1024u)
typedef struct BXWebSocket {BXHttpsClient tls;size_t received,frame_received;int message_started;long status;} BXWebSocket;
int bx_ws_open(BXWebSocket *,const char *url,const char *token,const char *ca,size_t ca_size);
void bx_ws_close(BXWebSocket *);
/* send: 1 complete, 0 would block/partial, -1 failed. Receive: same, one message. */
int bx_ws_send(BXWebSocket *,const uint8_t *,size_t,size_t *offset);
int bx_ws_receive(BXWebSocket *,uint8_t *,size_t,size_t *length);
#endif
