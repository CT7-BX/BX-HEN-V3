import com.ct7bx.gateway.NetworkResilience;
import java.io.IOException;
import java.net.SocketTimeoutException;
import javax.net.ssl.SSLHandshakeException;

public final class NetworkResilienceTest {
    private static void require(boolean value) {
        if (!value) throw new AssertionError("Unexpected retry policy");
    }
    public static void main(String[] args) {
        require(NetworkResilience.MAX_ATTEMPTS == 3);
        require(NetworkResilience.temporaryHttp(429));
        require(NetworkResilience.temporaryHttp(503));
        require(NetworkResilience.temporaryHttp(408));
        require(!NetworkResilience.temporaryHttp(401));
        require(!NetworkResilience.temporaryHttp(403));
        require(!NetworkResilience.temporaryHttp(404));
        require(!NetworkResilience.temporaryHttp(200));
        require(NetworkResilience.canRetry(1,503,null));
        require(!NetworkResilience.canRetry(3,503,null));
        require(NetworkResilience.canRetry(2,0,new SocketTimeoutException()));
        require(NetworkResilience.canRetry(1,0,new IOException()));
        require(!NetworkResilience.canRetry(1,0,new SSLHandshakeException("tls")));
        require(!NetworkResilience.canRetry(2,401,null));
        require(NetworkResilience.delayMs(1) == 350);
        require(NetworkResilience.delayMs(2) == 700);
        require(NetworkResilience.delayMs(3) == 1100);
        System.out.println("BX Android public HTTPS retry policy passed");
    }
}
