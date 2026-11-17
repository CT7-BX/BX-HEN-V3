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
p.write_text(s)
p=root/'wasm/CMakeLists.txt';s=p.read_text();assert '_chiaki_wasm_init' in s;s=s.replace('_chiaki_wasm_init','_bx_remote_set_ticket\n\t_chiaki_wasm_init');p.write_text(s)
