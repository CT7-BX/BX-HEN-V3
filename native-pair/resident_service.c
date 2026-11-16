/*
 * BX-REMOTE-SERVICE v0.21 - experimental independent GoldHEN ELF process.
 * No video/audio/control: outbound HTTPS and explicit owner-approved 9295 probe only.
 * Does not persist a player authorization or expose local ports.
 * Must be explicitly enabled by the user through BX Pair Test.
 */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include <orbis/Net.h>
#include <orbis/Ssl.h>
#include <orbis/Http.h>
#include "../ps4-agent/resident/lifecycle.h"
#include "pair_config.h"
#include "pair_protocol.h"
#include "remoteplay_probe.h"

#define ENABLED_PATH "/data/bx-remote-service.enabled"
#define STOP_PATH "/data/bx-remote-service.stop"
#define CONFIG_PATH "/user/data/bx-remote-pair.cfg"
#define REPORT_PATH "/data/bx-remote-service-report.txt"
#define MAX_RESPONSE 256

typedef struct BXServiceHTTP {
    int net_initialized;
    int pool, ssl, http, tmpl;
} BXServiceHTTP;

static void log_status(const char *phase, int result, int status) {
    FILE *f=fopen(REPORT_PATH,"a+");
    long size=0;
    if (!f) return;
    if (fseek(f,0,SEEK_END)==0) size=ftell(f);
    if (size>32768) {
        fclose(f);
        f=fopen(REPORT_PATH,"w");
        if(!f)return;
    }
    fprintf(f,"BX-REMOTE-SERVICE v0.21 | state=%s | result=%d | http=%d\n",
            phase, result, status);
    fclose(f);
}
static int exists(const char *path) {
    struct stat st;
    return stat(path,&st)==0;
}
static int enabled(void) {
    return exists(ENABLED_PATH) && !exists(STOP_PATH);
}
static int config_read(BXPairConfig *config) {
    char buffer[1024]={0};
    size_t n;
    FILE *f=fopen(CONFIG_PATH,"rb");
    int valid=0;
    if(!f) return 0;
    n=fread(buffer,1,sizeof(buffer)-1,f);
    if(!ferror(f) && n>0 && n<sizeof(buffer)-1) {
        buffer[n]='\0';
        valid=bx_pair_parse_config(buffer,config);
    }
    fclose(f);
    memset(buffer,0,sizeof(buffer));
    return valid;
}
static void http_close(BXServiceHTTP *h) {
    if(h->tmpl>=0) {sceHttpDeleteTemplate(h->tmpl);h->tmpl=-1;}
    if(h->http>=0) {sceHttpTerm(h->http);h->http=-1;}
    if(h->ssl>=0) {sceSslTerm(h->ssl);h->ssl=-1;}
    if(h->pool>=0) {sceNetPoolDestroy(h->pool);h->pool=-1;}
    if(h->net_initialized) {sceNetTerm();h->net_initialized=0;}
}
static int http_open(BXServiceHTTP *h) {
    memset(h,0,sizeof(*h));
    h->pool=h->ssl=h->http=h->tmpl=-1;
    if(sceNetInit()<0)return 0;
    h->net_initialized=1;
    h->pool=sceNetPoolCreate("bx_service",256*1024,0);
    if(h->pool<0)return 0;
    h->ssl=sceSslInit(128*1024);
    if(h->ssl<0)return 0;
    h->http=sceHttpInit(h->pool,h->ssl,128*1024);
    if(h->http<0)return 0;
    h->tmpl=sceHttpCreateTemplate(h->http,"BX-REMOTE-SERVICE/0.21",
                                ORBIS_HTTP_VERSION_1_1,1);
    return h->tmpl>=0;
}
static int heartbeat(BXServiceHTTP *h, BXPairConfig *cfg, int *status, int rp_tcp,
                     char probe_id[65]) {
    char url[256]={0};
    char auth[80]={0};
    char response[256]={0};
    char body[48]={0};
    int body_len;
    int connection=-1,request=-1,result=-1,received=0,n;
    probe_id[0]='\0';
    *status=0;
    /* Diagnostic only. Never send local IPs, PINs, game data or PSN identity. */
    body_len=snprintf(body,sizeof(body),"{\"remotePlayTcp9295\":%s}",
                      rp_tcp==1?"true":rp_tcp==0?"false":"null");
    if(body_len<=0 || body_len>=(int)sizeof(body))return -14;
    if(snprintf(url,sizeof(url),"%s/v1/pair/heartbeat",cfg->relay_origin)>=(int)sizeof(url)) return -10;
    if(snprintf(auth,sizeof(auth),"Bearer %s",cfg->console_token)>=(int)sizeof(auth))return -11;
    connection=sceHttpCreateConnectionWithURL(h->tmpl,url,false);
    if(connection<0){result=connection;goto done;}
    /* The request length must match the entire JSON body, not the old
     * two-byte "{}" heartbeat. Otherwise native POST may truncate diagnostics.
     */
    request=sceHttpCreateRequestWithURL(connection,ORBIS_METHOD_POST,url,body_len);
    if(request<0){result=request;goto done;}
    if(sceHttpAddRequestHeader(request,"Authorization",auth,0)<0 ||
       sceHttpAddRequestHeader(request,"Content-Type","application/json",0)<0 ||
       sceHttpSetConnectTimeOut(request,5000000)<0 ||
       sceHttpSetResolveTimeOut(request,5000000)<0 ||
       sceHttpSetSendTimeOut(request,5000000)<0){result=-12;goto done;}
    result=sceHttpSendRequest(request,body,(size_t)body_len);
    if(result<0)goto done;
    result=sceHttpGetStatusCode(request,status);
    if(result>=0 && *status==200) {
        /* Parse only a flat, bounded JSON response. No arbitrary commands. */
        while(received < (int)sizeof(response)-1) {
            n=sceHttpReadData(request,response+received,
                              (uint32_t)(sizeof(response)-1-received));
            if(n<=0)break;
            received+=n;
        }
        response[received]='\0';
        if(received>0) {
            char candidate[65]={0};
            int valid=1;
            int i;
            if(bx_pair_field(response,"bridgeProbeId",candidate,sizeof(candidate))) {
                if(strlen(candidate)!=64)valid=0;
                for(i=0;i<64 && valid;i++)
                    if(!((candidate[i]>='0' && candidate[i]<='9') ||
                         (candidate[i]>='a' && candidate[i]<='f')))valid=0;
                if(valid)memcpy(probe_id,candidate,65);
            }
            memset(candidate,0,sizeof(candidate));
        }
        result=1;
    } else if(result>=0)result=-13;
done:
    if(request>=0)sceHttpDeleteRequest(request);
    if(connection>=0)sceHttpDeleteConnection(connection);
    memset(auth,0,sizeof(auth));
    return result;
}
/* Console-initiated reply to one approved browser diagnostic.
 * Never accept an arbitrary TCP destination, UDP port or shell command.
 * The Worker binds the one-time ID to the temporary approved claimant.
 */
