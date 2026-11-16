"""Regression checks for the PS4 first-run path (OpenOrbis build happens in CI)."""
import pathlib
import re
import unittest

SOURCE = (pathlib.Path(__file__).resolve().parents[1] / "main.c").read_text()

class FirstRunFlowTests(unittest.TestCase):
    def test_missing_configuration_is_expected_not_crash(self):
        self.assertIn('report("missing_or_invalid_config", -1, 0);', SOURCE)
        self.assertIn('return 0; /* All expected test outcomes are logged, not process errors. */', SOURCE)
        self.assertNotRegex(SOURCE, r"\breturn\s+[123];\s*(?:/\*.*?\*/)?\s*\n")
        block = SOURCE[SOURCE.index("if (!read_config(&config)) {"):SOURCE.index("if (!open_http(&http)) {")]
        self.assertIn("CONFIG_RETRY_TICKS", block)
        self.assertIn("poll_decision(pad, &last_buttons)", block)
        self.assertIn("if (choice == -2) break;", block)
        self.assertIn("if (choice == 1)", block)
        self.assertIn("if (read_config(&config))", block)
        self.assertIn("if (!configured)", block)
        self.assertIn("scePadClose(pad);", block)
        self.assertIn("sceUserServiceTerminate();", block)
        self.assertRegex(block, r"if \(!configured\)\s*\{[\s\S]*?return 0;")

    def test_preserves_failure_reporting_without_exposing_secrets(self):
        self.assertIn('report("network_init_failed", -2, 0);', SOURCE)
        self.assertIn("memset(&config, 0, sizeof(config));", SOURCE)
        self.assertIn("return 0; /* Expected network failure:", SOURCE)
        self.assertIn("return 0; /* All expected test outcomes", SOURCE)
        self.assertIn("#define CONFIG_RETRY_TICKS 1200", SOURCE)
        self.assertNotIn('fprintf(f, "console_token=', SOURCE)

    def test_version_labels_incremented(self):
        self.assertIn("Pairing Proof v0.13", SOURCE)
        self.assertIn("native pairing test 0.13", SOURCE)
        self.assertIn("BX-REMOTE-PLAY-PS4-Pair/0.13", SOURCE)

if __name__ == "__main__":
    unittest.main()
