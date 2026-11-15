#include "ui_favorites.h"
#include "menu_v2.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int checks;
static void require(int cond,const char *message){
 ++checks;
 if(!cond){fprintf(stderr,"FAIL %d: %s\n",checks,message);exit(1);}
}
static void file_roundtrip(void){
 const char *path="/tmp/bxgta-options-test.txt";
 BxUiFavorites a,b;
 bx_ui_defaults(&a);
 for(int id=0;id<BX_UI_OPTION_CAP;++id){
  require(bx_ui_toggle(&a,id)==1,"favorites add");
  require(bx_ui_is_favorite(&a,id)==1,"favorite unique");
 }
 require(bx_ui_count(&a)==190,"all 190 items favorited");
 require(bx_ui_toggle(&a,33)==0,"toggle single favorite off");
 require(bx_ui_count(&a)==189,"independent item count");
 require(bx_ui_is_favorite(&a,34)==1,"neighbor not affected");
 require(bx_ui_toggle(&a,-1)==-1,"reject negative favorite");
 require(bx_ui_toggle(&a,190)==-1,"reject out-of-range favorite");
 for(int id=0;id<190;++id)
  require(bx_ui_add_recent(&a,id)==0,"record recent ID");
 require(a.recent_count==BX_UI_RECENT_CAP,"history capped");
 require(a.recent[0]==189&&a.recent[11]==178,"recent rollover");
 require(bx_ui_add_recent(&a,183)==0,"duplicate recent moved forward");
 require(a.recent[0]==183&&a.recent[1]==189&&a.recent_count==12,
         "recent unique");
 require(bx_ui_write(&a,path)==0,"save 190 option profile");
 bx_ui_defaults(&b);
 require(bx_ui_read(&b,path)==0,"load 190 option profile");
 require(bx_ui_count(&b)==189 && b.favorite[33]==0 && b.favorite[34]==1,
         "roundtrip distinct options");
 require(b.recent[0]==183&&b.recent[1]==189,"roundtrip history");
 BxUiFavorites prior=b;
 FILE *f=fopen(path,"w");require(f!=NULL,"create bad file");
 fputs("BXGTA_OPTIONS_V1\nfavorites=abc\nrecent=1,2\n",f);
 fclose(f);
 require(bx_ui_read(&b,path)==-1,"reject truncated flags");
 require(!memcmp(&b,&prior,sizeof(b)),"reject without overwriting memory");
 f=fopen(path,"w");require(f!=NULL,"rewrite bad file");
 fprintf(f,"BXGTA_OPTIONS_V1\nfavorites=");
 for(int id=0;id<190;++id)fputc('0',f);
 fprintf(f,"\nrecent=8,8\n");
 fclose(f);
 require(bx_ui_read(&b,path)==-1,"reject duplicate recent IDs");
 require(!memcmp(&b,&prior,sizeof(b)),"original preserved on invalid recent");
 require(bx_ui_read(NULL,path)==-1,"null prefs");
 require(bx_ui_write(NULL,path)==-1,"null write");
 remove(path);
}
static void option_mapping(void){
 require(BX_UI_OPTION_CAP==bx_v2_total_options(),"persistent capacity matches catalog");
 int expected=0;
 for(int s=0;s<bx_v2_section_count();++s){
  for(int g=0;g<bx_v2_subgroup_count(s);++g){
   for(int i=0;i<bx_v2_option_count(s,g);++i){
    const int id=bx_v2_option_id(s,g,i);
    require(id==expected,"contiguous unique option ID");
    const BxOption *direct=bx_v2_option(s,g,i);
    require(direct!=NULL&&bx_v2_option_by_id(id)==direct,"option lookup inverse");
    ++expected;
   }
  }
 }
 require(expected==190,"190 unique option IDs");
 require(bx_v2_option_id(-1,0,0)<0,"invalid section");
 require(bx_v2_option_id(0,-1,0)<0,"invalid subgroup");
 require(bx_v2_option_id(0,0,500)<0,"invalid option");
 require(bx_v2_option_by_id(190)==NULL,"invalid global id");
 BxMenuV2 m;bx_v2_reset(&m);
 require(bx_v2_current_option_id(&m)==-1,"no selected item while closed");
 bx_v2_input(&m,BX_KEY_TOGGLE);
 bx_v2_input(&m,BX_KEY_SELECT);
 bx_v2_input(&m,BX_KEY_SELECT);
 require(bx_v2_current_option_id(&m)==0,"first global option");
 bx_v2_input(&m,BX_KEY_DOWN);
 require(bx_v2_current_option_id(&m)==1,"second global option");
 bx_v2_input(&m,BX_KEY_BACK);
 require(bx_v2_current_option_id(&m)==-1,"no item in subgroup list");
}
int main(void){
 option_mapping();file_roundtrip();
 printf("PASS: 190 unique option IDs, favorites, history, profile corruption tests (%d checks)\n",checks);
 return 0;
}
