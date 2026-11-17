"""Fetch immutable corresponding source archives; never execute downloaded code."""
import hashlib
import json
from pathlib import Path
import sys
import urllib.request
manifest=Path(__file__).with_name('tls-dependencies.json')
output=Path(sys.argv[1]);output.mkdir(parents=True,exist_ok=True)
for entry in json.loads(manifest.read_text())['sources']:
    target=output/entry['name'];h=hashlib.sha256();size=0
    with urllib.request.urlopen(entry['url'],timeout=60) as response,target.open('wb') as stream:
        while True:
            block=response.read(1024*1024)
            if not block:break
            size+=len(block)
            if size>100*1024*1024:raise ValueError('source size limit')
            h.update(block);stream.write(block)
    if h.hexdigest()!=entry['sha256']:raise ValueError('source integrity: '+entry['name'])
    print(entry['name']+' verified')
(output/manifest.name).write_bytes(manifest.read_bytes())
