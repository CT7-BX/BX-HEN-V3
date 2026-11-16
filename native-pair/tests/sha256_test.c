#include "../sha256.h"
#include <assert.h>
#include <string.h>
#include <stdio.h>
int main(void) {
    BXHash256 h; char digest[65]; size_t i;
    bx_sha256_init(&h); bx_sha256_finish(&h,digest);
    assert(!strcmp(digest,"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
    bx_sha256_init(&h); bx_sha256_update(&h,"abc",3);bx_sha256_finish(&h,digest);
    assert(!strcmp(digest,"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
    bx_sha256_init(&h);for(i=0;i<1000000;i++)bx_sha256_update(&h,"a",1);
    bx_sha256_finish(&h,digest);
    assert(!strcmp(digest,"cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"));
    puts("SHA-256 streaming: 3 reference vectors passed.");
    return 0;
}
