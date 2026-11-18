/* No listener: all TCP/UDP destinations are fixed to this console's loopback. */
#include "socket_adapter.h"
#include <string.h>
#include <sys/time.h>
#include <netinet/tcp.h>
#ifdef BX_TRANSPORT_PS4
#include <orbis/Net.h>
typedef OrbisNetSockaddr Address;
typedef OrbisNetSocklen_t AddressLength;
#define SEND_FLAGS 0
#define READ_FLAGS 0x80 /* FreeBSD/PS4 MSG_DONTWAIT */
static void address(Address *a,unsigned port) {
    memset(a,0,sizeof(*a));a->len=sizeof(*a);a->sa_family=2;
    a->sa_data[0]=(char)(port>>8);a->sa_data[1]=(char)port;
    a->sa_data[2]=127;a->sa_data[5]=1;
}
static int make_socket(int type){return sceNetSocket("bx_rp_stream",2,type,0);}
static int drop(int socket){return sceNetSocketClose(socket);}
static int bind_socket(int s,Address *a){return sceNetBind(s,a,sizeof(*a));}
static int connect_socket(int s,Address *a){return sceNetConnect(s,a,sizeof(*a));}
static int send_socket(int s,const void *p,size_t n){return sceNetSend(s,p,n,SEND_FLAGS);}
static int send_datagram(int s,const void *p,size_t n,Address *a){return sceNetSendto(s,p,n,SEND_FLAGS,a,sizeof(*a));}
static int name_socket(int s,Address *a,AddressLength *n){return sceNetGetsockname(s,a,n);}
static int read_socket(int s,void *p,size_t n,Address *a,AddressLength *an){return sceNetRecvfrom(s,p,n,READ_FLAGS,a,an);}
static int set_timeout(int s){struct timeval t={3,0};return sceNetSetsockopt(s,0xffff,0x1005,&t,sizeof(t));}
static int nodelay(int s){int yes=1;return sceNetSetsockopt(s,6,TCP_NODELAY,&yes,sizeof(yes));}
static int stop_send(int s){return sceNetShutdown(s,1);}
static unsigned port_of(const Address *a){return ((unsigned char)a->sa_data[0]<<8)|(unsigned char)a->sa_data[1];}
static int from_loopback(const Address *a){return a->sa_family==2 && (unsigned char)a->sa_data[2]==127 && a->sa_data[3]==0 && a->sa_data[4]==0 && a->sa_data[5]==1;}
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <limits.h>
#include <errno.h>
typedef struct sockaddr_in Address;
typedef socklen_t AddressLength;
static void address(Address *a,unsigned port){memset(a,0,sizeof(*a));a->sin_family=AF_INET;a->sin_port=htons((uint16_t)port);a->sin_addr.s_addr=htonl(INADDR_LOOPBACK);}
static int make_socket(int type){int s=socket(AF_INET,type,0);
#ifdef SO_NOSIGPIPE
    int yes=1;if(s>=0 && setsockopt(s,SOL_SOCKET,SO_NOSIGPIPE,&yes,sizeof(yes))<0){close(s);return -1;}
#endif
    return s;}
static int drop(int s){return close(s);}
static int bind_socket(int s,Address *a){return bind(s,(struct sockaddr *)a,sizeof(*a));}
static int connect_socket(int s,Address *a){return connect(s,(struct sockaddr *)a,sizeof(*a));}
#ifndef MSG_NOSIGNAL
#define MSG_NOSIGNAL 0
#endif
static int send_socket(int s,const void *p,size_t n){return (int)send(s,p,n,MSG_NOSIGNAL);}
static int send_datagram(int s,const void *p,size_t n,Address *a){return (int)sendto(s,p,n,0,(struct sockaddr *)a,sizeof(*a));}
static int name_socket(int s,Address *a,AddressLength *n){return getsockname(s,(struct sockaddr *)a,n);}
static int read_socket(int s,void *p,size_t n,Address *a,AddressLength *an){return (int)recvfrom(s,p,n,MSG_DONTWAIT,(struct sockaddr *)a,an);}
static int set_timeout(int s){struct timeval t={3,0};return setsockopt(s,SOL_SOCKET,SO_SNDTIMEO,&t,sizeof(t));}
static int nodelay(int s){int yes=1;return setsockopt(s,IPPROTO_TCP,TCP_NODELAY,&yes,sizeof(yes));}
static int stop_send(int s){return shutdown(s,SHUT_WR);}
static unsigned port_of(const Address *a){return ntohs(a->sin_port);}
static int from_loopback(const Address *a){return a->sin_family==AF_INET && a->sin_addr.s_addr==htonl(INADDR_LOOPBACK);}
#endif
static int open_op(void *ctx,int type){int s;(void)ctx;s=make_socket(type);if(s>=0 && (set_timeout(s)<0 || (type==1 && nodelay(s)<0))){drop(s);return -1;}return s;}
static int close_op(void *ctx,int s){(void)ctx;return drop(s);}
static int bind_op(void *ctx,int s){Address a;(void)ctx;address(&a,0);return bind_socket(s,&a);}
static int connect_op(void *ctx,int s,unsigned port){Address a;(void)ctx;address(&a,port);return connect_socket(s,&a);}
static int send_op(void *ctx,int s,int type,unsigned port,const void *p,size_t n){Address a;(void)ctx;address(&a,port);return type==1?send_socket(s,p,n):send_datagram(s,p,n,&a);}
static int name_op(void *ctx,int s,unsigned *port){Address a;AddressLength n=sizeof(a);int r;(void)ctx;r=name_socket(s,&a,&n);if(r>=0)*port=port_of(&a);return r;}
static int shutdown_op(void *ctx,int s){(void)ctx;return stop_send(s);}
const BXBridgeOps bx_socket_ops={open_op,close_op,bind_op,connect_op,send_op,name_op,shutdown_op};
int bx_socket_receive_limited(BXBridge *b,size_t remaining){
    size_t i,step,start=b->receive_cursor;uint8_t data[16384];int count=0;
    for(step=0;step<BX_BRIDGE_SOCKETS;step++){i=(start+step)%BX_BRIDGE_SOCKETS;if(b->sockets[i].used){
        BXBridgeSocket *s=&b->sockets[i];unsigned budget;
        for(budget=0;budget<128;budget++){Address a;AddressLength an=sizeof(a);
        size_t capacity;int n;
        if(remaining<=32){b->receive_cursor=(i+1)%BX_BRIDGE_SOCKETS;return count;}
        /* Do not truncate a datagram to the small remainder of a batch. */
        if(s->type==2 && remaining<sizeof(data)+32)break;
        capacity=remaining-32;if(capacity>sizeof(data))capacity=sizeof(data);
        n=read_socket(s->socket,data,capacity,&a,&an);
        /* UDP is filtered again on receive, even though the adapter only sends
           to loopback. This cannot be used to read arbitrary LAN traffic. */
        if(n>0 && (s->type==1 || from_loopback(&a))){
            unsigned port=s->type==1?s->port:port_of(&a);
            if(!bx_bridge_data(b,s->fd,port,data,(size_t)n))return -1;
            remaining-=(size_t)n+32;++count;
        }
        if(n==0 && s->type==1 && s->port){if(!bx_bridge_eof(b,s->fd))return -1;remaining-=32;break;}
        if(n<=0)break;
        }
    }
    }
    b->receive_cursor=(start+1)%BX_BRIDGE_SOCKETS;return count;
}
int bx_socket_receive(BXBridge *b){return bx_socket_receive_limited(b,(size_t)-1);}
