#ifndef BX_SOCKET_ADAPTER_H
#define BX_SOCKET_ADAPTER_H
#include "bridge.h"
extern const BXBridgeOps bx_socket_ops;
int bx_socket_receive(BXBridge *bridge);
/* Budget includes 28-byte bridge header plus 4-byte batch framing per read. */
int bx_socket_receive_limited(BXBridge *bridge,size_t budget);
#endif
