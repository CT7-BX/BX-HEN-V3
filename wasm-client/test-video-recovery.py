"""Exercise the pinned receiver's actual FEC recovery branch with host mocks.
Checks suppression while waiting for IDR; does not simulate a PS4/video stream.
"""
from pathlib import Path
import subprocess,sys,tempfile
root=Path(sys.argv[1]);s=(root/'lib/src/videoreceiver.c').read_text();client=(root/'wasm/src/chiaki_wasm.c').read_text()
assert client.count('connect_info.enable_idr_on_fec_failure = true;')==1
needle='if (flush_result == CHIAKI_FRAME_PROCESSOR_FLUSH_RESULT_FEC_FAILED)';start=s.index(needle);opening=s.index('{',start);depth=1;end=opening+1
while depth:
 if s[end]=='{':depth+=1
 if s[end]=='}':depth-=1
 end+=1
branch=s[start:end]
code=r'''
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>
#define CHIAKI_FRAME_PROCESSOR_FLUSH_RESULT_FEC_FAILED 2
#define CHIAKI_ERR_SUCCESS 0
#define CHIAKI_EVENT_VIDEO_FEC_FAILURE 1
#define CHIAKI_LOGI(...) ((void)0)
#define CHIAKI_LOGW(...) ((void)0)
typedef int ChiakiErrorCode;
typedef uint16_t ChiakiSeqNum16;
typedef struct {int type;struct {uint16_t frame_index;bool idr_request_sent;} video_fec_failure;} ChiakiEvent;
typedef struct {struct {bool enable_idr_on_fec_failure;} connect_info;int stream_connection;} Session;
typedef struct {Session *session;bool waiting;uint16_t frame_index_prev_complete,frame_index_cur,frame_index_prev;int frames_lost_mutex;int32_t frames_lost,frames_lost_total;void *log;} ChiakiVideoReceiver;
static int requests,events,result;static bool last_event_sent;
static int stream_connection_send_idr_request(int *s){(void)s;requests++;return result;}
static void stream_connection_send_corrupt_frame(int *s,uint16_t a,uint16_t b){(void)s;(void)a;(void)b;}
static bool chiaki_video_receiver_get_waiting_for_idr(ChiakiVideoReceiver *v){return v->waiting;}
static void chiaki_video_receiver_set_waiting_for_idr(ChiakiVideoReceiver *v,bool value){v->waiting=value;}
static void chiaki_mutex_lock(int *s){(void)s;}
static void chiaki_mutex_unlock(int *s){(void)s;}
static void chiaki_session_send_event(Session *s,ChiakiEvent *e){(void)s;events++;last_event_sent=e->video_fec_failure.idr_request_sent;}
static void fec_failure(ChiakiVideoReceiver *video_receiver){int flush_result=CHIAKI_FRAME_PROCESSOR_FLUSH_RESULT_FEC_FAILED;
'''+branch+r'''
}
int main(void){Session s={0};ChiakiVideoReceiver v={0};v.session=&s;v.frame_index_prev_complete=1;v.frame_index_cur=2;
 fec_failure(&v);assert(!requests&&!events&&!v.waiting);
 s.connect_info.enable_idr_on_fec_failure=true;fec_failure(&v);assert(requests==1&&events==1&&v.waiting&&last_event_sent);
 for(int i=0;i<60;i++)fec_failure(&v);assert(requests==1&&events==61&&v.waiting);
 // Once receiver leaves the waiting state, a new failure may request again.
 chiaki_video_receiver_set_waiting_for_idr(&v,false);fec_failure(&v);assert(requests==2&&v.waiting);
 v.waiting=false;result=1;fec_failure(&v);assert(requests==3&&!v.waiting&&!last_event_sent);return 0;}
'''
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp);(p/'test.c').write_text(code);subprocess.run(['cc','-std=c11','-Wall','-Wextra','-Werror','-Wno-misleading-indentation',str(p/'test.c'),'-o',str(p/'test')],check=True);subprocess.run([str(p/'test')],check=True,timeout=5)
print('Pinned FEC recovery: flag enabled, request suppression while waiting, retry state passed (mocked host branch, no PS4).')
