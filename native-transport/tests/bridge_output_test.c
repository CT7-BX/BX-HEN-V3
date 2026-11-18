/* Exact wire bytes and bounded stack allocation, not a gameplay benchmark. */
#include "../bridge.h"
#include <assert.h>
#include <string.h>
static unsigned emitted;static size_t expected;static uint8_t payload[BX_BRIDGE_MAX_PAYLOAD];
static int capture(void *ctx,const uint8_t *p,size_t n){(void)ctx;uint8_t header[28]={129};header[8]=10;header[16]=0x50;header[17]=0x24;header[20]=127;header[23]=1;for(unsigned i=0;i<4;i++)header[24+i]=(uint8_t)(expected>>(8*i));assert(n==28+expected);assert(!memcmp(p,header,28));assert(!memcmp(p+28,payload,expected));emitted++;return 1;}
int main(void){BXBridge b;BXBridgeOps ops={0};bx_bridge_init(&b,&ops,NULL,capture);b.sockets[0]=(BXBridgeSocket){1,10,1,2,9296};for(size_t i=0;i<sizeof(payload);i++)payload[i]=(uint8_t)(i*7+3);const size_t sizes[]={65507,0,1,64,1400,16384,65507,0};
 for(unsigned i=0;i<sizeof(sizes)/sizeof(sizes[0]);i++){expected=sizes[i];assert(bx_bridge_data(&b,10,9296,payload,expected));}
 assert(emitted==8);assert(!bx_bridge_data(&b,10,9296,payload,(size_t)-1));assert(!bx_bridge_data(&b,10,9296,payload,65508));assert(!bx_bridge_data(&b,10,9296,NULL,1));assert(emitted==8&&!b.failed);return 0;}
