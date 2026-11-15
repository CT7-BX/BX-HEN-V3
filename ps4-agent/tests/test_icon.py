"""Unit tests for the deterministic PS4 icon: valid 24-bit RGB, no alpha."""
import pathlib
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools" / "make_icon.py"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

def validate_png(data):
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("Invalid PNG signature")
    pos = 8
    chunks = []
    image_stream = bytearray()
    while pos < len(data):
        if len(data) - pos < 12:
            raise ValueError("Incomplete PNG chunk")
        size, = struct.unpack_from(">I", data, pos)
        kind = data[pos + 4:pos + 8]
        payload = data[pos + 8:pos + 8 + size]
        crc, = struct.unpack_from(">I", data, pos + 8 + size)
        if zlib.crc32(kind + payload) & 0xFFFFFFFF != crc:
            raise ValueError("Invalid PNG CRC")
        chunks.append(kind)
        if kind == b"IDAT":
            image_stream.extend(payload)
        pos += 12 + size
        if kind == b"IEND":
            break
    if pos != len(data) or chunks[0] != b"IHDR" or chunks[-1] != b"IEND":
        raise ValueError("Malformed PNG chunks")
    width, height, depth, colour, compression, flt, interlace = struct.unpack(
        ">IIBBBBB", data[16:29]
    )
    if (width, height, depth, colour, compression, flt, interlace) != (512, 512, 8, 2, 0, 0, 0):
        raise ValueError("Expected 512x512 24-bit RGB PNG with no alpha")
    decompressed = zlib.decompress(bytes(image_stream))
    if len(decompressed) != 512 * (1 + 512 * 3):
        raise ValueError("Invalid uncompressed image size")
    if any(decompressed[scan * (1 + 512 * 3)] != 0 for scan in range(512)):
        raise ValueError("Unexpected image filter")
    return width, height, colour

class IconTest(unittest.TestCase):
    def test_rgb_icon_is_deterministic_and_valid(self):
        with tempfile.TemporaryDirectory() as tmp:
            first = pathlib.Path(tmp) / "icon0.png"
            second = pathlib.Path(tmp) / "another.png"
            for filename in (first, second):
                subprocess.run(
                    [sys.executable, str(SCRIPT), str(filename)],
                    check=True, capture_output=True, text=True
                )
            one = first.read_bytes()
            self.assertEqual(one, second.read_bytes())
            self.assertEqual(validate_png(one), (512, 512, 2))
            self.assertGreater(len(one), 1024)

if __name__ == "__main__":
    unittest.main()
