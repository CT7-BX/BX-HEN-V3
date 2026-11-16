#!/usr/bin/env python3
"""Check distinct PS4 pairing proof metadata and icon before packaging."""
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / "ps4-agent" / "tools"))
from verify_package import parse_sfo  # existing validated SFO parser

expected = {
    "TITLE_ID": "BRPM00001",
    "CONTENT_ID": "IV0000-BRPM00001_00-BXREMOTEPAIR0001",
    "APP_VER": "0.19",
    "VERSION": "0.19",
    "CATEGORY": "gd"
}

def verify(sfo_path, icon_path):
    sfo = parse_sfo(pathlib.Path(sfo_path).read_bytes())
    for key, value in expected.items():
        if sfo.get(key) != value:
            raise ValueError(f"{key}: expected {value!r}, got {sfo.get(key)!r}")
    if sfo.get("TITLE") != "BX Remote Play - Dashboard":
        raise ValueError("pairing proof must have a distinct diagnostic title")
    data = pathlib.Path(icon_path).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("bad icon PNG")
    import struct
    if len(data) < 33 or struct.unpack(">IIBBBBB", data[16:29]) != (512, 512, 8, 2, 0, 0, 0):
        raise ValueError("expected 512x512 RGB icon with no alpha")
    print("Native pairing proof PKG metadata verified.")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: verify_native_pkg.py param.sfo icon0.png")
    verify(sys.argv[1], sys.argv[2])
