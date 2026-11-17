/* GPL-3.0-or-later. Verified WSS, bounded messages, no replay after disconnect. */
#include "ws_client.h"
#include <curl/curl.h>
#include <string.h>
#include <stdio.h>
void bx_ws_close(BXWebSocket *w){bx_https_close(&w->tls);memset(w,0,sizeof(*w));}
int bx_ws_open(BXWebSocket *w,const char *url,const char *token,const char *ca,size_t ca_size){
 char auth[96];struct curl_slist *headers=NULL;CURL *easy;struct curl_blob roots;size_t i;int ok=0;memset(w,0,sizeof(*w));
 if(!url||strncmp(url,"wss://",6)||!token||strlen(token)!=64)return 0;
 for(i=0;i<64;i++)if(!((token[i]>='0'&&token[i]<='9')||(token[i]>='a'&&token[i]<='f')))return 0;
 if(!bx_https_init(&w->tls,ca,ca_size))return 0;easy=w->tls.handle;w->tls.stage="wss_options";
 snprintf(auth,sizeof(auth),"Authorization: Bearer %s",token);headers=curl_slist_append(NULL,auth);memset(auth,0,sizeof(auth));if(!headers){w->tls.code=CURLE_OUT_OF_MEMORY;return 0;}
 roots.data=w->tls.ca;roots.len=w->tls.ca_size;roots.flags=CURL_BLOB_COPY;
#define SET(option,value) do {w->tls.code=curl_easy_setopt(easy,option,value);if(w->tls.code!=CURLE_OK)goto done;}while(0)
 SET(CURLOPT_URL,url);SET(CURLOPT_PROXY,"");SET(CURLOPT_PROTOCOLS_STR,"wss");SET(CURLOPT_REDIR_PROTOCOLS_STR,"wss");SET(CURLOPT_FOLLOWLOCATION,0L);
 SET(CURLOPT_SSL_VERIFYPEER,1L);SET(CURLOPT_SSL_VERIFYHOST,2L);SET(CURLOPT_CAINFO_BLOB,&roots);SET(CURLOPT_CAPATH,NULL);
 SET(CURLOPT_HTTPHEADER,headers);SET(CURLOPT_CONNECT_ONLY,2L);SET(CURLOPT_CONNECTTIMEOUT_MS,5000L);SET(CURLOPT_TIMEOUT_MS,10000L);SET(CURLOPT_NOSIGNAL,1L);
 SET(CURLOPT_TCP_NODELAY,1L);SET(CURLOPT_TCP_KEEPALIVE,1L);SET(CURLOPT_TCP_KEEPIDLE,10L);SET(CURLOPT_TCP_KEEPINTVL,5L);
 w->tls.stage="wss_handshake";w->tls.code=curl_easy_perform(easy);curl_easy_getinfo(easy,CURLINFO_RESPONSE_CODE,&w->status);
 if(w->tls.code!=CURLE_OK)goto done;if(w->status!=101){w->tls.code=CURLE_WEIRD_SERVER_REPLY;goto done;}
 SET(CURLOPT_TIMEOUT_MS,0L);w->tls.stage="none";ok=1;
done:
 /* The handshake completed; the established socket no longer needs headers. */
 curl_easy_setopt(easy,CURLOPT_HTTPHEADER,NULL);curl_slist_free_all(headers);return ok;
#undef SET
}
int bx_ws_send(BXWebSocket *w,const uint8_t *data,size_t n,size_t *offset){size_t sent=0;CURLcode code;
 if(!w->tls.handle||!data||!n||n>BX_WS_LIMIT||*offset>n)return -1;
 if(*offset==n)return 1;
 w->tls.stage="wss_send";code=curl_ws_send(w->tls.handle,data+*offset,n-*offset,&sent,0,CURLWS_BINARY);
 if(sent>n-*offset){w->tls.code=CURLE_SEND_ERROR;return -1;}*offset+=sent;
 if(code!=CURLE_OK&&code!=CURLE_AGAIN){w->tls.code=code;return -1;}return *offset==n?1:0;
}
int bx_ws_receive(BXWebSocket *w,uint8_t *data,size_t capacity,size_t *length){
 size_t n=0;const struct curl_ws_frame *meta=NULL;CURLcode code;unsigned flags;curl_off_t left,offset;*length=0;
 if(!w->tls.handle||!data||!capacity||capacity>BX_WS_LIMIT||w->received>=capacity)return -1;
 w->tls.stage="wss_receive";code=curl_ws_recv(w->tls.handle,data+w->received,capacity-w->received,&n,&meta);
 if(code==CURLE_AGAIN)return 0;if(code!=CURLE_OK||!meta){w->tls.code=code;return -1;}
 flags=(unsigned)meta->flags;left=meta->bytesleft;offset=meta->offset;
#ifdef BX_WS_TEST_DIAGNOSTICS
 fprintf(stderr,"ws flags=%u offset=%lld left=%lld n=%zu accumulated=%zu frame=%zu\n",flags,(long long)offset,(long long)left,n,w->received,w->frame_received);
#endif
 if(flags&CURLWS_CLOSE){w->tls.code=CURLE_GOT_NOTHING;return -1;}
 if(flags&(CURLWS_PING|CURLWS_PONG))return 0;
 if((flags&CURLWS_TEXT)||(!w->message_started&&!(flags&CURLWS_BINARY))||offset!=(curl_off_t)w->frame_received||left<0||n>capacity-w->received||left>(curl_off_t)(capacity-w->received-n)){
  w->tls.code=CURLE_RECV_ERROR;return -1;
 }
 w->message_started=1;w->received+=n;w->frame_received+=n;
 if(left)return 0;w->frame_received=0;if(flags&CURLWS_CONT)return 0;
 *length=w->received;w->received=0;w->message_started=0;w->tls.stage="none";return 1;
}
