/* BX Remote Play binary socket bridge. Written for BX; wire specification:
 * https://github.com/CSystem77/Chiaki-NG-Web (AGPL-3.0 client, separately built).
 * This engine NEVER chooses a host: adapters connect only to PS4 loopback.
 */
#include "bridge.h"
#include <string.h>
static uint32_t read32(const uint8_t *p) {
    return (uint32_t)p[0] | ((uint32_t)p[1]<<8) | ((uint32_t)p[2]<<16) | ((uint32_t)p[3]<<24);
}
static void write32(uint8_t *p, uint32_t n) {
    p[0]=(uint8_t)n; p[1]=(uint8_t)(n>>8); p[2]=(uint8_t)(n>>16); p[3]=(uint8_t)(n>>24);
}
static int output(BXBridge *b, unsigned type, uint32_t id, int fd,
                  int a, int error, uint32_t extra, const void *data, size_t length) {
    uint8_t packet[BX_BRIDGE_HEADER+BX_BRIDGE_MAX_PAYLOAD]={0};
    if(b->failed || length>BX_BRIDGE_MAX_PAYLOAD || (!data && length))return 0;
    packet[0]=(uint8_t)type; write32(packet+4,id);write32(packet+8,(uint32_t)fd);
    write32(packet+12,(uint32_t)a);write32(packet+16,(uint32_t)error);
    write32(packet+20,extra);write32(packet+24,(uint32_t)length);
    if(length)memcpy(packet+28,data,length);
    if(!b->emit(b->context,packet,28+length)){b->failed=1;bx_bridge_close(b);return 0;}
    return 1;
}
static BXBridgeSocket *find(BXBridge *b,int fd) {
    size_t i;for(i=0;i<BX_BRIDGE_SOCKETS;i++)
        if(b->sockets[i].used && b->sockets[i].fd==fd)return &b->sockets[i];
    return NULL;
}
static void close_one(BXBridge *b,BXBridgeSocket *s) {
    if(s->used)b->ops.close(b->context,s->socket);
    memset(s,0,sizeof(*s));
}
void bx_bridge_close(BXBridge *b) {
    size_t i;for(i=0;i<BX_BRIDGE_SOCKETS;i++)close_one(b,&b->sockets[i]);
}
void bx_bridge_init(BXBridge *b,const BXBridgeOps *ops,void *ctx,
                    int (*emit)(void *,const uint8_t *,size_t)) {
    memset(b,0,sizeof(*b));b->ops=*ops;b->context=ctx;b->emit=emit;
}
static int allowed(int type,unsigned port) {
    return (type==1 && port==9295) || (type==2 && (port==9295 || port==9296 || port==9297));
}
int bx_bridge_handle(BXBridge *b,const uint8_t *p,size_t length) {
    uint32_t id,n,host; int fd,type,result=-1,error=22;unsigned port;
    BXBridgeSocket *s;size_t i;
    if(!b || b->failed || !p || length<28)return 0;
    id=read32(p+4);fd=(int32_t)read32(p+8);n=read32(p+24);
    if(p[1]||p[2]||p[3]||n>BX_BRIDGE_MAX_PAYLOAD || length!=28u+n)return 0;
    if(fd<0 || fd>65535)return 0;
    type=p[0];s=find(b,fd);port=read32(p+16);host=read32(p+20);
    /* Input addresses must be loopback or unspecified. No LAN, DNS, FTP,
       arbitrary internet targets or broadcast. The WASM client sends sin_addr.s_addr
       as a little-endian uint32: 127.0.0.1 bytes 7f 00 00 01 = 0x0100007f. */
    if((type==4 || type==6) && host!=0 && host!=0x0100007fu)
        return !id || output(b,128,id,fd,-1,13,0,NULL,0);
    if(type==1) {
        int kind=(int32_t)read32(p+16);
        if(s){error=17;goto reply;}
        if(kind!=1 && kind!=2){error=93;goto reply;}
        for(i=0;i<BX_BRIDGE_SOCKETS && b->sockets[i].used;i++){}
        if(i==BX_BRIDGE_SOCKETS){error=24;goto reply;}
        result=b->ops.open(b->context,kind);
        if(result<0){error=5;result=-1;goto reply;}
        s=&b->sockets[i];s->used=1;s->fd=fd;s->socket=result;s->type=kind;
        result=0;error=0;
    } else if(type==9) {
        /* Only numeric loopback is resolved, never external hostnames. */
        static const char target[]="127.0.0.1";uint8_t addr[4]={127,0,0,1};
        if(!((n==sizeof(target)-1 || n==sizeof(target)) &&
             !memcmp(p+28,target,sizeof(target)-1) && (n!=sizeof(target) || p[28+n-1]==0)))
            goto reply;
        return !id || output(b,128,id,fd,0x0100007f,0,0,addr,sizeof(addr));
    } else if(type==2) {
        if(s)close_one(b,s);
        result=0;error=0;
    } else if(!s){error=9;
    } else if(type==3) {
        if(s->type!=2){error=95;goto reply;}
        result=b->ops.bind(b->context,s->socket);error=result<0?98:0;
    } else if(type==4) {
        if(!allowed(s->type,port)){error=13;goto reply;}
        result=s->type==2?0:b->ops.connect(b->context,s->socket,port);error=result<0?111:0;
        if(result>=0){s->port=port;if(s->type==1 && !output(b,130,0,fd,0,0,0,NULL,0))return 0;}
    } else if(type==5 || type==6) {
        if(!port)port=s->port;
        if(!allowed(s->type,port)){error=13;goto reply;}
        result=b->ops.send(b->context,s->socket,s->type,port,p+28,n);
        /* Preserve actual byte count: partial TCP writes are NOT full success. */
        error=result<0?11:0;
        if(s->type==2 && result>=0 && (uint32_t)result!=n){result=-1;error=5;}
    } else if(type==8) {
        port=0;result=b->ops.name(b->context,s->socket,&port);error=result<0?5:0;
        if(result>=0)return !id || output(b,128,id,fd,(int)port,0,0x0100007fu,NULL,0);
    } else if(type==10) {
        result=b->ops.shutdown(b->context,s->socket);error=result<0?5:0;
    } else if(type==7) {
        /* Only harmless reuse-address requests; no broadcast or routing knobs. */
        result=0;error=0;
    } else {error=95;}
reply:
    return !id || output(b,128,id,fd,result,error,0,NULL,0);
}
int bx_bridge_data(BXBridge *b,int fd,unsigned port,const void *p,size_t n) {
    BXBridgeSocket *s=find(b,fd);
    if(!s || !allowed(s->type,port))return 0;
    return output(b,129,0,fd,0,(int)port,0x0100007fu,p,n);
}

int bx_bridge_eof(BXBridge *b,int fd) {
    BXBridgeSocket *s=find(b,fd);int ok;if(!s)return 0;
    ok=output(b,131,0,fd,0,0,0,NULL,0);close_one(b,s);return ok;
}
