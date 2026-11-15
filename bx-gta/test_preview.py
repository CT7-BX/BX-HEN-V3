#!/usr/bin/env python3
"""Static release checks for the self-contained BX-GTA HTML menu preview.

Compares the embedded menu data with the authoritative JSON and checks
JavaScript syntax. Does not claim to be a browser or PS4 runtime test.
"""
import json
import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "preview-v2.html"
TAXONOMY = ROOT / "menu_taxonomy_v2.json"

class ScriptReader(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = None
        self.blocks = []
        self.external = []
        self.styles = []
        self.in_style = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "script":
            if attributes.get("src"):
                self.external.append(attributes["src"])
            self.active = [attributes, ""]
        elif tag == "style":
            self.in_style = True

    def handle_data(self, data):
        if self.active is not None:
            self.active[1] += data
        if self.in_style:
            self.styles.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.active is not None:
            self.blocks.append(self.active)
            self.active = None
        elif tag == "style":
            self.in_style = False


def main():
    html = HTML.read_text(encoding="utf-8")
    data = json.loads(TAXONOMY.read_text(encoding="utf-8"))
    parser = ScriptReader()
    parser.feed(html)

    assert not parser.external, "Preview must work without external script CDNs"
    assert len(parser.blocks) >= 2, "Missing JSON/menu JavaScript blocks"
    fragments = [script for attrs, script in parser.blocks if attrs.get("id") == "menu-data"]
    assert len(fragments) == 1, "Expected exactly one embedded menu registry"
    embedded = json.loads(fragments[0])
    assert embedded == data, "Embedded options and source taxonomy must be identical"

    sections = embedded["sections"]
    groups = [g for s in sections for g in s["groups"]]
    options = [item for g in groups for item in g["items"]]
    assert len(sections) == 10, "Expected 10 top-level sections"
    assert len(groups) == 34, "Expected 34 preview groups"
    assert len(options) == 196, "Expected 196 preview options"
    assert all(o["type"] in {"action", "catalog", "planned"} for o in options)
    assert sum(o["type"] == "planned" for o in options) > 120
    assert "black-red" == embedded["theme"]

    css = "\n".join(parser.styles).lower()
    assert re.search(r"--red\s*:\s*#[0-9a-f]{6}\b", css), "Missing red theme variable"
    assert re.search(r"--bg\s*:\s*#(?:0[0-9a-f]{5}|1[0-9a-f]{5})\b", css), (
        "Missing near-black background variable"
    )
    assert "GoldHEN" in html and "PLANEJADO" in html or "pendente" in html.lower(), (
        "Preview must clarify that GTA modifications are not operational"
    )

    js_blocks = [
        script for attrs, script in parser.blocks
        if attrs.get("type", "").lower() not in {"application/json"} and script.strip()
    ]
    assert js_blocks, "No interactive JavaScript found"
    for script in js_blocks:
        with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as handle:
            handle.write(script)
            handle.flush()
            result = subprocess.run(
                ["node", "--check", handle.name], capture_output=True, text=True
            )
            if result.returncode:
                print(result.stderr, file=sys.stderr)
            assert result.returncode == 0, "Browser script syntax check failed"

    print(
        f"PASS: preview matches taxonomy: {len(sections)} sections, "
        f"{len(groups)} groups, {len(options)} options, "
        f"{len(js_blocks)} valid JavaScript blocks, black/red theme"
    )


if __name__ == "__main__":
    main()
