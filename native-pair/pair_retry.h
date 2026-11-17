#ifndef BX_PAIR_RETRY_H
#define BX_PAIR_RETRY_H
/* Only retry idempotent health/pending calls. Never automatically resend
 * a pairing start, a user approval or a package installation request.
 */
int bx_pair_retryable(int result, int http_status);
unsigned bx_pair_retry_delay_ms(unsigned failures);
int bx_pair_should_retry(int result, int http_status, unsigned failures, unsigned max_failures);
#endif
