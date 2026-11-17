/* GPL-3.0-or-later. HTTPS-only bounded exchange; libcurl/OpenSSL perform TLS. */
#include "https_client.h"
#include <curl/curl.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#define BX_HTTPS_LIMIT (256u*1024u)
typedef struct Sink {uint8_t *bytes;size_t capacity,used;} Sink;
static size_t receive(void *bytes,size_t size,size_t count,void *opaque){Sink *sink=opaque;size_t n;if(size && count>SIZE_MAX/size)return 0;n=size*count;if(n>sink->capacity-sink->used)return 0;memcpy(sink->bytes+sink->used,bytes,n);sink->used+=n;return n;}
void bx_https_close(BXHttpsClient *c){if(c->handle)curl_easy_cleanup(c->handle);free(c->ca);if(c->global_ready)curl_global_cleanup();memset(c,0,sizeof(*c));}
int bx_https_init(BXHttpsClient *c,const char *ca,size_t size){memset(c,0,sizeof(*c));c->stage="curl_init";if(!ca||!size||size>BX_HTTPS_LIMIT){c->code=CURLE_BAD_FUNCTION_ARGUMENT;return 0;}c->code=curl_global_init(CURL_GLOBAL_DEFAULT);if(c->code!=CURLE_OK)return 0;c->global_ready=1;c->handle=curl_easy_init();c->ca=malloc(size+1);if(!c->handle||!c->ca){c->code=CURLE_OUT_OF_MEMORY;return 0;}memcpy(c->ca,ca,size);c->ca[size]=0;c->ca_size=size;return 1;}
int bx_https_post(BXHttpsClient *c,const char *url,const char *token,const uint8_t *body,size_t size,uint8_t *output,size_t capacity,size_t *length,int *status){
 CURL *easy=c->handle;struct curl_slist *headers=NULL,*next;struct curl_blob roots={c->ca,c->ca_size,CURL_BLOB_COPY};Sink sink={output,capacity,0};char auth[96];long response=0;int ok=0;size_t i;
 *length=0;*status=0;c->code=CURLE_BAD_FUNCTION_ARGUMENT;c->stage="curl_arguments";
 if(!easy||!url||strncmp(url,"https://",8)||!token||strlen(token)!=64||!body||size>BX_HTTPS_LIMIT||!output||!capacity||capacity>BX_HTTPS_LIMIT)return 0;
 for(i=0;i<64;i++)if(!((token[i]>='0'&&token[i]<='9')||(token[i]>='a'&&token[i]<='f')||(token[i]>='A'&&token[i]<='F')))return 0;
 snprintf(auth,sizeof(auth),"Authorization: Bearer %s",token);
 headers=curl_slist_append(NULL,auth);memset(auth,0,sizeof(auth));if(!headers){c->code=CURLE_OUT_OF_MEMORY;return 0;}
 next=curl_slist_append(headers,"Content-Type: application/octet-stream");if(!next){c->code=CURLE_OUT_OF_MEMORY;goto done;}headers=next;
 next=curl_slist_append(headers,"Expect:");if(!next){c->code=CURLE_OUT_OF_MEMORY;goto done;}headers=next;
 curl_easy_reset(easy);c->stage="curl_options";
#define SET(option,value) do {c->code=curl_easy_setopt(easy,option,value);if(c->code!=CURLE_OK)goto done;}while(0)
 SET(CURLOPT_URL,url);SET(CURLOPT_PROXY,"");SET(CURLOPT_PROTOCOLS_STR,"https");SET(CURLOPT_REDIR_PROTOCOLS_STR,"https");SET(CURLOPT_FOLLOWLOCATION,0L);
 SET(CURLOPT_SSL_VERIFYPEER,1L);SET(CURLOPT_SSL_VERIFYHOST,2L);SET(CURLOPT_CAINFO_BLOB,&roots);SET(CURLOPT_CAPATH,NULL);
 SET(CURLOPT_CONNECTTIMEOUT_MS,3000L);SET(CURLOPT_TIMEOUT_MS,5000L);SET(CURLOPT_NOSIGNAL,1L);SET(CURLOPT_HTTP_VERSION,(long)CURL_HTTP_VERSION_1_1);
 SET(CURLOPT_HTTPHEADER,headers);SET(CURLOPT_POST,1L);SET(CURLOPT_POSTFIELDS,body);SET(CURLOPT_POSTFIELDSIZE_LARGE,(curl_off_t)size);
 SET(CURLOPT_WRITEFUNCTION,receive);SET(CURLOPT_WRITEDATA,&sink);SET(CURLOPT_USERAGENT,"BX-Native-Transport/0.7");
 c->stage="curl_perform";c->code=curl_easy_perform(easy);if(c->code!=CURLE_OK)goto done;
 c->stage="curl_status";c->code=curl_easy_getinfo(easy,CURLINFO_RESPONSE_CODE,&response);if(c->code!=CURLE_OK||response<100||response>599)goto done;
 *status=(int)response;*length=sink.used;ok=response==200;c->stage="none";
done:
 /* Reset clears pointers to stack data, credentials and response buffers. The
  * connection cache remains available for the following authenticated poll. */
 curl_easy_reset(easy);curl_slist_free_all(headers);return ok;
#undef SET
}
