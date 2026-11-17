#ifndef BX_STREAM_STATE_H
#define BX_STREAM_STATE_H
#include <stdint.h>
#include <stddef.h>
#define BX_STREAM_WINDOW 64u
typedef struct BXStreamState {uint32_t epoch,send_seq,receive_seq,pending;uint64_t sent_at[BX_STREAM_WINDOW];unsigned rtt_ms;} BXStreamState;
void bx_stream_init(BXStreamState *);
int bx_stream_can_send(const BXStreamState *);
int bx_stream_sent(BXStreamState *,uint32_t sequence,uint64_t now);
/* -1 invalid, 0 explicit reset, 1 validated response. Never partially accept. */
int bx_stream_response(BXStreamState *,const uint8_t *,size_t,uint64_t now);
#endif
