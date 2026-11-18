"""Fetch hash-pinned corresponding sources; never execute downloaded code."""
import hashlib
import json
from pathlib import Path
import sys
import time
import urllib.request
manifest=Path(__file__).with_name('tls-dependencies.json')
output=Path(sys.argv[1]);output.mkdir(parents=True,exist_ok=True)
for entry in json.loads(manifest.read_text())['sources']:
    target=output/entry['name'];temporary=target.with_suffix(target.suffix+'.partial')
    for attempt in range(3):
        try:
            h=hashlib.sha256();size=0
            request=urllib.request.Request(entry['url'],headers={'User-Agent':'BX-Source-Verification/1.0'})
            with urllib.request.urlopen(request,timeout=60) as response,temporary.open('wb') as stream:
                while True:
                    block=response.read(1024*1024)
                    if not block:break
                    size+=len(block)
                    if size>100*1024*1024:raise ValueError('source size limit')
                    h.update(block);stream.write(block)
            if h.hexdigest()!=entry['sha256']:raise ValueError('source integrity: '+entry['name'])
            temporary.replace(target)
            break
        except Exception:
            temporary.unlink(missing_ok=True)
            if attempt==2:raise
            time.sleep(1)
    print(entry['name']+' verified')
(output/manifest.name).write_bytes(manifest.read_bytes())
