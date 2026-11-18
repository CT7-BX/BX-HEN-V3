/* AGPL-3.0-or-later. Preserve TCP bytes across short reads; UDP stays atomic. */
#ifndef BX_NET_QUEUE_H
#define BX_NET_QUEUE_H
#include <stddef.h>
#include <stdint.h>
#include <string.h>
static inline size_t bx_net_consume(uint8_t *data,size_t *available,void *output,size_t capacity,int stream){
    size_t n=*available<capacity?*available:capacity;
    if(n)memcpy(output,data,n);
    if(stream&&n<*available){memmove(data,data+n,*available-n);*available-=n;}
    else *available=0;
    return n;
}
#endif