static int post_bridge_result(BXServiceHTTP *h, BXPairConfig *cfg,
                              const char probe_id[65], int tcp_open) {
    char url[256]={0},auth[80]={0},body[128]={0};
    int connection=-1,request=-1,status=0,result=-1,length;
    if(strlen(probe_id)!=64)return -20;
    if(snprintf(url,sizeof(url),"%s/v1/bridge/probe-result",
                cfg->relay_origin)>=(int)sizeof(url))return -21;
    if(snprintf(auth,sizeof(auth),"Bearer %s",cfg->console_token)>=(int)sizeof(auth))
        return -22;
    length=snprintf(body,sizeof(body),
                    "{\"id\":\"%s\",\"tcp9295\":%s}",probe_id,
                    tcp_open==1?"true":tcp_open==0?"false":"null");
    if(length<=0 || length>=(int)sizeof(body)) {result=-23;goto done;}
    connection=sceHttpCreateConnectionWithURL(h->tmpl,url,false);
    if(connection<0){result=connection;goto done;}
    request=sceHttpCreateRequestWithURL(connection,ORBIS_METHOD_POST,url,length);
    if(request<0){result=request;goto done;}
    if(sceHttpAddRequestHeader(request,"Authorization",auth,0)<0 ||
       sceHttpAddRequestHeader(request,"Content-Type","application/json",0)<0 ||
       sceHttpSetConnectTimeOut(request,5000000)<0 ||
       sceHttpSetResolveTimeOut(request,5000000)<0 ||
       sceHttpSetSendTimeOut(request,5000000)<0){result=-24;goto done;}
    result=sceHttpSendRequest(request,body,(size_t)length);
    if(result<0)goto done;
    result=sceHttpGetStatusCode(request,&status);
    if(result>=0)result=status==200?1:-25;
done:
    if(request>=0)sceHttpDeleteRequest(request);
    if(connection>=0)sceHttpDeleteConnection(connection);
    memset(auth,0,sizeof(auth));
    memset(body,0,sizeof(body));
    return result;
}
static void pause_checked(unsigned seconds) {
    unsigned i;
    for(i=0;i<seconds && enabled();++i)sleep(1);
}
int main(void) {
    BXServiceHTTP http;
    BXPairConfig config={{0},{0}};
    bx_agent_lifecycle agent;
    int result,status=0,remoteplay_port=0;
    char bridge_probe_id[65]={0};
    bx_agent_init(&agent);
    if (!enabled()) {log_status("not_enabled",0,0);return 0;}
    if (!config_read(&config)) {log_status("config_invalid",-1,0);return 0;}
    bx_agent_start(&agent);
    if(!http_open(&http)){
        log_status("network_init_failed",-2,0);
        http_close(&http);
        memset(&config,0,sizeof(config));
        return 0;
    }
    log_status("started",0,0);
    /* No incoming network listener or automatic remote control.
     * Run independently of the foreground PKG, after manual GoldHEN launch.
     */
    while(enabled() && agent.enabled) {
        remoteplay_port=bx_remoteplay_probe_loopback();
        result=heartbeat(&http,&config,&status,remoteplay_port,
                         bridge_probe_id);
        if(result==1) {
            bx_agent_on_connected(&agent);
            log_status("heartbeat_ok",result,status);
            if(bridge_probe_id[0]) {
                /* Only a bounded allowlisted local check, never game actions. */
                int fresh=bx_remoteplay_probe_loopback();
                int report_result=post_bridge_result(&http,&config,bridge_probe_id,fresh);
                log_status(report_result==1?"bridge_result_accepted":
                           "bridge_result_failed",report_result,0);
                memset(bridge_probe_id,0,sizeof(bridge_probe_id));
            }
            log_status(remoteplay_port==1?"remoteplay_tcp_open":
                remoteplay_port==0?"remoteplay_tcp_unreachable":
                "remoteplay_probe_failed",remoteplay_port,0);
            pause_checked(30);
        } else {
            bx_agent_on_failure(&agent);
            log_status("heartbeat_retry",result,status);
            pause_checked(agent.retry_ms/1000);
            bx_agent_retry(&agent);
        }
    }
    bx_agent_stop(&agent);
    log_status("stopped_by_local_flag",0,0);
    http_close(&http);
    memset(&config,0,sizeof(config));
    return 0;
}
