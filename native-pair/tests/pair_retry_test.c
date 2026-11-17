#include "../pair_retry.h"
#include <assert.h>
#include <stdio.h>
int main(void) {
    assert(!bx_pair_retryable(1,200));
    assert(bx_pair_retryable(-14,429));
    assert(bx_pair_retryable(-14,503));
    assert(bx_pair_retryable(-14,408));
    assert(bx_pair_retryable(-2,0));
    assert(!bx_pair_retryable(-14,401));
    assert(!bx_pair_retryable(-14,403));
    assert(!bx_pair_retryable(-14,404));
    assert(!bx_pair_retryable(-15,0)); /* response too large */
    assert(!bx_pair_retryable(-10,0)); /* malformed URL */
    assert(!bx_pair_retryable(-16,0)); /* malformed response */
    assert(bx_pair_retry_delay_ms(1)==350u);
    assert(bx_pair_retry_delay_ms(2)==700u);
    assert(bx_pair_retry_delay_ms(8)==1200u);
    assert(bx_pair_should_retry(-14,503,3,3));
    assert(!bx_pair_should_retry(-14,503,4,3));
    assert(!bx_pair_should_retry(-14,401,1,3));
    puts("BX PS4 bounded HTTPS retry policy passed");
    return 0;
}
