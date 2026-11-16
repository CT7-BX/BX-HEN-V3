#include "../pair_config.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
int main(void) {
    BXPairConfig config = {{0}, {0}};
    const char *token = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    char example[400];
    snprintf(example, sizeof(example),
        "# BX Remote private pairing\nrelay_base=https://relay.example.org:443\nconsole_token=%s\n", token);
    assert(bx_pair_parse_config(example, &config));
    assert(!strcmp(config.relay_origin, "https://relay.example.org:443"));
    assert(!strcmp(config.console_token, token));
    /* Windows/iPhone text editors may add UTF-8 BOM and blank CRLF lines.
     * Strict token/HTTPS validation must still apply after normalization.
     */
    snprintf(example, sizeof(example),
        "\xEF\xBB\xBF# private config\r\n\r\n  relay_base=https://relay.example.org\r\n"
        "  console_token=%s\r\n  \r\n", token);
    assert(bx_pair_parse_config(example, &config));
    assert(!strcmp(config.relay_origin, "https://relay.example.org"));
    assert(!strcmp(config.console_token, token));
    snprintf(example, sizeof(example),
        "\xEF\xBB\xBFrelay_base=http://insecure.net\r\nconsole_token=%s\r\n", token);
    assert(!bx_pair_parse_config(example, &config));
    snprintf(example, sizeof(example),
        "relay_base=https://relay.example.org\r\nconsole_token=%s\r\n"
        "unknown_key=something\r\n", token);
    assert(!bx_pair_parse_config(example, &config));
    assert(!bx_pair_parse_config("relay_base=http://insecure.net\nconsole_token=abc\n", &config));
    assert(!bx_pair_parse_config("relay_base=https://a.b\nconsole_token=abc\n", &config));
    assert(!bx_pair_parse_config("relay_base=https://a.b\nextra=1\nconsole_token=0123\n", &config));
    assert(!bx_pair_parse_config("relay_base=https://a.b\nconsole_token=0123\nconsole_token=abcd\n", &config));
    puts("Native pairing configuration rules verified.");
    return 0;
}
