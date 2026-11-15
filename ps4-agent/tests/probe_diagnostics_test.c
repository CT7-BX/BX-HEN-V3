#include <assert.h>
#include <stdio.h>
#include <string.h>

#include "../probe_diagnostics.h"

int main(void)
{
    assert(bx_probe_should_retry("net_init", 0));
    assert(bx_probe_should_retry("https_connect", 0));
    assert(bx_probe_should_retry("https_send", 0));
    assert(bx_probe_should_retry("http_body", 200));
    assert(bx_probe_should_retry("http_status", 502));
    assert(bx_probe_should_retry("http_status", 503));
    assert(bx_probe_should_retry("http_status", 504));
    assert(!bx_probe_should_retry("http_status", 403));
    assert(!bx_probe_should_retry("http_status", 404));
    assert(!bx_probe_should_retry("http_status", 200));
    assert(!bx_probe_should_retry("validate_marker", 200));
    assert(!bx_probe_should_retry("ssl_init", 0));
    assert(!bx_probe_should_retry(0, 0));

    assert(strstr(bx_probe_hint("http_status", 404), "nao encontrado"));
    assert(strstr(bx_probe_hint("http_status", 503), "indisponivel"));
    assert(strstr(bx_probe_hint("https_send", 0), "data/hora"));
    assert(strstr(bx_probe_hint("validate_marker", 200), "inesperada"));
    assert(strlen(bx_probe_hint(NULL, 0)) > 0);

    puts("BX-REMOTE-PLAY diagnostics: retry and classification tests OK");
    return 0;
}
