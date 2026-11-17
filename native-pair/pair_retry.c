#include "pair_retry.h"

int bx_pair_retryable(int result, int http_status) {
    if (result == 1) return 0;
    if (http_status == 401 || http_status == 403 || http_status == 404)
        return 0;
    /* Only transport/timeout failures and rate limiting/temporary server
       overload: never retry invalid content or rejected authorization. */
    if (http_status == 408 || http_status == 429 ||
        (http_status >= 500 && http_status <= 599)) return 1;
    return http_status == 0 && result < 0 && result != -10 &&
        result != -11 && result != -12 && result != -15 &&
        result != -16 && result != -17 && result != -18;
}
unsigned bx_pair_retry_delay_ms(unsigned failures) {
    if (failures <= 1u) return 350u;
    if (failures == 2u) return 700u;
    return 1200u;
}
int bx_pair_should_retry(int result, int http_status,
                         unsigned failures, unsigned max_failures) {
    return failures > 0 && failures <= max_failures &&
        bx_pair_retryable(result,http_status);
}
