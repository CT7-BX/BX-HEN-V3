#ifndef BX_NATIVE_BRIDGE_H
#define BX_NATIVE_BRIDGE_H
#include <stddef.h>
#include <stdint.h>
#define BX_BRIDGE_SOCKETS 8
#define BX_BRIDGE_MAX_PAYLOAD 65507u
#define BX_BRIDGE_HEADER 28u
/* Wire format interoperates with Chiaki-NG-Web's POSIX bridge, not game input
 * injection. The caller must authenticate the complete session BEFORE calling. */
typedef struct BXBridgeOps {
    int (*open)(void *, int type);
    int (*close)(void *, int socket);
    int (*bind)(void *, int socket);
    int (*connect)(void *, int socket, unsigned port);
    int (*send)(void *, int socket, int type, unsigned port, const void *, size_t);
    int (*name)(void *, int socket, unsigned *port);
    int (*shutdown)(void *, int socket);
} BXBridgeOps;
typedef struct BXBridgeSocket { int used, fd, socket, type; unsigned port; } BXBridgeSocket;
typedef struct BXBridge {
    BXBridgeSocket sockets[BX_BRIDGE_SOCKETS];
    BXBridgeOps ops;
    void *context;
    int (*emit)(void *, const uint8_t *, size_t);
    int failed;
} BXBridge;
void bx_bridge_init(BXBridge *, const BXBridgeOps *, void *, int (*)(void *, const uint8_t *, size_t));
void bx_bridge_close(BXBridge *);
int bx_bridge_handle(BXBridge *, const uint8_t *, size_t);
int bx_bridge_data(BXBridge *, int fd, unsigned port, const void *, size_t);
#endif
