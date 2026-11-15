#!/usr/bin/env python3
"""Generate a deterministic 512x512 RGB PNG icon for PS4 diagnostic builds.

Uses Python standard library; no externally sourced images or private SDK files.
OpenOrbis requires PNG truecolour RGB (colour type 2), no alpha.
"""
import pathlib
import struct
import sys
import zlib

SIZE = 512
RGB = bytearray(SIZE * SIZE * 3)

def pixel(x, y, r, g, b):
    if 0 <= x < SIZE and 0 <= y < SIZE:
        offset = (y * SIZE + x) * 3
        RGB[offset:offset + 3] = bytes((r, g, b))

for y in range(SIZE):
    for x in range(SIZE):
        # Black-and-red matte gradient; no transparency.
        glow = max(0, 80 - abs(x - 270) // 3 - abs(y - 168) // 4)
        pixel(x, y, 13 + glow // 2, 10 + glow // 12, 17 + glow // 10)

def rounded_rect(x0, y0, x1, y1, radius, colour):
    r2 = radius * radius
    for y in range(y0, y1):
        for x in range(x0, x1):
            cx = min(max(x, x0 + radius), x1 - radius - 1)
            cy = min(max(y, y0 + radius), y1 - radius - 1)
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                pixel(x, y, *colour)

def circle(cx, cy, r, colour):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                pixel(x, y, *colour)

# Stylised custom controller silhouette.
rounded_rect(49, 149, 464, 350, 61, (229, 48, 81))
rounded_rect(59, 159, 454, 340, 53, (28, 24, 34))
rounded_rect(78, 202, 193, 272, 19, (45, 34, 48))
rounded_rect(121, 194, 147, 281, 8, (244, 207, 216))
rounded_rect(91, 225, 177, 251, 8, (244, 207, 216))
circle(342, 210, 19, (233, 66, 94))
circle(386, 253, 19, (244, 174, 188))
circle(298, 253, 15, (244, 174, 188))
circle(342, 296, 15, (233, 66, 94))
rounded_rect(227, 189, 282, 234, 14, (79, 47, 63))
rounded_rect(236, 201, 273, 224, 8, (129, 86, 106))

GLYPHS = {
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    " ": ["00000"] * 7,
}

def print_text(text, y, scale, colour):
    width = (len(text) * 6 - 1) * scale
    x0 = (SIZE - width) // 2
    for pos, glyph in enumerate(text):
        for yy, line in enumerate(GLYPHS[glyph]):
            for xx, bit in enumerate(line):
                if bit == "1":
                    for dy in range(scale):
                        for dx in range(scale):
                            pixel(x0 + (pos * 6 + xx) * scale + dx,
                                  y + yy * scale + dy, *colour)

print_text("BX-REMOTE", 379, 5, (246, 235, 240))

def chunk(kind, data):
    payload = kind + data
    return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)

def encode_png():
    raw = b"".join(b"\0" + RGB[y * SIZE * 3:(y + 1) * SIZE * 3] for y in range(SIZE))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )

def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 make_icon.py /path/to/icon0.png")
    output = pathlib.Path(sys.argv[1])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encode_png())
    print("PS4 RGB icon:", output, "(" + str(output.stat().st_size) + " bytes)")

if __name__ == "__main__":
    main()
