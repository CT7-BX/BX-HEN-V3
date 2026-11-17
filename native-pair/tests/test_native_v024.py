"""Native PS4 v0.25: long-lived HTTPS recovery and modern VideoOut contract.

Static checks complement OpenOrbis compile and validation; they cannot replace
physical tests of wireless dropouts, UI display, or running games.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
RESIDENT = (ROOT / "resident_service.c").read_text()
MAIN = (ROOT / "main.c").read_text()
UI = (ROOT / "native_ui.c").read_text()
MAKE = (ROOT / "Makefile").read_text()
WORKFLOW = (ROOT / "../.github/workflows/native-pair-build.yml").read_text()

class NativeV024Tests(unittest.TestCase):
    def test_resident_reconnects_after_network_initialization_and_heartbeat_failures(self):
        self.assertIn("while(enabled() && agent.enabled)", RESIDENT)
        self.assertIn('log_status("network_init_retry",-2,0)', RESIDENT)
        self.assertIn('log_status("https_reconnected",0,0)', RESIDENT)
        self.assertIn("if(http.tmpl<0)", RESIDENT)
        self.assertIn("http_close(&http);", RESIDENT)
        self.assertIn("bx_agent_on_failure(&agent);", RESIDENT)
        self.assertIn("pause_checked(agent.retry_ms/1000)", RESIDENT)
        self.assertIn("bx_agent_retry(&agent);", RESIDENT)
        self.assertIn("if(n<0){result=n;goto done;}", RESIDENT)
        self.assertIn("received >= (int)sizeof(response)-1", RESIDENT)
        self.assertGreaterEqual(RESIDENT.count("sceHttpSetRecvTimeOut(request,5000000);"), 2)
        self.assertIn("memset(bridge_probe_id,0,sizeof(bridge_probe_id));", RESIDENT)
        self.assertIn("if(phase && strcmp(previous_phase,phase)==0", RESIDENT)
        self.assertNotIn("sceNetListen(", RESIDENT)
        self.assertNotIn("sceNetBind(", RESIDENT)
        self.assertNotIn("sceRemoteplay", RESIDENT)

    def test_pairing_retries_only_allowlisted_poll_requests(self):
        self.assertIn("MAX_POLL_NETWORK_RETRIES 2", MAIN)
        self.assertIn("poll_network_failures = 0", MAIN)
        self.assertIn("bx_pair_should_retry(result, status,", MAIN)
        self.assertIn('"/v1/pair/heartbeat"', MAIN)
        self.assertIn('"/v1/pair/pending"', MAIN)
        self.assertIn("--round;", MAIN)
        self.assertGreaterEqual(MAIN.count("sceHttpSetRecvTimeOut("), 2)
        self.assertEqual(MAIN.count('"/v1/pair/start"'), 1)
        self.assertIn("bx_pair_decision_json(", MAIN)

    def test_native_panel_is_independent_modern_videoout_and_truthful(self):
        for marker in ["background_gradient(", "rounded(", "stroke_card(",
                       "CODE", "CONFIG", "REDE", "VINCULO",
                       "PROXIMO PASSO", "STREAMING DIRETO AINDA INDISPONIVEL"]:
            if marker=="CODE":
                self.assertIn('"CODIGO TEMPORARIO"', UI)
            else:
                self.assertIn(marker,UI)
        self.assertIn('"VERSION 0.25   BETA"', UI)
        self.assertIn("sceVideoOutSubmitFlip", UI)
        self.assertIn("if(strcmp(ui.status,next)==0)return;", UI)
        self.assertNotIn("getDisplayMedia", UI)
        self.assertNotIn("console_token", UI)

    def test_version_alignment_and_release_integrity(self):
        self.assertIn("VERSION := 0.25", MAKE)
        self.assertIn("CURRENT_UPDATE_MINOR 25u", MAIN)
        self.assertIn('RESIDENT_VERSION "0.25\\n"', (ROOT / "resident_install.c").read_text())
        self.assertIn("pair-test-v0.25",WORKFLOW)
        self.assertIn("sha256sum -c -",WORKFLOW)

if __name__=="__main__":
    unittest.main()
