#include "../stream_state.h"
#include <assert.h>
#include <string.h>
static void wr(unsigned char *p,unsigned n){for(int i=0;i<4;i++)p[i]=(unsigned char)(n>>(8*i));}
static void packet(unsigned char *p,unsigned epoch,unsigned seq){memcpy(p,"BXN1",4);wr(p+4,epoch);wr(p+8,seq);wr(p+12,0);}
int main(void){BXStreamState s,before;unsigned char p[16];bx_stream_init(&s);
 assert(bx_stream_can_send(&s));assert(bx_stream_sent(&s,1,100));assert(!bx_stream_can_send(&s));
 packet(p,42,1);assert(bx_stream_response(&s,p,16,120)==1);assert(s.epoch==42&&s.rtt_ms==20);
 for(unsigned i=2;i<66;i++){assert(bx_stream_sent(&s,i,200));}
 assert(!bx_stream_can_send(&s));
 before=s;packet(p,42,3);assert(bx_stream_response(&s,p,16,210)==-1);assert(!memcmp(&s,&before,sizeof(s)));
 packet(p,43,2);assert(bx_stream_response(&s,p,16,210)==-1);assert(!memcmp(&s,&before,sizeof(s)));
 packet(p,42,2);assert(bx_stream_response(&s,p,15,210)==-1);assert(!memcmp(&s,&before,sizeof(s)));
 assert(bx_stream_response(&s,p,16,230)==1);assert(s.pending==63&&s.rtt_ms==30&&bx_stream_can_send(&s));
 assert(bx_stream_response(&s,p,16,230)==-1);
 for(unsigned i=3;i<66;i++){packet(p,42,i);assert(bx_stream_response(&s,p,16,240)==1);}assert(s.pending==0);
 {unsigned char pushed[48]={0};packet(pushed,42,0);wr(pushed+12,1);wr(pushed+16,28);pushed[20]=5;before=s;
 assert(bx_stream_push(&s,pushed,sizeof(pushed))==1);assert(!memcmp(&before,&s,sizeof(s)));
 assert(bx_stream_response(&s,pushed,sizeof(pushed),245)==-1);assert(!memcmp(&before,&s,sizeof(s)));
 wr(pushed+4,43);assert(bx_stream_push(&s,pushed,sizeof(pushed))==-1);wr(pushed+4,42);
 wr(pushed+8,1);assert(bx_stream_push(&s,pushed,sizeof(pushed))==-1);wr(pushed+8,0);
 assert(bx_stream_push(&s,pushed,sizeof(pushed)-1)==-1);wr(pushed+44,1);assert(bx_stream_push(&s,pushed,sizeof(pushed))==-1);wr(pushed+44,0);
 wr(pushed+12,2);assert(bx_stream_push(&s,pushed,sizeof(pushed))==-1);assert(!memcmp(&before,&s,sizeof(s)));}
 packet(p,0,0);assert(bx_stream_response(&s,p,16,250)==0);assert(!s.epoch&&!s.pending&&s.send_seq==1);
 assert(bx_stream_sent(&s,1,260));packet(p,0,1);assert(bx_stream_response(&s,p,16,270)==-1);
 packet(p,0,0);assert(bx_stream_response(&s,p,16,270)==0);return 0;
}
