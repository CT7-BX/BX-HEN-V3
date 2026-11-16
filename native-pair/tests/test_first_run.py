"""Regression checks for the PS4 first-run path (OpenOrbis build happens in CI)."""
import pathlib
import re
import unittest

SOURCE = (pathlib.Path(__file__).resolve().parents[1] / "main.c").read_text()

class FirstRunFlowTests(unittest.TestCase):
    def test_missing_configuration_is_expected_not_crash(self):
        self.assertIn('report(config_state == 0 ? "config_missing" : "config_invalid", -1, 0);', SOURCE)
        self.assertIn('idle_until_ps4_close(); /* Never return through OpenOrbis libc _exit. */', SOURCE)
        main = SOURCE[SOURCE.index("int main(void) {"):]
        self.assertNotRegex(main, r"\breturn\s+[123];")
        block = SOURCE[SOURCE.index("int config_state = read_config(&config);"):SOURCE.index("if (!open_http(&http)) {")]
        self.assertIn("CONFIG_RETRY_TICKS", block)
        self.assertIn("poll_decision(pad, &last_buttons)", block)
        self.assertIn("if (choice == -2) break;", block)
        self.assertIn("if (choice == 1 ||", block)
        self.assertIn("if (config_state == 1)", block)
        self.assertIn("if (!configured)", block)
        self.assertIn("scePadClose(pad);", block)
        self.assertIn("sceUserServiceTerminate();", block)
        self.assertRegex(block, r"if \(!configured\)\s*\{[\s\S]*?idle_until_ps4_close\(\);")

    def test_preserves_failure_reporting_without_exposing_secrets(self):
        self.assertIn('report("network_init_failed", -2, 0);', SOURCE)
        self.assertIn("memset(&config, 0, sizeof(config));", SOURCE)
        self.assertIn("idle_until_ps4_close(); /* Do not return through OpenOrbis libc _exit.", SOURCE)
        self.assertIn("idle_until_ps4_close(); /* Never return through OpenOrbis libc _exit.", SOURCE)
        self.assertIn("#define CONFIG_RETRY_TICKS 1200", SOURCE)
        self.assertNotIn('fprintf(f, "console_token=', SOURCE)

    def test_update_check_uses_public_http_without_console_secret(self):
        updater = SOURCE[SOURCE.index("static int check_public_update("):
                         SOURCE.index("static int read_config(")]
        self.assertIn("UPDATE_MANIFEST_URL", updater)
        self.assertIn("bx_update_parse(body, &update)", updater)
        self.assertIn("bx_update_is_newer(&update,", updater)
        self.assertNotIn("Authorization", updater.split("*/", 1)[-1])
        self.assertNotIn("console_token", updater.split("*/", 1)[-1])
        self.assertNotIn("sceAppInstUtil", updater)
        self.assertNotIn("pkg_install", updater)
        self.assertIn("has_update = check_public_update(&http, &available_update);", SOURCE)

    def test_approved_pairing_waits_for_explicit_exit_and_logs_teardown(self):
        success = SOURCE[SOURCE.index("finish:"):]
        self.assertIn('report("approved_waiting_exit", 0, status);', success)
        self.assertIn("APPROVED_HOLD_TICKS", success)
        self.assertRegex(success, r'if \(poll_decision\(pad, &last_buttons\) == -2\) break;')
        self.assertNotIn("sleep(APPROVED_NOTICE_SECONDS)", success)
        for checkpoint in ("cleanup_revoke_begin", "cleanup_revoke_done",
                           "cleanup_pad_begin", "cleanup_pad_done",
                           "cleanup_http_begin", "cleanup_http_done",
                           "cleanup_user_service_begin", "cleanup_complete"):
            self.assertIn('report("' + checkpoint + '"', success)
        shutdown = SOURCE[SOURCE.index("static void close_http("):
                          SOURCE.index("static int open_http(")]
        for step in ("cleanup_http_template", "cleanup_http_library",
                     "cleanup_http_ssl", "cleanup_http_pool", "cleanup_http_net"):
            self.assertIn('report("' + step + '"', shutdown)
        self.assertLess(success.index("close_http(&http);"),
                        success.index("sceUserServiceTerminate();"))

    def test_native_exit_does_not_return_through_libc(self):
        main = SOURCE[SOURCE.index("int main(void) {"):]
        self.assertNotRegex(main, r"\breturn\s+0\s*;")
        self.assertEqual(main.count("idle_until_ps4_close();"), 3)
        idle = SOURCE[SOURCE.index("static void idle_until_ps4_close(void) {"):
                      SOURCE.index("static void close_http(")]
        self.assertIn('report("idle_ready_for_ps4_close", 0, 0);', idle)
        self.assertIn("for (;;) sleep(1);", idle)
        self.assertIn("__attribute__((noreturn))", SOURCE)
        self.assertIn("bx_ota_fetch_verified", SOURCE)
        self.assertIn("bx_ota_install_with_consent", SOURCE)\n        self.assertIn("offer_resident_setup(pad, &last_buttons);", SOURCE)\n        self.assertIn("bx_resident_prepare()", SOURCE)\n        self.assertIn("ORBIS_PAD_BUTTON_TRIANGLE", SOURCE)

    def test_version_labels_incremented(self):
        self.assertIn("Pairing Proof v0.18", SOURCE)
        self.assertIn("native pairing test 0.18", SOURCE)
        self.assertIn("BX-REMOTE-PLAY-PS4-Pair/0.18", SOURCE)

if __name__ == "__main__":
    unittest.main()
