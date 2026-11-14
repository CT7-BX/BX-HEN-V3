#include "menu_v1.h"
#include "synapse_catalog.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

static int checks;
static void test(int cond,const char *name){
 ++checks;
 if(!cond){fprintf(stderr,"FAIL (%d) %s\n",checks,name);exit(1);}
}
static void bounds(const BxMenuV1 *s) {
 test(s->section>=0 && s->section<bx_v1_section_count(),"section in bounds");
 test(s->option>=0 && s->option<bx_v1_option_count(s->section),"option in bounds");
 if(s->depth==2){
  test(s->group>=0 &&
       s->group<bx_catalog_group_count((BxLibrary)s->library),"group in bounds");
 }
}
static void catalogs(void){
 test(bx_catalog_group_count(BX_LIB_VEHICLES)==20,"20 vehicle categories");
 test(bx_catalog_total(BX_LIB_VEHICLES)==812,"812 vehicles");
 test(bx_catalog_group_count(BX_LIB_MODELS)==7,"7 ped categories");
 test(bx_catalog_total(BX_LIB_MODELS)==275,"275 peds");
 test(bx_catalog_group_count(BX_LIB_OBJECTS)==13,"13 object categories");
 test(bx_catalog_total(BX_LIB_OBJECTS)==172,"172 objects");
 test(bx_catalog_total(BX_LIB_ANIMATIONS)==204,"204 animation references");
 test(bx_catalog_total(BX_LIB_SCENARIOS)==134,"134 scenarios");
 test(bx_catalog_total(BX_LIB_PARTICLES)==197,"197 particles");
 test(bx_catalog_group(BX_LIB_VEHICLES,20)==NULL,"reject invalid group");
 test(bx_catalog_group(BX_LIB_PARTICLES,0)!=NULL,"particles group present");
 test(bx_catalog_group((BxLibrary)-1,0)==NULL,"reject invalid library");
 test(bx_catalog_total((BxLibrary)20)==0,"reject invalid count");
}
static void navigation(void){
 BxMenuV1 m;
 char buf[256];
 bx_v1_reset(&m);
 test(bx_v1_section_count()==9,"nine sections");
 test(!m.opened,"start closed");
 test(!bx_v1_input(&m,BX_KEY_SELECT).changed,"cannot select when closed");
 test(bx_v1_input(&m,BX_KEY_TOGGLE).changed&&m.opened,"toggle open");
 test(bx_v1_render(&m,buf,sizeof(buf))>0,"render root");
 test(strstr(buf,"Inicio")!=NULL,"root content");
 test(bx_v1_input(&m,BX_KEY_SELECT).changed&&m.depth==1,"enter home");
 test(bx_v1_input(&m,BX_KEY_SELECT).action==BX_ACT_SUMMARY,"summary selected");
 test(bx_v1_input(&m,BX_KEY_BACK).changed&&m.depth==0,"return to root");
 for(int i=0;i<2;++i)bx_v1_input(&m,BX_KEY_DOWN);
 test(m.section==2,"vehicle section");
 bx_v1_input(&m,BX_KEY_SELECT);
 BxUiEvent e=bx_v1_input(&m,BX_KEY_SELECT);
 test(e.action==BX_ACT_OPEN_CATALOG&&m.depth==2,"vehicle catalog open");
 test(m.library==BX_LIB_VEHICLES,"vehicle library");
 test(bx_v1_render(&m,buf,sizeof(buf))>0&&strstr(buf,"Super")!=NULL,
      "catalog group text");
 for(int i=0;i<23;++i)bx_v1_input(&m,BX_KEY_DOWN);
 test(m.group==3,"group wrap around 20");
 test(bx_v1_input(&m,BX_KEY_SELECT).action==BX_ACT_CATALOG_INFO,
      "select group shows info, not spawn");
 test(bx_v1_input(&m,BX_KEY_BACK).changed&&m.depth==1,"catalog back");
 bx_v1_input(&m,BX_KEY_DOWN);
 test(bx_v1_input(&m,BX_KEY_SELECT).action==BX_ACT_UNAVAILABLE,
      "unimplemented vehicle edit is disabled");
 test(bx_v1_current_feature(&m)==8,"feature id mapped");
 bx_v1_input(&m,BX_KEY_BACK);
 for(int i=0;i<10;++i)bx_v1_input(&m,BX_KEY_DOWN);
 bounds(&m);
 test(bx_v1_input(&m,BX_KEY_TOGGLE).changed&&!m.opened,"close");
 test(bx_v1_render(&m,buf,1)>=0&&buf[0]=='\0',"bounded render");
 test(bx_v1_render(NULL,buf,sizeof(buf))<0,"null state");
 test(bx_v1_render(&m,NULL,sizeof(buf))<0,"null buffer");
}
static void stress(void){
 BxMenuV1 m;
 bx_v1_reset(&m);
 uint32_t seed=0xABAD1DEAu;
 for(int i=0;i<150000;++i){
  seed=seed*1664525u+1013904223u;
  BxKey key=(BxKey)(seed%7);
  (void)bx_v1_input(&m,key);
  bounds(&m);
 }
}
int main(void){
 catalogs();navigation();stress();
 printf("PASS v1.0: catalog counts, nine-section UI, disabled actions, 150000 events, %d assertions\n",checks);
 return 0;
}
