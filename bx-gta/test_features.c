#include "feature_catalog.h"
#include "profile.h"
#include "palette.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

static int checks=0;
static void require(int yes,const char *msg) {
    ++checks;
    if(!yes){fprintf(stderr,"FAILED %d: %s\n",checks,msg);exit(1);}
}
int main(void) {
    BxPreferences a,b;
    bx_prefs_defaults(&a);
    require(bx_feature_count()==28,"all 28 requested features registered");
    require(bx_feature_at(28)==NULL,"invalid feature rejected");
    require(bx_feature_at(0)->status==BX_PLANNED,"overlay not misrepresented");
    require(bx_feature_at(5)->status==BX_DIAG_READY,"GoldHEN diagnostic");
    require(bx_feature_at(18)->status==BX_PLANNED,"server permissions still planned");
    int ids[28]={0};
    require(bx_feature_find("VeIcUlo",ids,28)>=2,"case-insensitive search");
    require(bx_feature_find("camera",ids,28)>=2,"category search");
    require(bx_feature_find("teleporte",ids,28)==1 && ids[0]==4,"exact match");
    require(bx_feature_find(NULL,ids,28)==0,"null query");
    require(bx_feature_find("irrelevante",ids,28)==0,"missing query");
    require(bx_prefs_set_theme(&a,3)==0,"theme set");
    require(bx_prefs_set_theme(&a,4)<0,"invalid theme");
    require(bx_prefs_set_accent(&a,5)==0,"accent set");
    require(bx_prefs_set_accent(&a,6)<0,"invalid accent");
    require(bx_prefs_set_slot(&a,2)==0,"slot 2");
    require(bx_prefs_set_slot(&a,3)<0,"invalid slot");
    require(!strcmp(bx_theme_name(a.theme),"Contraste"),"theme name");
    require(!strcmp(bx_accent_name(a.accent),"Vermelho Claro"),"accent name");
    BxPalette pal=bx_palette_select(a.theme,a.accent);
    require(pal.panel==0x000000FFu && pal.highlight==0xFF9E9EFFu,"palette token values");
    for(int i=0;i<28;i++)require(bx_prefs_toggle_favorite(&a,i)==1,"favorite set");
    for(int i=0;i<28;i++)require(bx_prefs_is_favorite(&a,i),"favorite retained");
    require(bx_prefs_toggle_favorite(&a,4)==0,"favorite unset");
    require(bx_prefs_toggle_favorite(&a,-1)==-1,"invalid favorite");
    for(int i=0;i<28;i++)require(bx_prefs_add_recent(&a,i)==0,"recent history insert");
    require(a.recent_count==8 && a.recent[0]==27 && a.recent[7]==20,"history rollover");
    require(bx_prefs_add_recent(&a,23)==0 && a.recent[0]==23 &&
            a.recent[1]==27 && a.recent_count==8,"recent deduplicated");
    memcpy(a.query,"camer",6);
    require(bx_prefs_write(&a,"/tmp/bxgta-profiles-test.ini")==0,"write profile");
    bx_prefs_defaults(&b);
    b.slot=2;
    require(bx_prefs_read(&b,"/tmp/bxgta-profiles-test.ini")==0,"read profile");
    require(b.slot==2 && b.theme==a.theme && b.accent==a.accent &&
            b.favorites==a.favorites && b.recent_count==8 &&
            b.recent[0]==23 && !strcmp(b.query,"camer"),"profile roundtrip");
    FILE *f=fopen("/tmp/bxgta-profiles-test.ini","w");
    require(f!=NULL,"open corrupt profile");
    fputs("BROKEN\n",f);fclose(f);
    BxPreferences before=b;
    require(bx_prefs_read(&b,"/tmp/bxgta-profiles-test.ini")<0,"reject invalid file");
    require(!memcmp(&before,&b,sizeof(b)),"do not modify on invalid load");
    remove("/tmp/bxgta-profiles-test.ini");
    printf("PASS: BX-GTA catalog, themes, favorites, recents and profiles (%d checks)\n",checks);
    return 0;
}
