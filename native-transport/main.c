/* BX Native Transport: manually launched PS4 process. No GPU hooks, no inbound TCP listener. HTTPS relay + fixed Remote Play loopback.
 * This executable needs physical validation while a game is running. */
#include "bridge.h"
#include "socket_adapter.h"
#include "../native-pair/pair_config.h"
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <orbis/Net.h>
#include <orbis/Ssl.h>
#include <orbis/Http.h>
#include "tls_roots.h"
#define MAX_BATCH (256u*1024u)
#define CONFIG "/user/data/bx-rp-transport.cfg"
#define STOP "/data/bx-rp-transport.stop"
static uint8_t outgoing[MAX_BATCH],incoming[MAX_BATCH];
static size_t used=16;
static unsigned count,epoch,sequence=1;
static const char *error_stage="none";
static int error_code,ssl_error;
static unsigned ssl_verify;
static int diagnostic_ssl=-1,diagnostic_http=-1;
static int checked(const char *stage,int result){if(result<0){error_stage=stage;error_code=result;}return result;}
static uint32_t rd(const uint8_t *p){return p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
static void wr(uint8_t *p,uint32_t n){p[0]=(uint8_t)n;p[1]=(uint8_t)(n>>8);p[2]=(uint8_t)(n>>16);p[3]=(uint8_t)(n>>24);}
static void header(void){memcpy(outgoing,"BXN1",4);wr(outgoing+4,epoch);wr(outgoing+8,sequence);wr(outgoing+12,count);}
static void empty(void){used=16;count=0;header();}
static int emit(void *context,const uint8_t *packet,size_t n){(void)context;if(used>MAX_BATCH-4 || n>MAX_BATCH-used-4 || count>=1024)return 0;wr(outgoing+used,(uint32_t)n);used+=4;memcpy(outgoing+used,packet,n);used+=n;++count;header();return 1;}
static int stopped(void){struct stat st;return stat(STOP,&st)==0;}
static void report(const char *phase,int status){
    /* No packets, PSN identifiers, PINs, URLs or secrets in the report. */
    FILE *f=fopen("/data/bx-rp-transport-report.txt","w");if(!f)return;
    fprintf(f,"BX Native Transport experimental\nphase=%s\nhttp=%d\nstartup=ps4-payload-sdk\nbuild=v06\ntls_backend=libSceSsl2\nphysicalValidation=required\nerror_stage=%s\nerror_code=0x%08x\nssl_error=0x%08x\nssl_verify=0x%08x\nssl_context=%d\nhttp_context=%d\n",phase,status,error_stage,(unsigned)error_code,(unsigned)ssl_error,ssl_verify,diagnostic_ssl,diagnostic_http);fclose(f);
}
static int read_config(BXPairConfig *cfg){char text[1024]={0};size_t n;int valid;FILE *f=fopen(CONFIG,"rb");if(!f)return 0;n=fread(text,1,sizeof(text)-1,f);valid=!ferror(f)&&n>0&&n<sizeof(text)-1;fclose(f);if(valid)valid=bx_pair_parse_config(text,cfg);memset(text,0,sizeof(text));return valid;}
typedef struct HTTP {int net,pool,ssl,http,tmpl;} HTTP;
static void close_http(HTTP *h){if(h->tmpl>=0)sceHttpDeleteTemplate(h->tmpl);if(h->http>=0)sceHttpTerm(h->http);if(h->ssl>=0)sceSslTerm(h->ssl);if(h->pool>=0)sceNetPoolDestroy(h->pool);if(h->net)sceNetTerm();h->net=0;h->pool=h->ssl=h->http=h->tmpl=-1;}
static int open_http(HTTP *h){memset(h,0,sizeof(*h));h->pool=h->ssl=h->http=h->tmpl=-1;if(checked("sceNetInit",sceNetInit())<0)return 0;h->net=1;h->pool=checked("sceNetPoolCreate",sceNetPoolCreate("bx_rp_transport",1024*1024,0));if(h->pool<0)return 0;h->ssl=checked("sceSslInit",sceSslInit(512*1024));diagnostic_ssl=h->ssl;if(h->ssl<0)return 0;h->http=checked("sceHttpInit",sceHttpInit(h->pool,h->ssl,512*1024));diagnostic_http=h->http;if(h->http<0)return 0;if(checked("sceHttpsLoadCert",sceHttpsLoadCert(h->http,BX_TLS_ROOT_COUNT,(void*)bx_tls_roots,NULL,NULL))<0)return 0;h->tmpl=checked("sceHttpCreateTemplate",sceHttpCreateTemplate(h->http,"BX-Native-Transport/0.1",ORBIS_HTTP_VERSION_1_1,1));return h->tmpl>=0;}
static int exchange(HTTP *h,const BXPairConfig *cfg,size_t *length,int *status){
    char url[256],auth[80];int connection=-1,request=-1,result=-1,n;size_t at=0;*length=0;*status=0;
    if(snprintf(url,sizeof(url),"%s/exchange",cfg->relay_origin)>=(int)sizeof(url) || snprintf(auth,sizeof(auth),"Bearer %s",cfg->console_token)>=(int)sizeof(auth))return -1;
    connection=checked("sceHttpCreateConnectionWithURL",sceHttpCreateConnectionWithURL(h->tmpl,url,true));if(connection<0)goto done;
    request=checked("sceHttpCreateRequestWithURL",sceHttpCreateRequestWithURL(connection,ORBIS_METHOD_POST,url,used));if(request<0)goto done;
    if(checked("sceHttpAddRequestHeader",sceHttpAddRequestHeader(request,"Authorization",auth,0))<0 || checked("sceHttpAddRequestHeader",sceHttpAddRequestHeader(request,"Content-Type","application/octet-stream",0))<0 || checked("sceHttpSetConnectTimeOut",sceHttpSetConnectTimeOut(request,3000000))<0 || checked("sceHttpSetResolveTimeOut",sceHttpSetResolveTimeOut(request,3000000))<0 || checked("sceHttpSetSendTimeOut",sceHttpSetSendTimeOut(request,3000000))<0)goto done;
    sceHttpSetRecvTimeOut(request,3000000); /* SDK declares no return value. */
    if(checked("sceHttpSendRequest",sceHttpSendRequest(request,outgoing,used))<0){sceHttpsGetSslError(request,&ssl_error,&ssl_verify);goto done;}
    if(checked("sceHttpGetStatusCode",sceHttpGetStatusCode(request,status))<0)goto done;
    if(*status!=200)goto done;
    while(at<MAX_BATCH){n=checked("sceHttpReadData",sceHttpReadData(request,incoming+at,MAX_BATCH-at));if(n<0)goto done;if(!n)break;at+=(size_t)n;}
    if(at==MAX_BATCH){uint8_t extra;if(checked("sceHttpReadData",sceHttpReadData(request,&extra,1))!=0)goto done;}
    *length=at;result=1;
done:
    if(request>=0)sceHttpDeleteRequest(request);if(connection>=0)sceHttpDeleteConnection(connection);memset(auth,0,sizeof(auth));return result;
}
static int validate(size_t length){size_t at=16;unsigned i,n;if(length<16 || memcmp(incoming,"BXN1",4))return 0;n=rd(incoming+12);if(n>1024)return 0;for(i=0;i<n;i++){size_t bytes;if(at+4>length)return 0;bytes=rd(incoming+at);at+=4;if(bytes<28 || bytes>65535 || bytes>length-at || rd(incoming+at+24)!=bytes-28)return 0;at+=bytes;}return at==length;}
int main(void){
    BXPairConfig cfg;HTTP http={0,-1,-1,-1,-1};BXBridge bridge;int failures=0;
    report("payload_entered",0);
    if(!read_config(&cfg)){report("configuration_required",0);for(;;)sleep(1);}
    {int lock=open("/data/bx-rp-transport.running",O_WRONLY|O_CREAT|O_EXCL,0600);if(lock<0){report("already_running_or_stale_lock",0);for(;;)sleep(1);}close(lock);}
    bx_bridge_init(&bridge,&bx_socket_ops,NULL,emit);empty();report("starting",0);
    while(!stopped()){
        size_t n=0,at;unsigned i,packets,new_epoch;int status;
        if(http.tmpl<0 && !open_http(&http)){close_http(&http);report("network_retry",0);sleep(2);continue;}
        error_stage="none";error_code=ssl_error=0;ssl_verify=0;
        if(exchange(&http,&cfg,&n,&status)!=1){
            report("exchange_retry",status);
            if(status==401||status==403){report("credentials_refused",status);break;}
            if(status==409 || ++failures>=3){bx_bridge_close(&bridge);bx_bridge_init(&bridge,&bx_socket_ops,NULL,emit);epoch=0;sequence=1;empty();close_http(&http);failures=0;report("session_reset",status);}
            /* Retries retain exactly the previous envelope and sequence. */
            sleep(1);continue;
        }
        failures=0;if(!validate(n)){report("invalid_relay_response",status);break;}
        new_epoch=rd(incoming+4);packets=rd(incoming+12);
        if(!new_epoch){bx_bridge_close(&bridge);bx_bridge_init(&bridge,&bx_socket_ops,NULL,emit);epoch=0;sequence=1;empty();report("relay_idle",status);sleep(1);continue;}
        if(rd(incoming+8)!=sequence || (epoch && epoch!=new_epoch)){report("sequence_mismatch",status);break;}
        if(!epoch){epoch=new_epoch;report("session_active",status);}
        ++sequence;empty();at=16;
        for(i=0;i<packets;i++){size_t bytes=rd(incoming+at);at+=4;if(!bx_bridge_handle(&bridge,incoming+at,bytes)){bridge.failed=1;break;}at+=bytes;}
        if(bridge.failed || bx_socket_receive(&bridge)<0){report("backpressure_or_invalid_packet",status);break;}
        usleep(10000);
    }
    bx_bridge_close(&bridge);close_http(&http);memset(&cfg,0,sizeof(cfg));memset(outgoing,0,sizeof(outgoing));memset(incoming,0,sizeof(incoming));if(stopped())report("stopped",0);
    remove("/data/bx-rp-transport.running");
    /* Avoid the unvalidated OpenOrbis libc exit path. */
    for(;;)sleep(1);
}
