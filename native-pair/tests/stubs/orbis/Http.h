/* Host-only mock declarations. Not PS4 ABI validation. */
#ifndef BX_TEST_HTTP_H
#define BX_TEST_HTTP_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define ORBIS_METHOD_GET 0
int sceHttpGetAllResponseHeaders(int request, char **headers, size_t *length);
int sceHttpCreateConnectionWithURL(int tmpl, const char *url, bool keepalive);
int sceHttpCreateRequestWithURL(int connection, int method, const char *url, uint64_t length);
int sceHttpSetConnectTimeOut(int request, unsigned timeout);
int sceHttpSetResolveTimeOut(int request, unsigned timeout);
int sceHttpSetSendTimeOut(int request, unsigned timeout);
int sceHttpSetRecvTimeOut(int request, unsigned timeout);
int sceHttpSendRequest(int request, const void *body, size_t length);
int sceHttpGetStatusCode(int request, int *status);
int sceHttpReadData(int request, void *buffer, size_t length);
int sceHttpDeleteRequest(int request);
int sceHttpDeleteConnection(int connection);
#endif
