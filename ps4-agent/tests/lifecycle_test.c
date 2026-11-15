#include <assert.h>
#include <stdio.h>
#include "../resident/lifecycle.h"

int main(void)
{
    bx_agent_lifecycle a;
    bx_agent_init(&a);
    assert(a.state == BX_AGENT_STOPPED);
    bx_agent_on_failure(&a);
    assert(a.state == BX_AGENT_STOPPED);
    bx_agent_start(&a);
    assert(a.enabled && a.state == BX_AGENT_STARTING);
    bx_agent_start(&a); /* Idempotent: never start two instances. */
    assert(a.failures == 0);
    bx_agent_on_failure(&a);
    assert(a.state == BX_AGENT_BACKOFF && a.retry_ms == 1000);
    bx_agent_retry(&a);
    bx_agent_on_failure(&a);
    assert(a.retry_ms == 2000);
    for (int i = 0; i < 40; i++) {
        bx_agent_retry(&a);
        bx_agent_on_failure(&a);
        assert(a.retry_ms <= 60000);
    }
    assert(a.retry_ms == 60000);
    bx_agent_on_connected(&a);
    assert(a.state == BX_AGENT_READY && a.failures == 0 && a.retry_ms == 0);
    bx_agent_stop(&a);
    assert(!a.enabled && a.state == BX_AGENT_STOPPED);
    bx_agent_retry(&a);
    assert(a.state == BX_AGENT_STOPPED);
    puts("PS4 resident lifecycle: 0 errors");
    return 0;
}
