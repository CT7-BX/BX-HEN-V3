"""Build the real DTLS/SCTP fixture for desktop interoperability tests."""
from pathlib import Path
import subprocess,sys,concurrent.futures
base=Path(__file__).resolve().parents[1];deps=base/'build/direct/deps';out=base/'build/direct/host';out.mkdir(parents=True,exist_ok=True)
flags=['-std=gnu11','-O2','-I'+str(deps/'include'),'-I'+str(deps/'vendor/mbedtls/include'),'-DMBEDTLS_CONFIG_FILE=<c4f_mbedtls_config.h>']
def compile_one(source):
 target=out/(source.stem+'.o');subprocess.run(['cc',*flags,'-c',str(source),'-o',str(target)],check=True);return str(target)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:objects=list(pool.map(compile_one,sorted((deps/'vendor/mbedtls/library').glob('*.c'))))
subprocess.run(['cc',*flags,str(base/'direct/host_echo.c'),str(base/'direct/runtime.c'),str(base/'bridge.c'),str(base/'socket_adapter.c'),*[str(deps/'src'/n) for n in ['rtc.c','sctp.c','stun.c']],*objects,'-o',str(out/'rtc-echo')],check=True)
print(out/'rtc-echo')
