"""Verified WSS over real host sockets; synthetic traffic, not PS4 validation."""
import base64, hashlib, http.server, os, ssl, struct, subprocess, tempfile, threading, unittest
from pathlib import Path
@unittest.skipUnless(os.environ.get('BX_HOST_CURL_PREFIX'), 'requires pinned curl with WebSocket support')
class WebSocketTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();cls.root=Path(cls.temp.name);cls.errors=[]
  for name in ['trusted','untrusted']:
   subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(cls.root/(name+'.key')),'-out',str(cls.root/(name+'.pem')),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  base=Path(__file__).resolve().parents[1];prefix=Path(os.environ['BX_HOST_CURL_PREFIX']);cls.exe=cls.root/'driver'
  subprocess.run(['cc','-std=c11','-Wall','-Wextra','-Wno-misleading-indentation','-I'+str(prefix/'include'),str(base/'ws_client.c'),str(base/'https_client.c'),str(base/'tests/ws_driver.c'),str(prefix/'lib/libcurl.a'),'-lssl','-lcrypto','-lpthread','-ldl','-o',str(cls.exe)],check=True)
  class Handler(http.server.BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_GET(self):
    if self.headers.get('Authorization')!='Bearer '+'a'*64:self.send_error(401);return
    accept=base64.b64encode(hashlib.sha1((self.headers['Sec-WebSocket-Key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
    self.send_response(101);self.send_header('Upgrade','websocket');self.send_header('Connection','Upgrade');self.send_header('Sec-WebSocket-Accept',accept);self.end_headers();self.connection.settimeout(15)
    def exact(n):
     value=self.rfile.read(n)
     if len(value)!=n:raise ValueError('short frame')
     return value
    def send(opcode,data,fin=True):
     header=bytes([(128 if fin else 0)|opcode]);n=len(data)
     header+=bytes([n]) if n<126 else bytes([126])+struct.pack('!H',n) if n<65536 else bytes([127])+struct.pack('!Q',n)
     self.wfile.write(header+data);self.wfile.flush()
    try:
     messages=[]
     for i in range(8):
      h=exact(2);n=h[1]&127
      if n==126:n=struct.unpack('!H',exact(2))[0]
      if n==127:n=struct.unpack('!Q',exact(8))[0]
      if h[0]!=130 or not h[1]&128 or n!=70000:raise ValueError('unexpected frame')
      mask=exact(4);data=exact(n);data=bytes(v^mask[j%4] for j,v in enumerate(data))
      if data!=bytes([i])*70000:raise ValueError('corrupt payload')
      messages.append(data)
     for data in messages:
      send(2,data[:30000],False);send(9,b'ping');send(0,data[30000:])
    except Exception as error:cls.errors.append(str(error))
  cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);ctx.load_cert_chain(cls.root/'trusted.pem',cls.root/'trusted.key');cls.server.socket=ctx.wrap_socket(cls.server.socket,server_side=True)
  cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.temp.cleanup()
 def request(self,host='localhost',ca='trusted'):
  return subprocess.run([str(self.exe),'wss://'+host+':'+str(self.server.server_port)+'/console-stream',str(self.root/(ca+'.pem'))],capture_output=True,text=True,timeout=25)
 def test_pipeline_and_fragmented_binary_with_ping(self):
  result=self.request();self.assertEqual(result.returncode,0,result.stderr+result.stdout+repr(self.errors));self.assertEqual(result.stdout.strip(),'pipeline_ok');self.assertEqual(self.errors,[])
 def test_wrong_ca(self):self.assertTrue(self.request(ca='untrusted').stdout.startswith('rejected '))
 def test_wrong_hostname(self):self.assertTrue(self.request(host='127.0.0.1').stdout.startswith('rejected '))
