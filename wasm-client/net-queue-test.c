#include "net-queue.h"
#include <assert.h>
int main(void){
 uint8_t source[]={0,1,2,3,4,5},output[6]={0};size_t available=6;
 assert(bx_net_consume(source,&available,output,2,1)==2);assert(available==4);
 assert(bx_net_consume(source,&available,output+2,1,1)==1);assert(available==3);
 assert(bx_net_consume(source,&available,output+3,3,1)==3);assert(!available);
 for(unsigned i=0;i<6;i++)assert(output[i]==i);
 available=6;assert(bx_net_consume(source,&available,output,2,0)==2);assert(!available);
 available=3;assert(bx_net_consume(source,&available,output,0,1)==0);assert(available==3);
 return 0;
}
