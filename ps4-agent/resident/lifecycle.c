#include "lifecycle.h"

#include <string.h>

#define INITIAL_RETRY_MS 1000u
#define MAX_RETRY_MS 60000u

void bx_agent_init(bx_agent_lifecycle *agent)
{
    if (agent == 0) return;
    memset(agent, 0, sizeof(*agent));
    agent->state = BX_AGENT_STOPPED;
}

void bx_agent_start(bx_agent_lifecycle *agent)
{
    if (agent == 0 || agent->enabled) return;
    agent->enabled = 1;
    agent->failures = 0;
    agent->retry_ms = 0;
    agent->state = BX_AGENT_STARTING;
}

void bx_agent_on_connected(bx_agent_lifecycle *agent)
{
    if (agent == 0 || !agent->enabled) return;
    agent->state = BX_AGENT_READY;
    agent->failures = 0;
    agent->retry_ms = 0;
}

void bx_agent_on_failure(bx_agent_lifecycle *agent)
{
    uint32_t next;
    if (agent == 0 || !agent->enabled) return;
    if (agent->failures < 32) agent->failures++;
    next = agent->retry_ms == 0 ? INITIAL_RETRY_MS : agent->retry_ms * 2;
    /* Saturate before multiplication when the retry interval is already high. */
    if (agent->retry_ms >= MAX_RETRY_MS / 2) next = MAX_RETRY_MS;
    if (next > MAX_RETRY_MS) next = MAX_RETRY_MS;
    agent->retry_ms = next;
    agent->state = BX_AGENT_BACKOFF;
}

void bx_agent_retry(bx_agent_lifecycle *agent)
{
    if (agent == 0 || !agent->enabled || agent->state != BX_AGENT_BACKOFF) return;
    agent->state = BX_AGENT_STARTING;
}

void bx_agent_stop(bx_agent_lifecycle *agent)
{
    if (agent == 0) return;
    agent->enabled = 0;
    agent->state = BX_AGENT_STOPPED;
    agent->failures = 0;
    agent->retry_ms = 0;
}
