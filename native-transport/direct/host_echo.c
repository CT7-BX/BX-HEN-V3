/* Browser interoperability fixture, synthetic bytes only. */
#include "c4f_rtc.h"
#include "../bridge.h"
#include "../socket_adapter.h"
#include <arpa/inet.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/socket.h>
static int exact(void *p,size_t n){size_t got=0;while(got<n){ssize_t r=read(0,(char *)p+got,n-got);if(r<=0)return 0;got+=(size_t)r;}return 1;}
static BXBridge bridge;static C4fConn *channel;static int bridge_mode;
static int emit(void *ctx,const uint8_t *p,size_t n){(void)ctx;return channel&&bxRtcBinary(channel,p,n)==0;}
static void event(C4fConn *c,int type,const char *data,size_t len,void *ctx){(void)ctx;if(type==C4F_NET_OPEN)channel=c;if(type==C4F_NET_CLOSE){channel=NULL;bx_bridge_close(&bridge);}if(type==C4F_NET_MESSAGE_EVENT&&len){if(len==8&&!__builtin_memcmp(data,"BXP1",4)){bxRtcBinary(c,data,len);}else if(bridge_mode){if(!bx_bridge_handle(&bridge,(const uint8_t *)data,len))bxRtcDisconnect(c);}else bxRtcBinary(c,data,len);}}
int main(int argc,char **argv){(void)argv;bridge_mode=argc>1;bx_bridge_init(&bridge,&bx_socket_ops,NULL,emit);C4fRtc rtc={.fd=-1};unsigned char size[4];char offer[16385],answer[4096];unsigned n;
 if(c4fRtcOpen(&rtc,0,event,NULL))return 2;
 struct sockaddr_in address;socklen_t alen=sizeof(address);if(getsockname(rtc.fd,(struct sockaddr *)&address,&alen))return 3;rtc.port=ntohs(address.sin_port);
 if(!exact(size,4))return 4;n=(unsigned)size[0]|((unsigned)size[1]<<8)|((unsigned)size[2]<<16)|((unsigned)size[3]<<24);if(!n||n>16384||!exact(offer,n))return 5;
 if(c4fRtcOffer(&rtc,offer,n,htonl(INADDR_LOOPBACK),answer,sizeof(answer)))return 6;
 n=(unsigned)__builtin_strlen(answer);for(unsigned i=0;i<4;i++)size[i]=(unsigned char)(n>>(8*i));fwrite(size,1,4,stdout);fwrite(answer,1,n,stdout);fflush(stdout);
 uint64_t until=c4fTimeMs()+20000;while(c4fTimeMs()<until){c4fRtcReadable(&rtc);if(bridge_mode&&channel&&bxRtcBudget(channel)>1024)bx_socket_receive_limited(&bridge,bxRtcBudget(channel)-1024);c4fRtcTick(&rtc,c4fTimeMs());if(c4fRtcWantsWrite(&rtc))c4fRtcWritable(&rtc);usleep(1000);}c4fRtcDestroy(&rtc);return 0;
}
