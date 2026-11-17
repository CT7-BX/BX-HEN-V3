"""Native PS4 v0.25 connection stability contract.

Does not claim physical remote play. Portable C test validates actual policy.
"""
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
MAIN = (ROOT/"main.c").read_text()
UI = (ROOT/"native_ui.c").read_text()
DIAG = (ROOT/"native_diag.c").read_text()
MAKE = (ROOT/"Makefile").read_text()
WORKFLOW = (ROOT/"../.github/workflows/native-pair-build.yml").read_text()

class ConnectionV025(unittest.TestCase):
    def test_retries_only_safe_calls(self):
        self.assertIn('#include "pair_retry.h"', MAIN)
        self.assertIn("wait_retry_or_cancel(", MAIN)
        self.assertGreaterEqual(MAIN.count("bx_pair_should_retry("), 3)
        self.assertIn("bx_pair_retry_delay_ms(failures)", MAIN)
        self.assertIn("final = \"cancelled\"; goto finish;", MAIN)
        self.assertEqual(MAIN.count('"/v1/pair/start"'), 1)
        self.assertEqual(MAIN.count('"/v1/pair/decide"'), 1)
        self.assertIn("POLL_ROUNDS", MAIN)
        self.assertIn("RECUPERANDO HTTPS", MAIN)
    def test_ui_truthful_and_accessible(self):
        self.assertIn('"VERSION 0.25   BETA"', UI)
        self.assertIn('"ESTABILIDADE HTTPS"', UI)
        self.assertIn('"STREAMING DIRETO AINDA INDISPONIVEL"', UI)
        self.assertIn("RECUPERACAO OU AVISO", UI)
        self.assertIn('"RECUPERANDO HTTPS"', DIAG)
        self.assertIn("BX_DIAG_WARNING", DIAG)
    def test_build_and_release(self):
        self.assertIn("VERSION := 0.25", MAKE)
        self.assertIn("$(OUT)/pair_retry.o", MAKE)
        self.assertIn("native-pair/pair_retry.c native-pair/tests/pair_retry_test.c",WORKFLOW)
        self.assertIn("pair-test-v0.25", WORKFLOW)

if __name__=="__main__":
    unittest.main()
