/* No upstream controller or klog integration is used. */
#include <stdint.h>
#include <time.h>
#include "c4f_conn.h"
#include "c4f_log.h"
uint64_t c4fTimeMs(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return (uint64_t)t.tv_sec*1000+(uint64_t)t.tv_nsec/1000000;}
void c4fLog(const char *format,...){(void)format;}
