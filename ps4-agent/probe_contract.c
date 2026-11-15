#include "probe_contract.h"

#include <string.h>

int bx_remote_probe_matches(const char *bytes, size_t length)
{
    const char expected[] = BX_REMOTE_PROBE_MARKER;
    const size_t expected_length = sizeof(expected) - 1;
    return bytes != NULL
        && length == expected_length
        && memcmp(bytes, expected, expected_length) == 0;
}
