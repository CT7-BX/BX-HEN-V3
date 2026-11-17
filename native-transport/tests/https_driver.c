#include "../https_client.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main(int argc,char **argv){BXHttpsClient c;char ca[16384];uint8_t body[]={0,255,1,2,0,128},out[256];size_t n=0,len;int status=0,ok;FILE *f;if(argc!=5)return 2;f=fopen(argv[2],"rb");if(!f)return 3;len=fread(ca,1,sizeof(ca),f);fclose(f);if(!bx_https_init(&c,ca,len))return 4;ok=bx_https_post(&c,argv[1],argv[3],body,sizeof(body),out,(size_t)atoi(argv[4]),&n,&status);printf("%d %d %d %zu\n",ok,status,c.code,n);if(ok)for(size_t i=0;i<n;i++)printf("%02x",out[i]);puts("");bx_https_close(&c);return 0;}
