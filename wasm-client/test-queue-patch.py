"""Compile actual patched queue/read/select functions as a host fault fixture.
No browser, PS4 or network access. Times out if disconnect leaves a read asleep.
"""
from pathlib import Path
import subprocess,sys,tempfile
root=Path(sys.argv[1]);s=(root/'wasm/src/chiaki_wasm_net.c').read_text()
def part(a,b):return s[s.index(a):s.index(b,s.index(a))]
code=r'''
#define _POSIX_C_SOURCE 200809L
#include <assert.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <pthread.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <time.h>
#include "bx_net_queue.h"
#define FD_BASE 64
#define FD_MAX 64
#define PKT_QUEUE_MAX 2048
#define PIPE_BUF_SIZE 1024
#define EM_TRUE 1
typedef int EM_BOOL;
typedef struct {int unused;} EmscriptenWebSocketErrorEvent;
typedef struct {int unused;} EmscriptenWebSocketCloseEvent;
static int emscripten_websocket_close(int ws,int code,const char *reason){(void)ws;(void)code;(void)reason;return 0;}
static int emscripten_websocket_delete(int ws){(void)ws;return 0;}
static int __real_select(int n,fd_set *r,fd_set *w,fd_set *e,struct timeval *t){return select(n,r,w,e,t);}
'''
code+=part('typedef enum {','typedef struct {\n\tuint32_t id;')
code+='''
static pthread_mutex_t g_mu=PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t g_cv=PTHREAD_COND_INITIALIZER;
static NetFd g_fds[FD_MAX];
static int g_ws_open=1,g_ws_failed=0,g_ws=1;
'''
code+=part('static int is_ours(', 'static uint32_t alloc_id_locked(')
code+=part('static void pkt_free_all(', 'static void hdr_write(')
code+=part('static EM_BOOL on_error(', 'static EM_BOOL on_message(')
code+=part('void chiaki_wasm_net_disconnect(', 'int chiaki_wasm_net_is_ready(')
code+=part('static ssize_t dequeue_recv(', 'ssize_t __wrap_recvfrom(')
code+=part('int __wrap_select(', 'int __wrap_getaddrinfo(')
code+=r'''
static pthread_cond_t started_cv=PTHREAD_COND_INITIALIZER;
static int started,mode,thread_result,thread_errno;
static void *blocked(void *unused){(void)unused;
 pthread_mutex_lock(&g_mu);started=1;pthread_cond_broadcast(&started_cv);
 if(mode==0){uint8_t out;thread_result=(int)dequeue_recv(&g_fds[0],&out,1,NULL,1);thread_errno=errno;pthread_mutex_unlock(&g_mu);}
 else {pthread_mutex_unlock(&g_mu);fd_set r;FD_ZERO(&r);FD_SET(FD_BASE,&r);thread_result=__wrap_select(FD_BASE+1,mode==1?&r:NULL,mode==2?&r:NULL,NULL,NULL);assert(FD_ISSET(FD_BASE,&r));}
 return NULL;
}
static void reset(void){pkt_free_all(&g_fds[0]);memset(g_fds,0,sizeof(g_fds));g_fds[0].kind=FD_TCP;g_fds[0].fd=FD_BASE;g_ws_failed=0;g_ws_open=1;g_ws=1;}
int main(void){uint8_t data[16384]={0},out[16];NetFd *n=&g_fds[0];reset();
 for(int i=0;i<6;i++)data[i]=(uint8_t)i;
 enqueue_pkt(n,data,6,0,9295);assert(n->q_bytes==6);
 assert(dequeue_recv(n,out,0,NULL,0)==0&&n->q_bytes==6);
 for(int i=0;i<3;i++){assert(dequeue_recv(n,out+2*i,2,NULL,0)==2);assert(n->q_bytes==(size_t)(4-2*i));}
 for(int i=0;i<6;i++)assert(out[i]==i);assert(n->q_count==0&&!n->q_head&&!n->q_tail);
 // A full TCP queue must fail the transport, never evict older stream bytes.
 for(int i=0;i<128;i++)enqueue_pkt(n,data,sizeof(data),0,9295);
 assert(n->q_bytes==2u*1024u*1024u);enqueue_pkt(n,data,1,0,9295);assert(g_ws_failed&&!g_ws_open&&n->q_count==128);out[0]=255;assert(dequeue_recv(n,out,1,NULL,0)==-1&&errno==ECONNRESET&&out[0]==255);reset();
 for(int i=0;i<PKT_QUEUE_MAX;i++)enqueue_pkt(n,data,1,0,9295);enqueue_pkt(n,data,1,0,9295);assert(g_ws_failed&&n->q_count==PKT_QUEUE_MAX);reset();
 // UDP may evict only complete datagrams; verify cap and byte accounting.
 n->kind=FD_UDP;for(int i=0;i<33;i++){memset(data,i,sizeof(data));enqueue_pkt(n,data,sizeof(data),0,9296);}assert(!g_ws_failed&&n->q_bytes==512u*1024u&&n->q_count==32&&n->q_head->data[0]==1);
 assert(dequeue_recv(n,out,sizeof(out),NULL,0)==sizeof(out));assert(out[0]==1&&n->q_count==31&&n->q_bytes==31u*sizeof(data));reset();
 // A transport failure must wake both an indefinite recv and select.
 for(mode=0;mode<3;mode++){reset();started=0;pthread_t thread;assert(!pthread_create(&thread,NULL,blocked,NULL));pthread_mutex_lock(&g_mu);while(!started)pthread_cond_wait(&started_cv,&g_mu);pthread_mutex_unlock(&g_mu);chiaki_wasm_net_disconnect();assert(!pthread_join(thread,NULL));assert(mode?thread_result==1:thread_result==-1&&thread_errno==ECONNRESET);}
 reset();on_error(0,NULL,NULL);assert(!g_ws_open&&g_ws_failed);reset();on_close(0,NULL,NULL);assert(!g_ws_open&&g_ws_failed);reset();pkt_free_all(n);return 0;
}
'''
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp);(p/'test.c').write_text(code)
 subprocess.run(['cc','-std=c11','-Wall','-Wextra','-Werror','-Wno-misleading-indentation','-pthread','-I'+str(root/'wasm/src'),str(p/'test.c'),'-o',str(p/'test')],check=True)
 subprocess.run([str(p/'test')],check=True,timeout=10)
print('Patched client: TCP integrity, byte limits, UDP atomicity and recv/select wakeups passed (host fixture, not PS4).')
