#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "../pair_protocol.h"

int main(void) {
    char code[9], id[65], claim[65], status[32], json[240];
    const char *identifier = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    char input[320];

    assert(bx_pair_valid_origin("https://relay.example.org"));
    assert(bx_pair_valid_origin("https://relay.example.org:8443"));
    assert(!bx_pair_valid_origin("http://relay.example.org"));
    assert(!bx_pair_valid_origin("https://relay.example.org/path"));
    assert(!bx_pair_valid_origin("https://user@relay.example.org"));
    assert(!bx_pair_valid_origin("https://relay.example.org?token=secret"));
    assert(bx_pair_valid_token(identifier));
    assert(!bx_pair_valid_token("1234"));

    assert(bx_pair_code("{\"code\":\"04839172\",\"expiresInSeconds\":120}", code));
    assert(strcmp(code, "04839172") == 0);
    assert(!bx_pair_code("{\"code\":\"0483\\u0039\"}", code));
    assert(!bx_pair_code("{\"code\":\"0412a723\"}", code));

    snprintf(input, sizeof(input), "{\"requestId\":\"%s\"}", identifier);
    assert(bx_pair_identifier(input, "requestId", id));
    assert(strcmp(id, identifier) == 0);
    assert(!bx_pair_identifier("{\"requestId\":\"ABC\"}", "requestId", id));
    assert(bx_pair_status("{\"status\":\"pending_confirmation\"}", status));
    assert(!bx_pair_status("{\"status\":\"unknown\"}", status));

    strcpy(claim, identifier);
    assert(bx_pair_decision_json(json, sizeof(json), id, claim, 1));
    assert(strstr(json, "\"allow\":true") != NULL);
    assert(!bx_pair_decision_json(json, 20, id, claim, 1));
    puts("Native pairing protocol validated on host.");
    return 0;
}
