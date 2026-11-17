#include "../bridge.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static uint8_t last[70000];static size_t size;static int opened,closed,sends,partial,full=1;
static void put(uint8_t *p,unsigned v){p[0]=(uint8_t)v;p[1]=(uint8_t)(v>>8);p[2]=(uint8_t)(v>>16);p[3]=(uint8_t)(v>>24);}
static int get(const uint8_t *p){return (int32_t)((uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24));}
static int emit(void *c,const uint8_t *p,size_t n){(void)c;memcpy(last,p,n);size=n;return full;}
static int open_op(void *c,int t){(void)c;(void)t;return ++opened;}
static int close_op(void *c,int s){(void)c;(void)s;++closed;return 0;}
static int bind_op(void *c,int s){(void)c;(void)s;return 0;}
static int connect_op(void *c,int s,unsigned p){(void)c;(void)s;assert(p==9295 || p==9296 || p==9297);return 0;}
static int send_op(void *c,int s,int t,unsigned p,const void *d,size_t n){(void)c;(void)s;(void)t;(void)p;(void)d;++sends;return partial?1:(int)n;}
static int name_op(void *c,int s,unsigned *p){(void)c;(void)s;*p=34567;return 0;}
static int shut_op(void *c,int s){(void)c;(void)s;return 0;}
int main(void){
    BXBridge b;uint8_t p[32]={1};const BXBridgeOps ops={open_op,close_op,bind_op,connect_op,send_op,name_op,shut_op};
    bx_bridge_init(&b,&ops,NULL,emit);put(p+4,1);put(p+8,4096);put(p+16,1);
    assert(bx_bridge_handle(&b,p,28));assert(opened==1 && get(last+12)==0 && size==28);
    p[0]=4;put(p+16,22);put(p+20,0x7f000001);assert(bx_bridge_handle(&b,p,28));assert(get(last+16)==13);
    put(p+16,9295);put(p+20,0xc0a80101);assert(bx_bridge_handle(&b,p,28));assert(get(last+16)==13);
    put(p+20,0x7f000001);assert(bx_bridge_handle(&b,p,28));assert(get(last+12)==0);
    p[0]=5;put(p+16,0);put(p+24,4);memcpy(p+28,"real",4);partial=1;
    assert(bx_bridge_handle(&b,p,32));assert(sends==1 && get(last+12)==1);
    assert(!bx_bridge_handle(&b,p,31));assert(sends==1);
    put(p+24,0xffffffff);assert(!bx_bridge_handle(&b,p,32));assert(sends==1);
    put(p+24,4);full=0;assert(!bx_bridge_handle(&b,p,32));assert(b.failed && closed==1);
    assert(!bx_bridge_handle(&b,p,32));assert(sends==2);
    bx_bridge_close(&b);assert(closed==1);
    puts("Binary bridge validation, destination restrictions, partial writes and backpressure passed.");return 0;
}
