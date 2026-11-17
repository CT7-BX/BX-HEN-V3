"""Embed the verified client files for an API-only Worker deployment.
Usage: build-assets.py CLIENT_DIR OUTPUT SOURCE_DOWNLOAD_URL
The source archive stays downloadable from the same GitHub prerelease.
"""
from pathlib import Path
import base64,json,sys
root=Path(sys.argv[1]);out=Path(sys.argv[2]);source=sys.argv[3]
if not (source.startswith('https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/') or source.startswith('https://github.com/CT7-BX/BX-REMOTE-PLAY/actions/runs/')):
    raise SystemExit('Source must be an official project release asset')
assets={}
for name,mime in [('index.html','text/html; charset=utf-8'),('core.js','application/javascript'),('player.js','application/javascript'),('chiaki.js','application/javascript'),('chiaki.worker.js','application/javascript'),('chiaki.wasm','application/wasm'),('CHIAKI-COPYING','text/plain; charset=utf-8')]:
    file=root/name
    if not file.exists():
        if name.endswith('.worker.js'):continue
        raise SystemExit('Missing client asset: '+name)
    assets['/'+name]={'type':mime,'base64':base64.b64encode(file.read_bytes()).decode()}
out.write_text('export const ASSETS='+json.dumps(assets,separators=(',',':'))+';\nexport const SOURCE_URL='+json.dumps(source)+';\n')
print('Embedded',len(assets),'public assets; no credentials included.')
