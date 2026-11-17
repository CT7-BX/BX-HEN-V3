"""Offline trust-anchor integrity checks; these do not emulate PS4 TLS."""
import hashlib
import json
from pathlib import Path
import re
import ssl
import unittest

class TrustAnchorTests(unittest.TestCase):
    def test_embedded_roots_match_official_der_fingerprints(self):
        source = (Path(__file__).resolve().parents[1] / 'tls_roots.h').read_text()
        expected = ['96bcec06264976f37460779acf28c5a7cfe8a3c0aae11a8ffcee05c0bddf08c6',
                    '69729b8e15a86efc177a57afb7171dfc64add28c2fca8cf1507e34453ccb1470']
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        for i, fingerprint in enumerate(expected):
            match = re.search(r'static char bx_tls_root_' + str(i) + r'\[\] =\n(.*?);', source, re.S)
            self.assertIsNotNone(match)
            pem = ''.join(json.loads(line) for line in match[1].splitlines() if line)
            der = ssl.PEM_cert_to_DER_cert(pem)
            self.assertEqual(hashlib.sha256(der).hexdigest(), fingerprint)
            context.load_verify_locations(cadata=pem)
        self.assertEqual(context.cert_store_stats()['x509_ca'], 2)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
