#ifndef BX_REMOTE_AGENT_LIFECYCLE_H
#define BX_REMOTE_AGENT_LIFECYCLE_H

#include <stdint.h>

typedef enum bx_agent_state {
    BX_AGENT_STOPPED = 0,
    BX_AGENT_STARTING,
    BX_AGENT_READY,
    BX_AGENT_BACKOFF
} bx_agent_state;

typedef struct bx_agent_lifecycle {
    bx_agent_state state;
    unsigned failures;
    uint32_t retry_ms;
    int enabled;
} bx_agent_lifecycle;

/*
 * Portable lifecycle, no PS4 SDK required.
 * Does not launch a payload, open a network port or stream data.
 */
void bx_agent_init(bx_agent_lifecycle *agent);
void bx_agent_start(bx_agent_lifecycle *agent);
void bx_agent_on_connected(bx_agent_lifecycle *agent);
void bx_agent_on_failure(bx_agent_lifecycle *agent);
void bx_agent_retry(bx_agent_lifecycle *agent);
void bx_agent_stop(bx_agent_lifecycle *agent);

#endif
