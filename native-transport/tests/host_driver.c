/* Host integration harness, not the PS4 payload. stdin is test traffic only. */
#include "../bridge.h"
#include "../socket_adapter.h"
#include <stdio.h>
#include <stdlib.h>
#include <sys/select.h>
#include <unistd.h>
static unsigned get32(const unsigned char *p){return p[0]|((unsigned)p[1]<<8)|((unsigned)p[2]<<16)|((unsigned)p[3]<<24);}
static int emit(void *ctx,const uint8_t *data,size_t length){
    uint8_t prefix[4]={(uint8_t)length,(uint8_t)(length>>8),(uint8_t)(length>>16),(uint8_t)(length>>24)};
    (void)ctx;return fwrite(prefix,1,4,stdout)==4 && fwrite(data,1,length,stdout)==length && fflush(stdout)==0;
}
int main(void){BXBridge bridge;uint8_t packet[65535],prefix[4];bx_bridge_init(&bridge,&bx_socket_ops,NULL,emit);
    for(;;){fd_set input;struct timeval wait={0,10000};int ready;FD_ZERO(&input);FD_SET(STDIN_FILENO,&input);
        ready=select(STDIN_FILENO+1,&input,NULL,NULL,&wait);if(ready<0)break;
        if(ready){unsigned size;if(fread(prefix,1,4,stdin)!=4)break;size=get32(prefix);
            if(size>sizeof(packet) || fread(packet,1,size,stdin)!=size || !bx_bridge_handle(&bridge,packet,size))break;}
        if(bx_socket_receive(&bridge)<0)break;
    }
    bx_bridge_close(&bridge);return 0;
}
