"""Real localhost TCP/UDP bytes through the C bridge; no PS4 claims."""
from pathlib import Path
import os,select,socket,struct,subprocess,tempfile,threading,time,unittest
ROOT=Path(__file__).resolve().parents[1]
class NetworkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();cls.binary=str(Path(cls.tmp.name)/'bridge-host')
        subprocess.run(['cc','-std=c11','-Wall','-Wextra','-Werror','-pedantic',str(ROOT/'bridge.c'),str(ROOT/'socket_adapter.c'),str(ROOT/'tests/host_driver.c'),'-o',cls.binary],check=True)
    @classmethod
    def tearDownClass(cls):cls.tmp.cleanup()
    def packet(self,op,seq,fd,a=0,b=0,c=0,data=b''):
        return struct.pack('<B3xIIIII I',op,seq,fd,a,b,c,len(data))+data
    def send(self,p,data):p.stdin.write(struct.pack('<I',len(data))+data);p.stdin.flush()
    def read(self,p):
        def exact(n):
            result=b'';deadline=time.monotonic()+4
            while len(result)<n:
                wait=max(0,deadline-time.monotonic())
                self.assertTrue(select.select([p.stdout],[],[],wait)[0],'bridge reply timed out')
                chunk=os.read(p.stdout.fileno(),n-len(result));self.assertTrue(chunk,'bridge closed unexpectedly');result+=chunk
            return result
        data=exact(struct.unpack('<I',exact(4))[0]);return struct.unpack('<B3xIIiiiI',data[:28]),data[28:]
    def test_real_tcp_and_udp_echo(self):
        for kind,port in [(socket.SOCK_STREAM,9295),(socket.SOCK_DGRAM,9296)]:
            with self.subTest(kind=kind),socket.socket(socket.AF_INET,kind) as server:
                server.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);server.bind(('127.0.0.1',port));server.settimeout(5)
                if kind==socket.SOCK_STREAM:server.listen(1)
                failures=[]
                def echo():
                    try:
                        if kind==socket.SOCK_STREAM:
                            client,_=server.accept()
                            with client:client.sendall(client.recv(8192))
                        else:
                            data,addr=server.recvfrom(8192);server.sendto(data,addr)
                    except Exception as error:failures.append(error)
                worker=threading.Thread(target=echo,daemon=True);worker.start()
                with subprocess.Popen([self.binary],stdin=subprocess.PIPE,stdout=subprocess.PIPE,bufsize=0) as bridge:
                    try:
                        fd=4096;self.send(bridge,self.packet(1,1,fd,b=kind));self.assertEqual(self.read(bridge)[0][3],0)
                        if kind==socket.SOCK_DGRAM:
                            self.send(bridge,self.packet(3,2,fd));self.assertEqual(self.read(bridge)[0][3],0)
                        self.send(bridge,self.packet(4,3,fd,b=port,c=0x7f000001))
                        h,_=self.read(bridge)
                        if kind==socket.SOCK_STREAM:
                            self.assertEqual(h[0],130);h,_=self.read(bridge)
                        self.assertEqual(h[3],0)
                        payload=bytes(range(256))*4
                        self.send(bridge,self.packet(5,4,fd,data=payload))
                        h,_=self.read(bridge);self.assertEqual(h[3],len(payload))
                        result=b''
                        while len(result)<len(payload):
                            h,data=self.read(bridge);self.assertEqual(h[0],129);result+=data
                        self.assertEqual(result,payload)
                    finally:bridge.stdin.close();bridge.wait(timeout=5)
                worker.join(timeout=6);self.assertFalse(worker.is_alive());self.assertFalse(failures)
if __name__=='__main__':unittest.main(verbosity=2)
