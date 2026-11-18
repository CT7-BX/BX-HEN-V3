"""Real host TLS sockets with synthetic data; not PS4 validation."""
import http.server
import os
from pathlib import Path
import ssl
import subprocess
import tempfile
import threading
import unittest

class HttpsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(); cls.root=Path(cls.temp.name)
        for name in ['trusted','untrusted']:
            subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(cls.root/(name+'.key')),'-out',str(cls.root/(name+'.pem')),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        base=Path(__file__).resolve().parents[1]
        cls.exe=cls.root/'driver'
        subprocess.run(['cc','-std=c11','-Wall','-Wextra','-Werror',str(base/'https_client.c'),str(base/'tests/https_driver.c'),'-lcurl','-o',str(cls.exe)],check=True)
        cls.requests=[]
        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_POST(self):
                data=self.rfile.read(int(self.headers['Content-Length']))
                cls.requests.append((self.path,self.headers.get('Authorization'),data))
                self.send_response(302 if self.path=='/redirect' else 200)
                if self.path=='/redirect': self.send_header('Location','https://localhost:'+str(self.server.server_port)+'/unexpected')
                self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);ctx.load_cert_chain(cls.root/'trusted.pem',cls.root/'trusted.key');cls.server.socket=ctx.wrap_socket(cls.server.socket,server_side=True)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.temp.cleanup()
    def run_request(self,path='/exchange',host='localhost',ca='trusted',capacity=256,token=None):
        url='https://'+host+':'+str(self.server.server_port)+path
        result=subprocess.run([str(self.exe),url,str(self.root/(ca+'.pem')),token or 'a'*64,str(capacity)],check=True,text=True,capture_output=True)
        lines=result.stdout.splitlines();return list(map(int,lines[0].split())),lines[1] if len(lines)>1 else ''
    def test_verified_tls_binary_roundtrip(self):
        result,body=self.run_request();self.assertEqual(result,[1,200,0,6]);self.assertEqual(body,'00ff01020080');self.assertEqual(self.requests[-1],('/exchange','Bearer '+'a'*64,bytes([0,255,1,2,0,128])))
    def test_untrusted_ca_rejected_before_auth_header(self):
        before=len(self.requests);result,_=self.run_request(ca='untrusted');self.assertEqual(result[0:2],[0,0]);self.assertNotEqual(result[2],0);self.assertEqual(len(self.requests),before)
    def test_hostname_mismatch_rejected_before_auth_header(self):
        before=len(self.requests);result,_=self.run_request(host='127.0.0.1');self.assertEqual(result[0:2],[0,0]);self.assertNotEqual(result[2],0);self.assertEqual(len(self.requests),before)
    def test_redirect_not_followed(self):
        before=len(self.requests);result,_=self.run_request(path='/redirect');self.assertEqual(result[0:2],[0,302]);self.assertEqual(len(self.requests),before+1)
    def test_response_limit_fails_without_returning_partial_bytes(self):
        result,_=self.run_request(capacity=2);self.assertEqual(result[0:2],[0,0]);self.assertNotEqual(result[2],0);self.assertEqual(result[3],0)
    def test_header_injection_rejected_without_network_request(self):
        before=len(self.requests);result,_=self.run_request(token='a'*63+'\n');self.assertEqual(result[0:2],[0,0]);self.assertEqual(len(self.requests),before)
