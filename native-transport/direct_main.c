/* Experimental free LAN transport: signaling over verified HTTPS, socket
 * records directly over authenticated WebRTC DTLS/SCTP. No HEN changes.
 * Initial mode is one reliable binary channel; no direct-internet claim. */
#include "bridge.h"
#include "socket_adapter.h"
#include "https_client.h"
#include "../native-pair/pair_config.h"
#include "c4f_rtc.h"
#include <orbis/Ssl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include "tls_roots.h"
#include <arpa/inet.h>
#include <fcntl.h>
#include <orbis/Net.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#define STOP "/data/bx-rp-transport.stop"
#define QUEUE_LIMIT (128u*1024u)
static BXBridge bridge;static C4fConn *peer;static unsigned char queued[QUEUE_LIMIT];static size_t used,read_at;
static unsigned long long bytes_in,bytes_out;static int failed;
static uint32_t rd(const unsigned char *p){return p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
static void wr(unsigned char *p,uint32_t n){for(unsigned i=0;i<4;i++)p[i]=(unsigned char)(n>>(i*8));}
static int stopped(void){struct stat value;return stat(STOP,&value)==0;}
static int emit(void *ctx,const uint8_t *p,size_t n){(void)ctx;if(!peer||bxRtcBinary(peer,p,n))return 0;bytes_out+=n;return 1;}
static void event(C4fConn *c,int type,const char *data,size_t n,void *ctx){(void)ctx;
 if(type==C4F_NET_OPEN){bx_bridge_close(&bridge);bx_bridge_init(&bridge,&bx_socket_ops,NULL,emit);peer=c;used=read_at=0;bytes_in=bytes_out=0;failed=0;}
 else if(type==C4F_NET_CLOSE){if(peer==c){peer=NULL;bx_bridge_close(&bridge);used=read_at=0;}}
 else if(type==C4F_NET_MESSAGE_EVENT&&peer==c){
  if(n==8&&!memcmp(data,"BXP1",4)){(void)bxRtcBinary(c,data,n);return;}
  if(n<28||n>65535||rd((const unsigned char *)data+24)!=n-28||n+4>QUEUE_LIMIT-used){failed=1;return;}
  wr(queued+used,(uint32_t)n);used+=4;memcpy(queued+used,data,n);used+=n;bytes_in+=n;
 }
}
static void report(const char *phase,int code){FILE *f=fopen("/data/bx-rp-transport-report.txt.tmp","w");if(!f)return;fprintf(f,"BX free direct LAN candidate\nbuild=v11-direct\ntransport=webrtc-direct-lan\nphase=%s\nerror_code=%d\nclock_ms=%llu\ndirect_rtt_ms=%llu\nqueue_bytes=%zu\nbytes_in=%llu\nbytes_out=%llu\nphysicalValidation=required\n",phase,code,(unsigned long long)c4fTimeMs(),(unsigned long long)bxRtcRtt(peer),used-read_at,bytes_in,bytes_out);fclose(f);rename("/data/bx-rp-transport-report.txt.tmp","/data/bx-rp-transport-report.txt");}
static int config(BXPairConfig *cfg,uint32_t *ip){char text[1024]={0},address[64]={0};size_t n;FILE *f=fopen("/user/data/bx-rp-transport.cfg","rb");if(!f)return 0;n=fread(text,1,sizeof(text)-1,f);int valid=!ferror(f)&&n>0&&n<sizeof(text)-1;fclose(f);if(valid)valid=bx_pair_parse_config(text,cfg);memset(text,0,sizeof(text));if(!valid)return 0;
 f=fopen("/data/bx-rp-direct-ip.txt","rb");if(!f)return 0;n=fread(address,1,sizeof(address)-1,f);valid=!ferror(f)&&n>0&&n<sizeof(address)-1;fclose(f);if(!valid)return 0;address[strcspn(address,"\r\n")]=0;
 if(inet_pton(AF_INET,address,ip)!=1)return 0;uint32_t host=ntohl(*ip);return (host>>24)==10||(host>>20)==0xac1||(host>>16)==0xc0a8;
}
int main(void){BXPairConfig cfg;uint32_t local;BXHttpsClient http={0};C4fRtc rtc={.fd=-1};char roots[sizeof(bx_tls_root_0)+sizeof(bx_tls_root_1)],poll_url[256],answer_url[256],last_id[65]={0};unsigned char signal[18000],answer[16449];int net=0;
 report("payload_entered",0);if(!config(&cfg,&local)){report("configuration_required",0);for(;;)sleep(1);}
 {int lock=open("/data/bx-rp-transport.running",O_WRONLY|O_CREAT|O_EXCL,0600);if(lock<0){report("already_running_or_stale_lock",0);for(;;)sleep(1);}close(lock);}
 bx_bridge_init(&bridge,&bx_socket_ops,NULL,emit);snprintf(roots,sizeof(roots),"%s%s",bx_tls_root_0,bx_tls_root_1);
 if(sceNetInit()<0){report("network_failed",0);goto done;}net=1;
 if(!bx_https_init(&http,roots,strlen(roots))){report("https_init_failed",http.code);goto done;}
 if(c4fRtcOpen(&rtc,4285,event,NULL)){report("direct_udp_open_failed",0);goto done;}
 if(snprintf(poll_url,sizeof(poll_url),"%s/direct-poll",cfg.relay_origin)>=(int)sizeof(poll_url)||snprintf(answer_url,sizeof(answer_url),"%s/direct-answer",cfg.relay_origin)>=(int)sizeof(answer_url))goto done;
 uint64_t last_poll=0,last_report=0;
 while(!stopped()){
  uint64_t now=c4fTimeMs();c4fRtcReadable(&rtc);c4fRtcTick(&rtc,now);if(c4fRtcWantsWrite(&rtc))c4fRtcWritable(&rtc);
  if(failed&&peer){bxRtcDisconnect(peer);failed=0;}
  while(peer&&read_at<used&&bxRtcBudget(peer)>=64){size_t n=rd(queued+read_at);read_at+=4;if(!bx_bridge_handle(&bridge,queued+read_at,n)){failed=1;break;}read_at+=n;}
  if(read_at==used){read_at=used=0;}else if(read_at){memmove(queued,queued+read_at,used-read_at);used-=read_at;read_at=0;}
  if(peer){size_t budget=bxRtcBudget(peer);if(budget>1024&&bx_socket_receive_limited(&bridge,budget-1024)<0)failed=1;}
  /* Signaling is idle during setup/gameplay; HTTPS cannot stall a live peer. */
  if(!rtc.peers[0]&&now-last_poll>=2000){size_t length=0;int status=0;unsigned char empty=0;last_poll=now;
   if(bx_https_post(&http,poll_url,cfg.console_token,&empty,0,signal,sizeof(signal)-1,&length,&status)&&length>=66&&length<=16449){
    signal[length]=0;int id_ok=signal[64]=='\n';for(unsigned i=0;i<64;i++)if(!((signal[i]>='0'&&signal[i]<='9')||(signal[i]>='a'&&signal[i]<='f')))id_ok=0;
    if(id_ok&&memcmp(last_id,signal,64)){
     memcpy(last_id,signal,64);last_id[64]=0;int result=c4fRtcOffer(&rtc,(char *)signal+65,length-65,local,(char *)answer+65,sizeof(answer)-65);
     if(!result){memcpy(answer,last_id,64);answer[64]='\n';size_t answer_n=65+strlen((char *)answer+65),ignored=0;
      if(!bx_https_post(&http,answer_url,cfg.console_token,answer,answer_n,signal,sizeof(signal),&ignored,&status)){c4fRtcClose(&rtc);(void)c4fRtcOpen(&rtc,4285,event,NULL);report("signaling_answer_failed",http.code);}
     }else report("invalid_direct_offer",result);
    }
   }
  }
  if(now-last_report>=2000){report(peer?"direct_active":"direct_waiting",0);last_report=now;}
  usleep(1000);
 }
 report("stopped",0);
done:
 c4fRtcDestroy(&rtc);bx_bridge_close(&bridge);bx_https_close(&http);if(net)sceNetTerm();memset(&cfg,0,sizeof(cfg));memset(signal,0,sizeof(signal));memset(answer,0,sizeof(answer));memset(queued,0,sizeof(queued));remove("/data/bx-rp-transport.running");if(stopped())report("stopped",0);for(;;)sleep(1);
}
