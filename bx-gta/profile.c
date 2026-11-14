#include "profile.h"
#include "feature_catalog.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define BX_THEME_COUNT 4
#define BX_ACCENT_COUNT 6
#define BX_FILE_LIMIT 1024

void bx_prefs_defaults(BxPreferences *prefs) {
    if (!prefs) return;
    memset(prefs, 0, sizeof(*prefs));
    for (int i=0;i<BX_RECENT_CAP;i++) prefs->recent[i] = -1;
}
int bx_prefs_set_theme(BxPreferences *p, unsigned v) {
    if (!p || v >= BX_THEME_COUNT) return -1;
    p->theme=v;
    return 0;
}
int bx_prefs_set_accent(BxPreferences *p, unsigned v) {
    if (!p || v >= BX_ACCENT_COUNT) return -1;
    p->accent=v;
    return 0;
}
int bx_prefs_set_slot(BxPreferences *p, unsigned v) {
    if (!p || v >= BX_PROFILE_COUNT) return -1;
    p->slot=v;
    return 0;
}
static int valid_id(int id) { return id >= 0 && id < bx_feature_count() && id < 32; }
int bx_prefs_is_favorite(const BxPreferences *p, int id) {
    return p && valid_id(id) && !!(p->favorites & ((uint32_t)1u<<id));
}
int bx_prefs_toggle_favorite(BxPreferences *p, int id) {
    if (!p || !valid_id(id)) return -1;
    p->favorites ^= (uint32_t)1u<<id;
    return bx_prefs_is_favorite(p,id);
}
int bx_prefs_add_recent(BxPreferences *p, int id) {
    if (!p || !valid_id(id)) return -1;
    unsigned index=0;
    while (index<p->recent_count && p->recent[index]!=id) ++index;
    if (index>=BX_RECENT_CAP) index=BX_RECENT_CAP-1;
    for (unsigned i=index;i>0;--i) p->recent[i]=p->recent[i-1];
    p->recent[0]=id;
    if(p->recent_count<BX_RECENT_CAP) ++p->recent_count;
    return 0;
}
int bx_prefs_write(const BxPreferences *p, const char *path) {
    if (!p || !path || !*path || p->theme>=BX_THEME_COUNT ||
        p->accent>=BX_ACCENT_COUNT || p->slot>=BX_PROFILE_COUNT) return -1;
    char temp[256];
    int n=snprintf(temp,sizeof(temp),"%s.tmp",path);
    if(n<1 || (size_t)n>=sizeof(temp))return -1;
    FILE *f=fopen(temp,"w");
    if(!f)return -1;
    int ok=1;
    ok &= fprintf(f,"BXGTA_PROFILE_V1\n")>0;
    ok &= fprintf(f,"theme=%u\naccent=%u\nfavorites=%08x\n",
                  p->theme,p->accent,(unsigned)p->favorites)>0;
    ok &= fprintf(f,"recent=")>0;
    for(unsigned i=0;i<p->recent_count && i<BX_RECENT_CAP;i++) {
        if(!valid_id(p->recent[i])) {ok=0;break;}
        ok &= fprintf(f,"%s%d",i?",":"",p->recent[i])>0;
    }
    ok &= fprintf(f,"\nquery=%s\n",p->query)>0;
    if(fflush(f)!=0)ok=0;
    if(fclose(f)!=0)ok=0;
    if(!ok || rename(temp,path)!=0) {
        remove(temp);
        return -1;
    }
    return 0;
}
static void trim(char *s){
    size_t n=strlen(s);
    while(n && (s[n-1]=='\n'||s[n-1]=='\r'||isspace((unsigned char)s[n-1])))
        s[--n]='\0';
}
static int parse_unsigned(const char *text, unsigned *out, int base) {
    if(!text || !*text || isspace((unsigned char)*text)|| *text=='-' || *text=='+')
        return -1;
    char *end=NULL;
    unsigned long v=strtoul(text,&end,base);
    if(!end || *end || v>0xffffffffUL) return -1;
    *out=(unsigned)v;
    return 0;
}
int bx_prefs_read(BxPreferences *prefs, const char *path) {
    if(!prefs || !path)return -1;
    FILE *f=fopen(path,"r");
    if(!f)return -1;
    char line[256];
    BxPreferences next;
    bx_prefs_defaults(&next);
    next.slot=prefs->slot; /* slot is controlled by caller, not file contents */
    if(!fgets(line,sizeof(line),f)) {fclose(f);return -1;}
    trim(line);
    if(strcmp(line,"BXGTA_PROFILE_V1")) {fclose(f);return -1;}
    unsigned readfields=0;
    size_t total=strlen(line);
    while(fgets(line,sizeof(line),f)) {
        total+=strlen(line);
        if(total>BX_FILE_LIMIT) {fclose(f);return -1;}
        trim(line);
        char *eq=strchr(line,'=');
        if(!eq) {fclose(f);return -1;}
        *eq++='\0';
        unsigned v=0;
        if(!strcmp(line,"theme")){
            if(parse_unsigned(eq,&v,10)||bx_prefs_set_theme(&next,v))break;
            readfields|=1;
        } else if(!strcmp(line,"accent")){
            if(parse_unsigned(eq,&v,10)||bx_prefs_set_accent(&next,v))break;
            readfields|=2;
        } else if(!strcmp(line,"favorites")){
            if(parse_unsigned(eq,&v,16))break;
            if(bx_feature_count()<32 && (v>>bx_feature_count()))break;
            next.favorites=(uint32_t)v;
            readfields|=4;
        } else if(!strcmp(line,"recent")){
            if(*eq) {
                char *cursor=eq;
                for(;;) {
                    char *comma=strchr(cursor,',');
                    if(comma)*comma='\0';
                    if(parse_unsigned(cursor,&v,10)|| !valid_id((int)v) ||
                       next.recent_count>=BX_RECENT_CAP) goto invalid;
                    for(unsigned i=0;i<next.recent_count;++i)
                        if(next.recent[i]==(int)v)goto invalid;
                    next.recent[next.recent_count++]=(int)v;
                    if(!comma) break;
                    cursor=comma+1;
                }
            }
            readfields|=8;
        } else if(!strcmp(line,"query")){
            if(strlen(eq)>=BX_QUERY_CAP)break;
            for(char *c=eq;*c;++c)
                if(!isalnum((unsigned char)*c)&&*c!=' '&&*c!='-'&&*c!='_')
                    goto invalid;
            snprintf(next.query,sizeof(next.query),"%s",eq);
            readfields|=16;
        } else {break;}
        continue;
invalid:
        fclose(f);
        return -1;
    }
    if(ferror(f)){fclose(f);return -1;}
    fclose(f);
    if(readfields!=31)return -1;
    *prefs=next;
    return 0;
}
