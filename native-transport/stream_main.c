/* v15 persistent transport candidate. Same local-only bridge and config as v09.
 * TLS remains verified. Disconnect resets sockets; commands are never replayed. */
#include "bridge.h"
#include "socket_adapter.h"
#include "ws_client.h"
#include "stream_state.h"
#include "../native-pair/pair_config.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <time.h>
#include <sys/stat.h>
#include <orbis/Net.h>
#include <orbis/Ssl.h>
#include "tls_roots.h"
#define LIMIT (256u*1024u)
#define STOP "/data/bx-rp-transport.stop"
static uint8_t outgoing[LIMIT],tx[LIMIT],incoming[LIMIT];
static size_t used=16;static unsigned count,push_messages;static BXStreamState state;
static uint32_t rd(const uint8_t *p){return p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
static void wr(uint8_t *p,uint32_t n){p[0]=(uint8_t)n;p[1]=(uint8_t)(n>>8);p[2]=(uint8_t)(n>>16);p[3]=(uint8_t)(n>>24);}
static uint64_t now_ms(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return (uint64_t)t.tv_sec*1000+(uint64_t)t.tv_nsec/1000000;}
static int stopped(void){struct stat st;return stat(STOP,&st)==0;}
static void empty(void){used=16;count=0;memcpy(outgoing,"BXN1",4);}
static int emit(void *ctx,const uint8_t *p,size_t n){(void)ctx;if(n>LIMIT-used-4||count>=1024)return 0;wr(outgoing+used,(uint32_t)n);used+=4;memcpy(outgoing+used,p,n);used+=n;count++;return 1;}
static void report(const char *phase,int code){FILE *f=fopen("/data/bx-rp-transport-report.txt.tmp","w");if(!f)return;fprintf(f,"BX persistent transport candidate\nbuild=v15\ntransport=wss-pipeline\nphase=%s\nerror_code=%d\nclock_ms=%llu\nstream_rtt_ms=%u\ninflight=%u\nqueue_bytes=%zu\npush_messages=%u\nphysicalValidation=required\n",phase,code,(unsigned long long)now_ms(),state.rtt_ms,state.pending,used,push_messages);fclose(f);rename("/data/bx-rp-transport-report.txt.tmp","/data/bx-rp-transport-report.txt");}
static int config(BXPairConfig *cfg){char text[1024]={0};FILE *f=fopen("/user/data/bx-rp-transport.cfg","rb");size_t n;int valid;if(!f)return 0;n=fread(text,1,sizeof(text)-1,f);valid=!ferror(f)&&n>0&&n<sizeof(text)-1;fclose(f);if(valid)valid=bx_pair_parse_config(text,cfg);memset(text,0,sizeof(text));return valid;}
int main(void){BXPairConfig cfg;BXBridge bridge;BXWebSocket ws;char url[256],roots[sizeof(bx_tls_root_0)+sizeof(bx_tls_root_1)];int net=0;
 bx_stream_init(&state);empty();report("payload_entered",0);
 if(!config(&cfg)){report("configuration_required",0);for(;;)sleep(1);}
 {int lock=open("/data/bx-rp-transport.running",O_WRONLY|O_CREAT|O_EXCL,0600);if(lock<0){report("already_running_or_stale_lock",0);for(;;)sleep(1);}close(lock);}
 snprintf(roots,sizeof(roots),"%s%s",bx_tls_root_0,bx_tls_root_1);
 if(strncmp(cfg.relay_origin,"https://",8)||snprintf(url,sizeof(url),"wss://%s/console-stream",cfg.relay_origin+8)>=(int)sizeof(url)){report("configuration_required",0);goto done;}
 bx_bridge_init(&bridge,&bx_socket_ops,NULL,emit);
 while(!stopped()){
  size_t tx_size=0,tx_at=0,received=0,held_at=16;unsigned held_index=0;int held=0;uint32_t tx_epoch=0,tx_seq=0;uint64_t last_send=0,last_report=0;int connected=0;
  if(!net){if(sceNetInit()<0){report("network_retry",0);sleep(2);continue;}net=1;}
  memset(&ws,0,sizeof(ws));bx_stream_init(&state);empty();
  if(!bx_ws_open(&ws,url,cfg.console_token,roots,strlen(roots))){report("wss_connect_retry",ws.tls.code);bx_ws_close(&ws);sleep(2);continue;}
  report("wss_connected",0);connected=1;
  while(connected&&!stopped()){
   uint64_t now=now_ms();int result;
   /* Replies free the bounded send window independently of the next send. */
   for(unsigned budget=0;budget<16;budget++){
    if(!held){
    result=bx_ws_receive(&ws,incoming,sizeof(incoming),&received);if(result<0){connected=0;break;}if(!result)break;
    if(received>=16&&rd(incoming+4)&&rd(incoming+8)==0){result=bx_stream_push(&state,incoming,received);if(result>0)push_messages++;}
    else result=bx_stream_response(&state,incoming,received,now);if(result<0){report("invalid_stream_response",0);connected=0;break;}
    if(!result){bx_bridge_close(&bridge);bx_bridge_init(&bridge,&bx_socket_ops,NULL,emit);empty();if(!tx_at)tx_size=0;last_send=now;report("relay_idle",0);continue;}
    held=1;held_at=16;held_index=0;
    }
    /* Accept the ACK before waiting for reply space: this frees a window slot
     * so a full output queue can drain without deadlocking the receiver. */
    while(held_index<rd(incoming+12)&&used<=LIMIT-64&&count<=1022){
     size_t n=rd(incoming+held_at);held_at+=4;
     if(!bx_bridge_handle(&bridge,incoming+held_at,n)){connected=0;break;}
     held_at+=n;held_index++;
    }
    if(held_index==rd(incoming+12))held=0;
    if(held)break;
    if(!connected||bridge.failed){connected=0;break;}
   }
   if(!connected)break;
   if(tx_size){result=bx_ws_send(&ws,tx,tx_size,&tx_at);if(result<0){connected=0;break;}if(result){
     if(tx_epoch==state.epoch&&tx_seq==state.send_seq){if(!bx_stream_sent(&state,tx_seq,now)){connected=0;break;}}
     tx_size=tx_at=0;last_send=now;
   }}
   if(state.pending&&now-state.sent_at[state.receive_seq%BX_STREAM_WINDOW]>10000){report("stream_ack_timeout",0);connected=0;break;}
   if(state.epoch&&!held&&used<LIMIT-65536&&count<1024&&bx_socket_receive_limited(&bridge,((LIMIT-used-65536)<(1024u-count)*32u?(LIMIT-used-65536):(1024u-count)*32u))<0){report("bridge_backpressure",0);connected=0;break;}
   if(!tx_size&&bx_stream_can_send(&state)&&(count||now-last_send>=(state.epoch?20u:1000u))){
    wr(outgoing+4,state.epoch);wr(outgoing+8,state.send_seq);wr(outgoing+12,count);memcpy(tx,outgoing,used);tx_size=used;tx_at=0;tx_epoch=state.epoch;tx_seq=state.send_seq;empty();
   }
   if(now-last_report>=2000){report(state.epoch?"session_active":"relay_idle",0);last_report=now;}
   usleep(1000);
  }
  bx_bridge_close(&bridge);bx_bridge_init(&bridge,&bx_socket_ops,NULL,emit);report(stopped()?"stopped":"wss_disconnected",ws.tls.code);bx_ws_close(&ws);if(!stopped())sleep(2);
 }
 if(net)sceNetTerm();
done:
 memset(&cfg,0,sizeof(cfg));memset(outgoing,0,sizeof(outgoing));memset(tx,0,sizeof(tx));memset(incoming,0,sizeof(incoming));remove("/data/bx-rp-transport.running");if(stopped())report("stopped",0);for(;;)sleep(1);
}
