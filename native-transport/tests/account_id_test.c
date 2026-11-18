#include "../account_id.h"
#include <assert.h>
#include <string.h>
int main(void){char out[13];bx_account_id_base64(UINT64_C(0x0102030405060708),out);assert(!strcmp(out,"CAcGBQQDAgE="));bx_account_id_base64(UINT64_C(0xffffffffffffffff),out);assert(!strcmp(out,"//////////8="));return 0;}
