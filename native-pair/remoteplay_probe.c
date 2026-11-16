/*
 * BX-REMOTE-PLAY: read-only PS4-native Remote Play TCP readiness probe.
 *
 * Open a SHORT loopback TCP connection to the built-in Remote Play service.
 * This is not media capture, Remote Play authentication or UDP tunnelling.
 * Works only while the resident ELF has sceNet initialized.
 * Results:
 *     1 = TCP connect succeeded on localhost port 9295
 *     0 = TCP connect failed (may be service disabled or loopback restricted)
 *    -1 = socket could not be allocated
 * Never opens a listener, never sends data, and never exposes PS4 ports.
 */
#include "remoteplay_probe.h"
#include <stdint.h>
#include <stddef.h>
#include <orbis/Net.h>

#define BX_RP_TCP_PORT 9295u

int bx_remoteplay_probe_loopback(void) {
    OrbisNetSockaddr addr = {0};
    OrbisNetId client;
    int result;

    addr.len = (uint8_t)sizeof(addr);
    addr.sa_family = ORBIS_NET_AF_INET;
    addr.sa_data[0] = (char)(BX_RP_TCP_PORT >> 8);
    addr.sa_data[1] = (char)(BX_RP_TCP_PORT & 0xff);
    /* Network-order IPv4 loopback 127.0.0.1; no router access. */
    addr.sa_data[2] = (char)127;
    addr.sa_data[3] = 0;
    addr.sa_data[4] = 0;
    addr.sa_data[5] = 1;

    client = sceNetSocket("bx_remoteplay_probe", ORBIS_NET_AF_INET,
                          ORBIS_NET_SOCK_STREAM, 0);
    if(client < 0) return -1;
    result = sceNetConnect(client, &addr, (OrbisNetSocklen_t)sizeof(addr));
    sceNetSocketClose(client);
    return result >= 0 ? 1 : 0;
}
