#ifndef BX_GTA_SYNAPSE_CATALOG_H
#define BX_GTA_SYNAPSE_CATALOG_H
#include <stddef.h>
typedef enum {
  BX_LIB_VEHICLES=0, BX_LIB_MODELS, BX_LIB_OBJECTS,
  BX_LIB_ANIMATIONS, BX_LIB_SCENARIOS, BX_LIB_PARTICLES
} BxLibrary;
typedef struct {
  BxLibrary library;
  const char *group;
  unsigned total;
  const char *example_a;
  const char *example_b;
} BxCatalogGroup;
int bx_catalog_group_count(BxLibrary library);
const BxCatalogGroup *bx_catalog_group(BxLibrary library, int index);
int bx_catalog_total(BxLibrary library);
const char *bx_catalog_title(BxLibrary library);
#endif
