"""PS4 native v0.25: truthful diagnostics, user actions, stability safeguards."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
UI = (ROOT / "native_ui.c").read_text()
DIAG = (ROOT / "native_diag.c").read_text()
MAIN = (ROOT / "main.c").read_text()
MAKE = (ROOT / "Makefile").read_text()
RESIDENT = (ROOT / "resident_service.c").read_text()
INSTALL = (ROOT / "resident_install.c").read_text()

class NativeV023Tests(unittest.TestCase):
    def test_truthful_native_stage_progress_and_recovery(self):
        self.assertIn('#include "native_diag.h"', UI)
        self.assertIn("bx_diag_label(stage)", UI)
        self.assertIn("bx_diag_hint(stage,0)", UI)
        self.assertIn("bx_diag_progress(stage)", UI)
        self.assertIn("bx_diag_level(stage,0)", UI)
        self.assertIn("ui.progress >= (unsigned)(i+1)", UI)
        self.assertIn('"VERSION 0.25   BETA"', UI)
        self.assertIn('"CODIGO TEMPORARIO"', UI)
        self.assertIn("STREAMING DIRETO AINDA INDISPONIVEL", UI)
        for stage in ("config_missing", "network_init_failed",
                      "ota_download_failed", "heartbeat_failed",
                      "approved_pairing_only", "cancelled"):
            self.assertIn('"'+stage+'"', DIAG)
        for code in (401,403,404,429):
            self.assertIn('http_status == '+str(code), DIAG)
        self.assertIn("HTTPS ATIVO SEM VIDEO OU CONTROLES", DIAG)
        self.assertNotIn("console_token", DIAG)

    def test_live_dashboard_reduces_flip_pressure_and_validates_code(self):
        self.assertIn('if(strcmp(ui.status,next)==0)return;', UI)
        self.assertIn('if(strcmp(ui.code,next)==0)return;', UI)
        self.assertIn("code[i]<'0'||code[i]>'9'", UI)
        self.assertIn("if(!ui.ready)return;", UI)
        self.assertIn("sceVideoOutSubmitFlip(", UI)
        self.assertNotIn("getDisplayMedia(", UI)

    def test_native_reporting_contains_only_guidance_not_tokens(self):
        self.assertIn('fprintf(f, "recovery=%s\\n", bx_diag_hint(stage, status));', MAIN)
        self.assertIn("bx_diag_hint(stage,status)", MAIN)
        self.assertNotIn('fprintf(f,"console_token=', MAIN)
        self.assertIn('"/user/data/bx-remote-pair.cfg"', MAIN)
        self.assertIn("idle_until_ps4_close();", MAIN)

    def test_compile_and_elf_version_alignment(self):
        self.assertIn("VERSION := 0.24", MAKE)
        self.assertIn("$(OUT)/native_diag.o", MAKE)
        self.assertIn("native_diag.h", MAKE)
        self.assertIn("CURRENT_UPDATE_MINOR 25u", MAIN)
        self.assertIn('RESIDENT_VERSION "0.24\\n"', INSTALL)
        self.assertIn('"BX-REMOTE-SERVICE/0.24"', RESIDENT)
        self.assertNotIn("sceNetBind(", RESIDENT)
        self.assertNotIn("sceRemoteplay", RESIDENT)

if __name__=="__main__":
    unittest.main()
