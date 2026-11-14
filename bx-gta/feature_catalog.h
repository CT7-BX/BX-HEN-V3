#ifndef BX_GTA_FEATURE_CATALOG_H
#define BX_GTA_FEATURE_CATALOG_H
#include <stddef.h>
typedef enum { BX_PLANNED=0, BX_CORE_READY=1, BX_DIAG_READY=2 } BxFeatureStatus;
typedef struct {
    const char *name;
    const char *category;
    const char *key;
    BxFeatureStatus status;
} BxFeature;
int bx_feature_count(void);
const BxFeature *bx_feature_at(int id);
int bx_feature_find(const char *query, int *ids, int capacity);
#endif
