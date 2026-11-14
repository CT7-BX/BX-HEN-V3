#include "menu_v2.h"
#include "synapse_catalog.h"
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
static int checks=0;
static void check(int ok,const char*msg){
 ++checks;
 if(!ok){fprintf(stderr,"FAIL %d: %s\n",checks,msg);exit(1);}
}
static void bounds(const BxMenuV2 *s){
 check(s->section>=0&&s->section<bx_v2_section_count(),"section");
 check(s->subgroup>=0&&s->subgroup<bx_v2_subgroup_count(s->section),"group");
 check(s->option>=0&&s->option<bx_v2_option_count(s->section,s->subgroup),"option");
 if(s->depth==3)check(s->catalog_group>=0&&
   s->catalog_group<bx_catalog_group_count((BxLibrary)s->library),"catalog group");
}
static void catalog_test(void){
 int total=0,groups=0,actions=0,planned=0,library=0;
 check(bx_v2_section_count()==10,"10 top sections");
 check(bx_v2_total_options()==190,"190 entries");
 for(int s=0;s<bx_v2_section_count();++s){
  check(strlen(bx_v2_section_title(s))>0,"section title");
  groups+=bx_v2_subgroup_count(s);
  for(int g=0;g<bx_v2_subgroup_count(s);++g){
   check(strlen(bx_v2_subgroup_title(s,g))>0,"group title");
   for(int i=0;i<bx_v2_option_count(s,g);++i){
    const BxOption *opt=bx_v2_option(s,g,i);
    check(opt!=NULL&&strlen(opt->title)>0,"valid option");
    if(opt->action==BX_ACT_UNAVAILABLE)++planned;
    else if(opt->action==BX_ACT_OPEN_CATALOG)++library;
    else ++actions;
    ++total;
   }
  }
 }
 check(total==190&&groups==33,"full taxonomy represented");
 check(actions>15&&planned>120&&library>10,"states represented separately");
 check(bx_v2_option(-1,0,0)==NULL,"reject negative section");
 check(bx_v2_option(0,-1,0)==NULL,"reject negative group");
 check(bx_v2_option(0,0,999)==NULL,"reject invalid option");
 check(!strcmp(bx_v2_section_title(-1),"Invalido"),"reject invalid title");
}
static void navigation(void){
 BxMenuV2 m; char text[256];
 bx_v2_reset(&m);
 check(!m.opened,"initially closed");
 check(!bx_v2_input(&m,BX_KEY_SELECT).changed,"ignore select closed");
 check(bx_v2_input(&m,BX_KEY_TOGGLE).changed&&m.opened,"open");
 check(bx_v2_render(&m,text,sizeof(text))>0,"render root");
 check(bx_v2_input(&m,BX_KEY_SELECT).changed&&m.depth==1,"enter groups");
 check(bx_v2_input(&m,BX_KEY_SELECT).changed&&m.depth==2,"enter options");
 check(bx_v2_input(&m,BX_KEY_SELECT).action==BX_ACT_SUMMARY,"select summary");
 check(bx_v2_current_feature(&m)==5,"summary feature mapped");
 bx_v2_input(&m,BX_KEY_BACK);
 check(m.depth==1,"go back to groups");
 bx_v2_input(&m,BX_KEY_DOWN);
 bx_v2_input(&m,BX_KEY_SELECT);
 BxUiEvent e=bx_v2_input(&m,BX_KEY_SELECT);
 check(e.action==BX_ACT_OPEN_CATALOG&&m.depth==3,"enter library");
 check(m.library==BX_LIB_VEHICLES,"vehicle library");
 check(bx_v2_render(&m,text,sizeof(text))>0&&
       strstr(text,"Super")!=NULL,"render catalog");
 check(bx_v2_input(&m,BX_KEY_SELECT).action==BX_ACT_CATALOG_INFO,"catalog info");
 for(int i=0;i<26;++i)bx_v2_input(&m,BX_KEY_DOWN);
 check(m.catalog_group==6,"20 categories wrap");
 bx_v2_input(&m,BX_KEY_BACK);
 check(m.depth==2,"catalog back");
 bx_v2_input(&m,BX_KEY_BACK);
 bx_v2_input(&m,BX_KEY_BACK);
 check(m.depth==0,"return root");
 bx_v2_input(&m,BX_KEY_DOWN);
 check(m.section==1,"go to player");
 bx_v2_input(&m,BX_KEY_SELECT);
 bx_v2_input(&m,BX_KEY_SELECT);
 check(bx_v2_input(&m,BX_KEY_SELECT).action==BX_ACT_UNAVAILABLE,
       "planned game option disabled");
 check(bx_v2_current_feature(&m)==2,"planned option feature mapped");
 char small[5]={'q','q','q','q','Z'};
 check(bx_v2_render(&m,small,4)>0&&small[3]=='\0'&&small[4]=='Z',
       "bounded formatting");
 bx_v2_input(&m,BX_KEY_TOGGLE);
 check(!m.opened,"close menu");
 check(bx_v2_render(NULL,text,sizeof(text))<0,"null state");
 check(bx_v2_render(&m,NULL,sizeof(text))<0,"null output");
 check(bx_v2_render(&m,text,0)<0,"zero capacity");
}
static void stress(void){
 BxMenuV2 m;bx_v2_reset(&m);
 uint32_t random=0x12345678u;
 for(int i=0;i<200000;++i){
  random=random*1664525u+1013904223u;
  BxKey key=(BxKey)(random%7);
  (void)bx_v2_input(&m,key);
  bounds(&m);
 }
}
int main(void){
 catalog_test();navigation();stress();
 printf("PASS: v1.1 10 sections, 33 groups, 190 options, 200k event stress, %d assertions\n",checks);
 return 0;
}
