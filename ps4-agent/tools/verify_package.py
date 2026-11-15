#!/usr/bin/env python3
"""Validate PS4 PKG inputs before calling PkgTool.Core pkg_build.

This validates the native SFO key/value table and PNG header. It is not
a substitute for installing/launching the PKG on a physical console.
"""
import pathlib
import struct
import sys

EXPECTED_CONTENT_ID = "IV0000-BRPT00001_00-BXREMOTEPLAY0001"
EXPECTED_TITLE_ID = "BRPT00001"
EXPECTED_VERSION = "0.21"

def parse_sfo(data):
    if len(data) < 20 or data[:4] != b"\0PSF":
        raise ValueError("invalid SFO magic")
    version, keys_at, values_at, count = struct.unpack_from("<IIII", data, 4)
    if not (0 < count <= 128 and 20 + count * 16 <= len(data)):
        raise ValueError("invalid SFO entry count")
    if not (20 + count * 16 <= keys_at < values_at <= len(data)):
        raise ValueError("invalid SFO table offsets")
    entries = {}
    for i in range(count):
        k, kind, used, capacity, offset = struct.unpack_from("<HHIII", data, 20 + i * 16)
        begin = keys_at + k
        end = data.find(b"\0", begin, values_at)
        if begin >= values_at or end < begin:
            raise ValueError("invalid SFO entry key")
        if used > capacity or values_at + offset + used > len(data):
            raise ValueError("invalid SFO entry value")
        key = data[begin:end].decode("ascii")
        raw = data[values_at + offset:values_at + offset + used]
        if key in entries:
            raise ValueError("duplicate SFO entry: " + key)
        entries[key] = raw.rstrip(b"\0").decode("utf-8", errors="replace") if kind != 0x0404 else raw
    return entries

def validate(sfo_file, icon_file):
    sfo = parse_sfo(pathlib.Path(sfo_file).read_bytes())
    required = {
        "TITLE_ID": EXPECTED_TITLE_ID,
        "CONTENT_ID": EXPECTED_CONTENT_ID,
        "CATEGORY": "gd",
        "APP_VER": EXPECTED_VERSION,
        "VERSION": EXPECTED_VERSION,
    }
    for key, value in required.items():
        if sfo.get(key) != value:
            raise ValueError(f"{key}: expected {value!r}, got {sfo.get(key)!r}")
    if "Network Test" not in sfo.get("TITLE", ""):
        raise ValueError("title must disclose network-only diagnostic")
    icon = pathlib.Path(icon_file).read_bytes()
    if icon[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("icon0.png has invalid signature")
    if len(icon) < 33:
        raise ValueError("icon0.png too short")
    width, height, bits, colour, compression, flt, interlace = struct.unpack(
        ">IIBBBBB", icon[16:29]
    )
    if (width, height, bits, colour, compression, flt, interlace) != (512, 512, 8, 2, 0, 0, 0):
        raise ValueError("icon0.png must be 512x512 24-bit RGB without alpha")
    print("BX-REMOTE-PLAY v0.21: SFO content ID, title ID, title, version and icon validated")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: verify_package.py <param.sfo> <icon0.png>")
    try:
        validate(sys.argv[1], sys.argv[2])
    except (ValueError, OSError) as error:
        print("PKG preflight failed:", error, file=sys.stderr)
        raise SystemExit(1)
