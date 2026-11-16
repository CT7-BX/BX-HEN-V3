"""Safety and packaging checks for the independent PS4 resident heartbeat prototype."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SERVICE = (ROOT / "resident_service.c").read_text()
INSTALLER = (ROOT / "resident_install.c").read_text()
MAIN = (ROOT / "main.c").read_text()
MAKE = (ROOT / "Makefile").read_text()

class ResidentPrototypeTests(unittest.TestCase):
    def test_service_requires_local_enable_and_private_config(self):
        self.assertIn('"/data/bx-remote-service.enabled"', SERVICE)
        self.assertIn('"/data/bx-remote-service.stop"', SERVICE)
        self.assertIn('"/user/data/bx-remote-pair.cfg"', SERVICE)
        self.assertIn("if (!enabled())", SERVICE)
        self.assertIn("if (!config_read(&config))", SERVICE)
        self.assertIn("while(enabled() && agent.enabled)", SERVICE)

    def test_service_https_only_and_no_remote_game_control(self):
        self.assertIn('"%s/v1/pair/heartbeat"', SERVICE)
        self.assertIn('sceHttpAddRequestHeader(request,"Authorization",auth,0)', SERVICE)
        self.assertIn('memset(auth,0,sizeof(auth))', SERVICE)
        self.assertNotIn("scePadVirtualDevice", SERVICE)
        self.assertNotIn("sceRemoteplay", SERVICE)
        self.assertNotIn("sceNetBind", SERVICE)
        self.assertNotIn("sceNetListen", SERVICE)
        self.assertNotIn("AutoRun", SERVICE)
        self.assertNotIn("payloads.ini", SERVICE)
        self.assertNotIn("console_token=", SERVICE)

    def test_manager_is_opt_in_and_does_not_launch_service(self):
        self.assertIn('SOURCE "/app0/bx-remote-service.elf"', INSTALLER)
        self.assertIn('TARGET "/data/payloads/bx-remote-service.elf"', INSTALLER)
        self.assertIn("memcmp(magic,", INSTALLER)
        self.assertIn("if(total+n>LIMIT)", INSTALLER)
        self.assertIn("rename(TEMP,TARGET)", INSTALLER)
        self.assertNotIn("payloads.ini", INSTALLER)
        self.assertNotIn("sceKernelLoadStartModule", INSTALLER)
        self.assertIn("ORBIS_PAD_BUTTON_TRIANGLE", MAIN)
        self.assertIn("if (fresh & ORBIS_PAD_BUTTON_TRIANGLE)", MAIN)
        self.assertIn("bx_resident_prepare();", MAIN)

    def test_pkg_includes_independent_elf(self):
        self.assertIn("VERSION := 0.21", MAKE)
        self.assertIn("RESIDENT_OBJECTS", MAKE)
        self.assertIn("$(OUT)/bx_remote_service.elf", MAKE)
        self.assertIn("pkg: eboot.bin bx-remote-service.elf", MAKE)

if __name__ == "__main__":
    unittest.main()
