"""Fetch and adapt only Control4Free's GPL-3.0 networking/DTLS components.
No virtual-controller, HEN, launcher or capture code is imported.
"""
import hashlib,io,json,sys,tarfile,urllib.request
from pathlib import Path
COMMIT='f18f4a80c05bee31a354a5792b47f4aafe71bfdd'
SHA='0e9c41570e3154174dcbd05d8a100063750c0dfe8abb54120944dc6727a41973'
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
archive=Path(sys.argv[2]) if len(sys.argv)>2 else out/'upstream-source.tar.gz'
if not archive.exists():
 request=urllib.request.Request('https://codeload.github.com/MoHadiShibli/Control4Free/tar.gz/'+COMMIT,headers={'User-Agent':'BX-Source-Verification/1.0'})
 with urllib.request.urlopen(request,timeout=60) as r: data=r.read(32*1024*1024+1)
 if len(data)>32*1024*1024:raise ValueError('archive_limit')
 archive.write_bytes(data)
data=archive.read_bytes()
if hashlib.sha256(data).hexdigest()!=SHA:raise ValueError('upstream_source_integrity')
files={'src/rtc.c','src/stun.c','src/sctp.c','include/c4f_rtc.h','include/c4f_stun.h','include/c4f_sctp.h','include/c4f_conn.h','include/c4f_log.h','include/c4f_mbedtls_config.h','LICENSE'}
with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as t:
 for member in t.getmembers():
  parts=Path(member.name).parts[1:];name='/'.join(parts)
  if name not in files and not name.startswith('vendor/mbedtls/'):continue
  if not member.isfile():continue
  if '..' in parts or Path(name).is_absolute():raise ValueError('unsafe_archive_path')
  p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(t.extractfile(member).read())
p=out/'include/c4f_sctp.h';p.write_text(p.read_text().replace('#define C4F_SCTP_MAX_MESSAGE 16384','#define C4F_SCTP_MAX_MESSAGE 65535'))
p=out/'include/c4f_rtc.h';p.write_text(p.read_text().replace('#define C4F_RTC_PEERS 8','#define C4F_RTC_PEERS 1').replace('#define C4F_RTC_SILENT_MS 10000','#define C4F_RTC_SILENT_MS 60000').replace('#endif','''/* BX additions: owned binary messages; reliable channel 0. */
int bxRtcBinary(C4fConn *,const void *,size_t);
size_t bxRtcBudget(C4fConn *);
void bxRtcDisconnect(C4fConn *);
uint64_t bxRtcRtt(C4fConn *);
#endif'''))
p=out/'src/rtc.c';s=p.read_text();old='    if (ppid != C4F_SCTP_PPID_STRING || len > C4F_RTC_TEXT) return;';assert s.count(old)==1
s=s.replace(old,'''    /* BX: binary socket records never pass through string or JSON parsing. */
    if (ppid == C4F_SCTP_PPID_BINARY && len <= C4F_SCTP_MAX_MESSAGE) {
        p->rtc->handler(&p->conn, C4F_NET_MESSAGE_EVENT, (const char *)data, len, p->rtc->context);
        return;
    }
'''+old)
s+='''
/* BX adapters. Queue bounds stay below upstream's 256 KiB / 512 chunks. */
int bxRtcBinary(C4fConn *conn,const void *data,size_t size) {
    C4fRtcPeer *p=(C4fRtcPeer *)conn;
    if(!p||p->ending||p->failed||!p->opened)return -1;
    return c4fSctpSend(&p->sctp,0,C4F_SCTP_PPID_BINARY,data,size,c4fTimeMs());
}
size_t bxRtcBudget(C4fConn *conn) {
    C4fRtcPeer *p=(C4fRtcPeer *)conn;
    if(!p||p->ending||p->failed||!p->opened||p->sctp.outChunks>440||p->sctp.outBytes>=192u*1024u)return 0;
    size_t available=192u*1024u-p->sctp.outBytes;
    return available>32768u?32768u:available;
}
void bxRtcDisconnect(C4fConn *conn) {if(conn)c4fRtcEnd((C4fRtcPeer *)conn,"BX connection ended");}
uint64_t bxRtcRtt(C4fConn *conn) {C4fRtcPeer *p=(C4fRtcPeer *)conn;return p&&p->sctp.rttKnown?p->sctp.srtt:0;}
'''
p.write_text(s)
(out/'BX-UPSTREAM.json').write_text(json.dumps({'repository':'https://github.com/MoHadiShibli/Control4Free','commit':COMMIT,'archiveSHA256':SHA,'license':'GPL-3.0','changes':'binary reliable data channel adapter, 65535-byte message bound, one peer; no controller code'},indent=2)+'\n')
print('Verified RTC source prepared')
