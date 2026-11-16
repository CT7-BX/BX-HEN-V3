"""Guard the real PS4 graphical dashboard against regressions.
The CI build checks OpenOrbis linker and SDK symbols separately.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
UI = (ROOT / "native_ui.c").read_text()
HEADER = (ROOT / "native_ui.h").read_text()
MAIN = (ROOT / "main.c").read_text()
MAKE = (ROOT / "Makefile").read_text()

class NativeDashboardTests(unittest.TestCase):
    def test_video_out_and_direct_memory_are_real_native_apis(self):
        for function in (
            "sceVideoOutOpen(", "sceVideoOutSetBufferAttribute(",
            "sceVideoOutRegisterBuffers(", "sceVideoOutSubmitFlip(",
            "sceVideoOutGetFlipStatus(", "sceKernelAllocateDirectMemory(",
            "sceKernelMapDirectMemory(",
        ):
            self.assertIn(function, UI)
        self.assertIn("UI_BUFFERS 2", UI)
        self.assertIn("UI_W 1920", UI)
        self.assertIn("UI_H 1080", UI)
        self.assertIn("bx_ui_shutdown();", UI)

    def test_native_dashboard_does_not_imitate_video_or_media_transport(self):
        self.assertIn("SEM STREAMING DE VIDEO OU AUDIO", UI)
        self.assertIn("CODIGO DE PAREAMENTO", UI)
        self.assertIn('"01 VINCULO"', UI)
        self.assertIn('"02 SERVICO"', UI)
        self.assertIn('"03 ATUALIZAR"', UI)
        self.assertIn('"04 DIAGNOSTICO"', UI)
        self.assertNotIn("RTCPeerConnection", UI)
        self.assertNotIn("sceRemoteplay", UI)
        self.assertNotIn("console_token", UI)
        self.assertNotIn("payloads.ini", UI)

    def test_pairing_routes_to_real_screen_and_has_fallback(self):
        self.assertIn('#include "native_ui.h"', MAIN)
        self.assertIn("(void)bx_ui_init();", MAIN)
        self.assertIn("if (bx_ui_enabled()) bx_ui_status(message);", MAIN)
        self.assertIn("sceSysUtilSendSystemNotificationWithText(222, message);", MAIN)
        self.assertIn("bx_ui_code(code);", MAIN)
        self.assertIn('bx_ui_stage("AUTORIZACAO NO PS4");', MAIN)
        self.assertIn('bx_ui_stage(accepted ? "VINCULO APROVADO"', MAIN)
        self.assertIn('bx_ui_stage("TESTE ENCERRADO");', MAIN)

    def test_build_links_dashboard_and_keeps_resident_payload(self):
        self.assertIn("VERSION := 0.19", MAKE)
        self.assertIn("-lSceVideoOut", MAKE)
        self.assertIn("$(OUT)/native_ui.o", MAKE)
        self.assertIn("$(OUT)/bx_remote_service.elf", MAKE)
        self.assertIn("bx-remote-service.elf", MAKE)
        self.assertIn("native_ui.h", MAKE)
        self.assertIn("void bx_ui_shutdown(void);", HEADER)

if __name__ == "__main__":
    unittest.main()
