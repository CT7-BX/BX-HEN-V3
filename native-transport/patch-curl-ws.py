"""Narrow curl 8.13.0 fix: control frames must preserve message fragmentation.
Applied to both host-test and v10 PS4 builds. Original source hash is verified
by the workflow before this transformation. v09's prebuilt archive is unchanged.
"""
from pathlib import Path
import sys
path=Path(sys.argv[1])/'lib/ws.c'
source=path.read_text()
old='''      if(dec->frame_flags & CURLWS_CONT) {
        dec->cont_flags = dec->frame_flags;
      }
      else {
        dec->cont_flags = 0;
      }'''
new='''      /* BX: ping/pong/close do not change the current data message. */
      if(dec->frame_flags & (CURLWS_TEXT | CURLWS_BINARY)) {
        if(dec->frame_flags & CURLWS_CONT)
          dec->cont_flags = dec->frame_flags;
        else
          dec->cont_flags = 0;
      }'''
if source.count(old)!=1:raise SystemExit('unexpected curl source; refusing patch')
path.write_text(source.replace(old,new))
