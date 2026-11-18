"""Add a bounded session subprotocol; never put relay bearer keys in a URL.
Upstream remains AGPL-3.0 and is included with all modified source in the build.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1])
p=root/'wasm/src/chiaki_wasm_net.c';s=p.read_text()
needle='int chiaki_wasm_net_connect(const char *proxy_url)'
assert s.count(needle)==1
addition='''static char bx_protocols[80] = "binary";
EMSCRIPTEN_KEEPALIVE
int bx_remote_set_ticket(const char *ticket) {
    size_t i;
    if(!ticket || strlen(ticket)!=64)return -1;
    for(i=0;i<64;i++)if(!((ticket[i]>='0' && ticket[i]<='9') || (ticket[i]>='a' && ticket[i]<='f')))return -1;
    snprintf(bx_protocols,sizeof(bx_protocols),"binary,bx.%s",ticket);
    return 0;
}

'''
s=s.replace('#include <emscripten/websocket.h>','#include <emscripten/emscripten.h>\n#include <emscripten/websocket.h>')
s=s.replace(needle,addition+needle).replace('attr.protocols = "binary";','attr.protocols = bx_protocols;')
# The virtual socket layer previously discarded the unread tail of TCP packets.
header=Path(__file__).with_name('net-queue.h')
(root/'wasm/src/bx_net_queue.h').write_bytes(header.read_bytes())
s=s.replace('#include <emscripten/websocket.h>','#include <emscripten/websocket.h>\n#include "bx_net_queue.h"')
old='\t\t\tsize_t n = p->len < len ? p->len : len;\n\t\t\tmemcpy(buf, p->data, n);'
new='\t\t\tsize_t n = bx_net_consume(p->data, &p->len, buf, len, s->kind == FD_TCP);'
assert s.count(old)==1
s=s.replace(old,new)
old='\t\t\ts->q_head = p->next;'
# This occurrence belongs to dequeue_recv, not enqueue eviction.
start=s.index('static ssize_t dequeue_recv(')
prefix,tail=s[:start],s[start:]
assert tail.count(old)==1
tail=tail.replace(old,'\t\t\tif(p->len)\n\t\t\t\treturn (ssize_t)n;\n'+old,1)
s=prefix+tail
p.write_text(s)
p=root/'wasm/CMakeLists.txt';s=p.read_text();assert '_chiaki_wasm_init' in s;s=s.replace('_chiaki_wasm_init','_bx_remote_set_ticket\n\t_chiaki_wasm_init');p.write_text(s)
# Bounded virtual receive queues: TCP must never silently discard stream bytes.
p=root/'wasm/src/chiaki_wasm_net.c';s=p.read_text()
s=s.replace('\tint q_count;','\tint q_count;\n\tsize_t q_bytes;')
s=s.replace('\ts->q_count = 0;','\ts->q_count = 0;\n\ts->q_bytes = 0;')
start=s.index('static void enqueue_pkt(');end=s.index('\nstatic void hdr_write(',start)
s=s[:start]+'''static void bx_net_fail_locked(void)
{
    g_ws_failed = 1;
    g_ws_open = 0;
    pthread_cond_broadcast(&g_cv);
}

static void enqueue_pkt(NetFd *s, const uint8_t *data, size_t len, uint32_t addr, uint16_t port)
{
    if(g_ws_failed || s->closed)return;
    const size_t limit = s->kind == FD_TCP ? 2u*1024u*1024u : 512u*1024u;
    if(len > limit){if(s->kind == FD_TCP)bx_net_fail_locked();return;}
    if(s->kind == FD_TCP && (s->q_count >= PKT_QUEUE_MAX || s->q_bytes > limit-len))
    {
        bx_net_fail_locked();return;
    }
    while(s->q_head && (s->q_count >= PKT_QUEUE_MAX || s->q_bytes > limit-len))
    {
        NetPkt *old = s->q_head;s->q_head = old->next;
        if(!s->q_head)s->q_tail = NULL;
        s->q_count--;s->q_bytes -= old->len;free(old->data);free(old);
    }
    NetPkt *p = calloc(1, sizeof(NetPkt));
    if(!p){if(s->kind == FD_TCP)bx_net_fail_locked();return;}
    p->data = malloc(len ? len : 1);
    if(!p->data){free(p);if(s->kind == FD_TCP)bx_net_fail_locked();return;}
    if(len)memcpy(p->data, data, len);
    p->len = len;p->addr = addr;p->port = port;
    if(s->q_tail)s->q_tail->next = p;else s->q_head = p;
    s->q_tail = p;s->q_count++;s->q_bytes += len;
}
''' +s[end:]
old='\t\t\tsize_t n = bx_net_consume(p->data, &p->len, buf, len, s->kind == FD_TCP);'
assert s.count(old)==1
s=s.replace(old,'\t\t\tsize_t before = p->len;\n'+old+'\n\t\t\ts->q_bytes -= before-p->len;')
start=s.index('static ssize_t dequeue_recv(');end=s.index('\nssize_t __wrap_recvfrom(',start)
a=s[start:end];a=a.replace('\t\tif(s->q_head)', '\t\tif(g_ws_failed){errno = ECONNRESET;return -1;}\n\t\tif(s->q_head)',1);s=s[:start]+a+s[end:]
s=s.replace('(s->q_head || s->closed)', '(s->q_head || s->closed || g_ws_failed)')
s=s.replace('(s->connected || s->closed)', '(s->connected || s->closed || g_ws_failed)')
s=s.replace('if(!g_ws_open || !g_ws)', 'if(g_ws_failed || !g_ws_open || !g_ws)')
start=s.index('static EM_BOOL on_error(');end=s.index('static EM_BOOL on_close(',start);a=s[start:end].replace('\tg_ws_failed = 1;', '\tg_ws_failed = 1;\n\tg_ws_open = 0;');s=s[:start]+a+s[end:]
start=s.index('void chiaki_wasm_net_disconnect(');end=s.index('int chiaki_wasm_net_is_ready(',start);a=s[start:end].replace('\tg_ws_open = 0;', '\tg_ws_open = 0;\n\tg_ws_failed = 1;\n\tpthread_cond_broadcast(&g_cv);');s=s[:start]+a+s[end:]
p.write_text(s)
# Debug formatting/hexdumps must not synchronously proxy to the UI during play.
p=root/'wasm/src/chiaki_wasm.c';s=p.read_text();old='CHIAKI_LOG_ALL & ~CHIAKI_LOG_VERBOSE';assert s.count(old)==1
s=s.replace(old,'CHIAKI_LOG_ERROR | CHIAKI_LOG_WARNING | CHIAKI_LOG_INFO');p.write_text(s)
