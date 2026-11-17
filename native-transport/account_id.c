/* Local display/export only. This does not activate or alter a PS4 account. */
#include "account_id.h"
void bx_account_id_base64(uint64_t id,char out[13]){
    static const char table[]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    unsigned char bytes[8];unsigned i,j=0;for(i=0;i<8;i++)bytes[i]=(unsigned char)(id>>(8*i));
    for(i=0;i<8;i+=3){unsigned n=(unsigned)bytes[i]<<16;if(i+1<8)n|=(unsigned)bytes[i+1]<<8;if(i+2<8)n|=bytes[i+2];out[j++]=table[(n>>18)&63];out[j++]=table[(n>>12)&63];out[j++]=i+1<8?table[(n>>6)&63]:'=';out[j++]=i+2<8?table[n&63]:'=';}out[j]='\0';
}
