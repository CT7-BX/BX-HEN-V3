#ifndef BX_SOCKET_ADAPTER_H
#define BX_SOCKET_ADAPTER_H
#include "bridge.h"
extern const BXBridgeOps bx_socket_ops;
int bx_socket_receive(BXBridge *bridge);
#endif
