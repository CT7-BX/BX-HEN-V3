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
