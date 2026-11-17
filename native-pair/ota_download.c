/* BX-REMOTE-PLAY verified OTA download: no install, no token, no TLS bypass. */
#include "ota_download.h"
#include "sha256.h"
#include <stdbool.h>
#include <orbis/Http.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define BX_MAX_PKG_BYTES (64u * 1024u * 1024u)
#define BX_REDIRECT_BYTES 4096

/* The first URL is matched exactly by bx_update_parse().
 * Only GitHub's own release-asset redirect hosts may follow it.
 */
static int trusted_asset_url(const char *url) {
    static const char *hosts[] = {
        "https://release-assets.githubusercontent.com/",
        "https://objects.githubusercontent.com/",
        "https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/"
    };
    size_t i, n;
    if (!url) return 0;
    n = strlen(url);
    if (!n || n >= BX_REDIRECT_BYTES) return 0;
    for (i = 0; i < n; ++i)
        if (url[i] <= 32 || url[i] == 127 || url[i] == '@' ||
            url[i] == '#' || url[i] == '\\') return 0;
    for (i = 0; i < sizeof(hosts) / sizeof(hosts[0]); ++i)
        if (!strncmp(url, hosts[i], strlen(hosts[i]))) return 1;
    return 0;
}
static int same_header_name(const char *s, const char *name, size_t n) {
    size_t i;
    if (strlen(name) != n) return 0;
    for (i = 0; i < n; ++i) {
        char a=s[i], b=name[i];
        if (a >= 'A' && a <= 'Z') a=(char)(a-'A'+'a');
        if (b >= 'A' && b <= 'Z') b=(char)(b-'A'+'a');
        if (a != b) return 0;
    }
    return 1;
}
static int redirect_location(int request, char out[BX_REDIRECT_BYTES]) {
    char *headers = NULL;
    size_t n = 0, pos = 0;
    if (sceHttpGetAllResponseHeaders(request, &headers, &n) < 0 ||
        !headers || n > 8192) return 0;
    while (pos < n) {
        size_t start=pos, end, colon, at, len;
        while (pos < n && headers[pos] != '\n') ++pos;
        end=pos;
        if (pos < n) ++pos;
        if (end > start && headers[end-1] == '\r') --end;
        colon=start;
        while (colon < end && headers[colon] != ':') ++colon;
        if (colon == end || !same_header_name(headers+start,"location",colon-start)) continue;
        at=colon+1;
        while (at < end && (headers[at]==' ' || headers[at]=='\t')) ++at;
        len=end-at;
        if (!len || len >= BX_REDIRECT_BYTES) return 0;
        memcpy(out,headers+at,len);out[len]='\0';
        return trusted_asset_url(out);
    }
    return 0;
}
int bx_ota_fetch_verified(int tmpl, const BXUpdateManifest *m,
                          char out_path[BX_OTA_PATH_MAX], int *http_status) {
    char url[BX_REDIRECT_BYTES], final_path[BX_OTA_PATH_MAX];
    char temp_path[BX_OTA_PATH_MAX], hash[65];
    uint8_t chunk[8192];
    BXHash256 digest;
    FILE *file=NULL;
    unsigned long total=0;
    int connection=-1, request=-1, status=0, code=-1, redirects;
    if (!m || !out_path || !http_status || !trusted_asset_url(m->pkg_url)) return -1;
    *http_status=0;
    out_path[0]='\0';
    if (snprintf(final_path,sizeof(final_path),
         "/data/pkg/BX-REMOTE-PLAY-Pair-Test-v%s.pkg",m->version) >=
         (int)sizeof(final_path)) return -2;
    if (snprintf(temp_path,sizeof(temp_path),"%s.part",final_path) >=
        (int)sizeof(temp_path)) return -3;
    (void)mkdir("/data/pkg",0755);
    remove(temp_path);
    strcpy(url,m->pkg_url);
    for (redirects=0;redirects<4;++redirects) {
        connection=sceHttpCreateConnectionWithURL(tmpl,url,false);
        if (connection<0) {code=connection;goto done;}
        request=sceHttpCreateRequestWithURL(connection,ORBIS_METHOD_GET,url,0);
        if(request<0) {code=request;goto done;}
        if(sceHttpSetConnectTimeOut(request,7000000)<0 ||
           sceHttpSetResolveTimeOut(request,7000000)<0 ||
           sceHttpSetSendTimeOut(request,7000000)<0 ||
           sceHttpSetRecvTimeOut(request,7000000)<0) {code=-4;goto done;}
        code=sceHttpSendRequest(request,NULL,0);
        if(code<0)goto done;
        code=sceHttpGetStatusCode(request,&status);
        if(code<0)goto done;
        *http_status=status;
        if(status==301 || status==302 || status==303 || status==307 || status==308) {
            char next[BX_REDIRECT_BYTES];
            if(!redirect_location(request,next)){code=-5;goto done;}
            sceHttpDeleteRequest(request);request=-1;
            sceHttpDeleteConnection(connection);connection=-1;
            strcpy(url,next);
            continue;
        }
        if(status!=200){code=-6;goto done;}
        file=fopen(temp_path,"wb");
        if(!file){code=-7;goto done;}
        bx_sha256_init(&digest);
        for(;;) {
            int n=sceHttpReadData(request,chunk,sizeof(chunk));
            if(n<0){code=n;goto done;}
            if(n==0)break;
            if(total+(unsigned long)n>BX_MAX_PKG_BYTES){code=-8;goto done;}
            if(fwrite(chunk,1,(size_t)n,file)!=(size_t)n){code=-9;goto done;}
            bx_sha256_update(&digest,chunk,(size_t)n);
            total+=(unsigned long)n;
        }
        if(total<4096){code=-10;goto done;}
        if(fflush(file)!=0){code=-11;goto done;}
        if(fclose(file)!=0){file=NULL;code=-12;goto done;}
        file=NULL;
        bx_sha256_finish(&digest,hash);
        if(strcmp(hash,m->sha256)){code=-13;goto done;}
        /* Atomic publication after the complete digest agrees with metadata. */
        if(rename(temp_path,final_path)!=0){code=-14;goto done;}
        strcpy(out_path,final_path);
        code=1;goto done;
    }
    code=-15;
done:
    if(file)fclose(file);
    if(code!=1)remove(temp_path);
    if(request>=0)sceHttpDeleteRequest(request);
    if(connection>=0)sceHttpDeleteConnection(connection);
    memset(chunk,0,sizeof(chunk));
    memset(hash,0,sizeof(hash));
    memset(&digest,0,sizeof(digest));
    return code;
}
