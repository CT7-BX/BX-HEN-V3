"""Source and packaging checks for PS4-native, Mac-free Remote Play diagnostics.

This is not a video/streaming test and must never be represented as one.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PROBE = (ROOT / "remoteplay_probe.c").read_text()
RESIDENT = (ROOT / "resident_service.c").read_text()
MAKE = (ROOT / "Makefile").read_text()
MAIN = (ROOT / "main.c").read_text()


class RemotePlayDiagnosticsTests(unittest.TestCase):
    def test_probe_is_local_only_and_closes_socket(self):
        for value in ["sceNetSocket(", "sceNetConnect(", "sceNetSocketClose(",
                      "ORBIS_NET_AF_INET", "ORBIS_NET_SOCK_STREAM",
                      "BX_RP_TCP_PORT 9295u", "addr.sa_data[2] = (char)127"]:
            self.assertIn(value, PROBE)
        for forbidden in ["sceNetListen(", "sceNetBind(", "sceNetSend(",
                          "sceNetRecv(", "sceNetSendto(", "sceNetRecvfrom(",
                          "http://", "https://"]:
            self.assertNotIn(forbidden, PROBE)

    def test_resident_never_claims_media_capture(self):
        self.assertIn('#include "remoteplay_probe.h"', RESIDENT)
        self.assertIn("bx_remoteplay_probe_loopback();", RESIDENT)
        self.assertIn('remotePlayTcp9295', RESIDENT)
        self.assertIn("sceHttpSendRequest(request,body,(size_t)body_len)", RESIDENT)
        self.assertIn('remoteplay_tcp_open', RESIDENT)
        self.assertIn('remoteplay_tcp_unreachable', RESIDENT)
        self.assertIn('remoteplay_probe_failed', RESIDENT)
        self.assertIn('memset(auth,0,sizeof(auth))', RESIDENT)
        self.assertNotIn('192.168.', RESIDENT)
        self.assertNotIn('sceVideoOutGetFlipStatus', RESIDENT)
        self.assertNotIn('sceRemoteplay', RESIDENT)
        self.assertNotIn('payloads.ini', RESIDENT)

    def test_service_linked_and_usable_with_pkg_closed(self):
        self.assertIn('$(OUT)/remoteplay_probe.o', MAKE)
        self.assertIn('remoteplay_probe.h', MAKE)
        self.assertIn("VERSION := 0.24", MAKE)
        self.assertIn("CURRENT_UPDATE_MINOR 24u", MAIN)
        self.assertIn("$(OUT)/bx_remote_service.elf", MAKE)
        self.assertIn("bx-remote-service.elf", MAKE)


if __name__ == "__main__":
    unittest.main()
