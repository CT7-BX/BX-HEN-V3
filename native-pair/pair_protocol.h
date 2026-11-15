#ifndef BX_PAIR_PROTOCOL_H
#define BX_PAIR_PROTOCOL_H

#include <stddef.h>

/* Portable input validation: no PS4 SDK dependency. */
int bx_pair_valid_origin(const char *origin);
int bx_pair_valid_token(const char *token);
int bx_pair_field(const char *json, const char *name, char *out, size_t capacity);
int bx_pair_code(const char *json, char out[9]);
int bx_pair_identifier(const char *json, const char *field, char out[65]);
int bx_pair_status(const char *json, char out[32]);
int bx_pair_decision_json(char *dest, size_t cap, const char *request, const char *claim, int allow);

#endif
