package com.ct7bx.gateway;

import java.io.IOException;
import java.net.SocketTimeoutException;
import javax.net.ssl.SSLException;

/** Pure Java policy for on-demand, bounded public HTTPS checks.
 * Never retries authentication failures, TLS errors or application writes.
 */
public final class NetworkResilience {
    public static final int MAX_ATTEMPTS = 3;
    private NetworkResilience() {}
    public static boolean temporaryHttp(int status) {
        return status == 408 || status == 429 || (status >= 500 && status < 600);
    }
    public static boolean temporaryFailure(Exception failure) {
        return failure instanceof IOException &&
            !(failure instanceof SSLException);
    }
    public static boolean canRetry(int attempt, int status, Exception failure) {
        if (attempt >= MAX_ATTEMPTS || attempt < 1) return false;
        return failure != null ? temporaryFailure(failure) : temporaryHttp(status);
    }
    public static int delayMs(int attempt) {
        return attempt <= 1 ? 350 : attempt == 2 ? 700 : 1100;
    }
}
