#include "stream_state.h"
#include <string.h>
static uint32_t rd(const uint8_t *p){return p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
void bx_stream_init(BXStreamState *s){memset(s,0,sizeof(*s));s->send_seq=s->receive_seq=1;}
int bx_stream_can_send(const BXStreamState *s){return s->send_seq!=0&&s->pending<BX_STREAM_WINDOW&&(s->epoch||!s->pending);}
int bx_stream_sent(BXStreamState *s,uint32_t seq,uint64_t now){if(!bx_stream_can_send(s)||seq!=s->send_seq)return 0;s->sent_at[seq%BX_STREAM_WINDOW]=now;s->pending++;s->send_seq++;return 1;}
int bx_stream_response(BXStreamState *s,const uint8_t *p,size_t n,uint64_t now){size_t at=16;uint32_t count,epoch,seq,i;
 if(!p||n<16||n>256u*1024u||memcmp(p,"BXN1",4))return -1;
 epoch=rd(p+4);seq=rd(p+8);count=rd(p+12);if(count>1024)return -1;
 for(i=0;i<count;i++){size_t bytes;if(at+4>n)return -1;bytes=rd(p+at);at+=4;if(bytes<28||bytes>65535||bytes>n-at||rd(p+at+24)!=bytes-28)return -1;at+=bytes;}if(at!=n)return -1;
 if(!epoch){if(seq||count)return -1;bx_stream_init(s);return 0;}
 if(!s->pending||seq!=s->receive_seq||(s->epoch&&epoch!=s->epoch)||(!s->epoch&&seq!=1))return -1;
 s->epoch=epoch;s->rtt_ms=now>=s->sent_at[seq%BX_STREAM_WINDOW]?(unsigned)(now-s->sent_at[seq%BX_STREAM_WINDOW]):0;s->receive_seq++;s->pending--;return 1;
}
