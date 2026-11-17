#define _DEFAULT_SOURCE
#include "../ws_client.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
int main(int argc,char **argv){BXWebSocket w;char ca[8192];unsigned char out[70000],in[BX_WS_LIMIT];size_t n,at=0,len=0;int result;
 if(argc!=3)return 2;FILE *f=fopen(argv[2],"rb");if(!f)return 2;n=fread(ca,1,sizeof(ca),f);fclose(f);
 if(!bx_ws_open(&w,argv[1],"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",ca,n)){printf("rejected %d\n",w.tls.code);bx_ws_close(&w);return 0;}
 /* The server withholds replies until eight whole messages arrive. */
 for(unsigned i=0;i<8;i++){memset(out,(int)i,sizeof(out));at=0;for(unsigned tries=0;;tries++){result=bx_ws_send(&w,out,sizeof(out),&at);if(result<0||tries>10000)return 3;if(result)break;usleep(1000);}}
 for(unsigned i=0;i<8;i++){for(unsigned tries=0;;tries++){result=bx_ws_receive(&w,in,sizeof(in),&len);if(result<0||tries>10000)return 4;if(result)break;usleep(1000);}if(len!=sizeof(out))return 5;for(size_t j=0;j<len;j++)if(in[j]!=(unsigned char)i)return 6;}
 bx_ws_close(&w);puts("pipeline_ok");return 0;
}
