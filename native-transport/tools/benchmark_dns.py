"""Compare public relay lookups; read-only, no credentials/config changes.
Measures this computer's dig resolver path, not the PS4 or ongoing game RTT.
"""
import argparse,concurrent.futures,json,re,statistics,subprocess,time
from pathlib import Path
RESOLVERS={'configured_default':None,'cloudflare':'1.1.1.1','google':'8.8.8.8','quad9':'9.9.9.9'}
def sample(host,server):
 args=['dig']+(['@'+server] if server else [])+[host,'A','+tries=1','+time=2','+stats']
 start=time.monotonic()
 try:
  r=subprocess.run(args,capture_output=True,text=True,timeout=3);status=re.search(r'status: ([A-Z]+)',r.stdout);ms=re.search(r'Query time: (\d+) msec',r.stdout)
  answers=re.findall(r'^\S+\s+\d+\s+IN\s+A\s+([\d.]+)$',r.stdout,re.M)
  return {'ok':r.returncode==0 and bool(status and status[1]=='NOERROR' and answers),'dns_ms':int(ms[1]) if ms else None,'wall_ms':round((time.monotonic()-start)*1000,2),'addresses':sorted(set(answers))}
 except (subprocess.TimeoutExpired,OSError):return {'ok':False,'dns_ms':None,'wall_ms':round((time.monotonic()-start)*1000,2),'addresses':[]}
def provider(host,name,server):
 samples=[sample(host,server) for _ in range(7)];values=[s['dns_ms'] for s in samples if s['ok'] and s['dns_ms'] is not None]
 return {'provider':name,'samples':samples,'successes':len(values),'median_dns_ms':statistics.median(values) if values else None,'max_dns_ms':max(values) if values else None}
def main():
 p=argparse.ArgumentParser();p.add_argument('hostname');p.add_argument('--output');a=p.parse_args()
 if len(a.hostname)>253 or not re.fullmatch(r'(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}',a.hostname):p.error('Expected a hostname without URL, path or credentials')
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda x:provider(a.hostname,*x),RESOLVERS.items()))
 report={'hostname':a.hostname,'scope':'local computer dig A lookups only; not PS4 or active-session RTT','samples_per_provider':7,'configuration_changed':False,'results':results}
 text=json.dumps(report,indent=2)
 if a.output:Path(a.output).write_text(text+'\n')
 print(json.dumps({k:v for k,v in report.items() if k!='results'}));print(json.dumps([{k:v for k,v in r.items() if k!='samples'} for r in results]))
if __name__=='__main__':main()
