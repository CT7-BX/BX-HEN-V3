"""Guard BX v0.21 approved one-shot command channel.
A successful build only proves the transport prototype compiles: NO video or
audio and NO real gameplay controls are implemented by this version.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
RESIDENT = (ROOT / "resident_service.c").read_text()
MANAGER = (ROOT / "main.c").read_text()
INSTALL = (ROOT / "resident_install.c").read_text()
MAKE = (ROOT / "Makefile").read_text()


class NativeCommandBridgeChecks(unittest.TestCase):
    def test_bounded_auth_status_parser_and_single_allowlisted_command(self):
        self.assertIn('#include "pair_protocol.h"', RESIDENT)
        self.assertIn('sceHttpReadData(request,response+received,', RESIDENT)
        self.assertIn('bx_pair_field(response,"bridgeProbeId",candidate,sizeof(candidate))', RESIDENT)
        self.assertIn('strlen(candidate)!=64', RESIDENT)
        self.assertIn('post_bridge_result(&http,&config,bridge_probe_id,fresh)', RESIDENT)
        self.assertIn('bx_remoteplay_probe_loopback();', RESIDENT)
        self.assertIn('"/v1/bridge/probe-result"', RESIDENT)
        self.assertIn('"%s/v1/bridge/probe-result"', RESIDENT)
        self.assertIn('memset(auth,0,sizeof(auth))', RESIDENT)
        self.assertIn('memset(bridge_probe_id,0,sizeof(bridge_probe_id))', RESIDENT)
        for forbidden in ('sceNetBind(', 'sceNetListen(', 'sceNetSend(',
                          'sceVideoOutGetFlipStatus(', 'payloads.ini',
                          'udpRelay', 'getDisplayMedia'):
            self.assertNotIn(forbidden, RESIDENT)

    def test_user_opt_in_elf_version_and_original_dashboard_preserved(self):
        self.assertIn('VERSION := 0.21', MAKE)
        self.assertIn('#define CURRENT_UPDATE_MINOR 21u', MANAGER)
        self.assertIn('RESIDENT_VERSION "0.21\\n"', INSTALL)
        self.assertIn('memcmp(version,"0.21\\n",5)', MANAGER)
        self.assertIn('ORBIS_PAD_BUTTON_TRIANGLE', MANAGER)
        self.assertIn('$(OUT)/remoteplay_probe.o', MAKE)
        self.assertIn('$(OUT)/resident_service.o', MAKE)
        self.assertIn('$(OUT)/native_ui.o', MAKE)


if __name__ == "__main__":
    unittest.main()
