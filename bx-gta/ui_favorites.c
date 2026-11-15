#include "ui_favorites.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

static int valid(int id){return id>=0&&id<BX_UI_OPTION_CAP;}
void bx_ui_defaults(BxUiFavorites *p){
 if(!p)return;
 memset(p,0,sizeof(*p));
 for(int i=0;i<BX_UI_RECENT_CAP;++i)p->recent[i]=-1;
}
int bx_ui_is_favorite(const BxUiFavorites *p,int id){
 return p&&valid(id)?!!p->favorite[id]:0;
}
int bx_ui_toggle(BxUiFavorites *p,int id){
 if(!p||!valid(id))return -1;
 p->favorite[id]=!p->favorite[id];
 return (int)p->favorite[id];
}
int bx_ui_count(const BxUiFavorites *p){
 if(!p)return 0;
 int total=0;
 for(int id=0;id<BX_UI_OPTION_CAP;++id)total+=!!p->favorite[id];
 return total;
}
int bx_ui_add_recent(BxUiFavorites *p,int id){
 if(!p||!valid(id)||p->recent_count>BX_UI_RECENT_CAP)return -1;
 unsigned index=0;
 while(index<p->recent_count&&p->recent[index]!=id)++index;
 if(index>=BX_UI_RECENT_CAP)index=BX_UI_RECENT_CAP-1;
 for(unsigned n=index;n>0;--n)p->recent[n]=p->recent[n-1];
 p->recent[0]=id;
 if(p->recent_count<BX_UI_RECENT_CAP)++p->recent_count;
 return 0;
}
static int sane(const BxUiFavorites *p){
 if(!p||p->recent_count>BX_UI_RECENT_CAP)return 0;
 for(int id=0;id<BX_UI_OPTION_CAP;++id)
  if(p->favorite[id]>1)return 0;
 for(unsigned i=0;i<p->recent_count;++i){
  if(!valid(p->recent[i]))return 0;
  for(unsigned j=0;j<i;++j)if(p->recent[i]==p->recent[j])return 0;
 }
 return 1;
}
int bx_ui_write(const BxUiFavorites *p,const char *path){
 if(!sane(p)||!path||!*path)return -1;
 char tmp[256];
 int n=snprintf(tmp,sizeof(tmp),"%s.tmp",path);
 if(n<1||(size_t)n>=sizeof(tmp))return -1;
 FILE *f=fopen(tmp,"w");
 if(!f)return -1;
 int ok=fputs("BXGTA_OPTIONS_V1\n",f)>=0;
 ok=ok&&fputs("favorites=",f)>=0;
 for(int i=0;ok&&i<BX_UI_OPTION_CAP;++i)
  ok=fputc(p->favorite[i]?'1':'0',f)!=EOF;
 ok=ok&&fputs("\nrecent=",f)>=0;
 for(unsigned i=0;ok&&i<p->recent_count;++i)
  ok=fprintf(f,"%s%d",i?",":"",p->recent[i])>0;
 ok=ok&&fputc('\n',f)!=EOF;
 if(fflush(f)!=0)ok=0;
 if(fclose(f)!=0)ok=0;
 if(!ok||rename(tmp,path)!=0){(void)remove(tmp);return -1;}
 return 0;
}
static void chop(char *line){
 size_t len=strlen(line);
 while(len&&(line[len-1]=='\r'||line[len-1]=='\n'))
  line[--len]='\0';
}
int bx_ui_read(BxUiFavorites *p,const char *path){
 if(!p||!path)return -1;
 FILE *f=fopen(path,"r");
 if(!f)return -1;
 char line[256];
 BxUiFavorites found;
 bx_ui_defaults(&found);
 if(!fgets(line,sizeof(line),f))goto bad;
 chop(line);
 if(strcmp(line,"BXGTA_OPTIONS_V1"))goto bad;
 if(!fgets(line,sizeof(line),f))goto bad;
 chop(line);
 if(strncmp(line,"favorites=",10))goto bad;
 const char *flags=line+10;
 if(strlen(flags)!=BX_UI_OPTION_CAP)goto bad;
 for(int id=0;id<BX_UI_OPTION_CAP;++id){
  if(flags[id]!='0'&&flags[id]!='1')goto bad;
  found.favorite[id]=(unsigned char)(flags[id]-'0');
 }
 if(!fgets(line,sizeof(line),f))goto bad;
 chop(line);
 if(strncmp(line,"recent=",7))goto bad;
 char *cur=line+7;
 while(*cur){
  if(found.recent_count>=BX_UI_RECENT_CAP ||
     !isdigit((unsigned char)*cur))goto bad;
  char *end=NULL;
  unsigned long value=strtoul(cur,&end,10);
  if(end==cur||value>=BX_UI_OPTION_CAP)goto bad;
  int id=(int)value;
  for(unsigned i=0;i<found.recent_count;++i)
   if(found.recent[i]==id)goto bad;
  found.recent[found.recent_count++]=id;
  if(*end=='\0')break;
  if(*end!=','||!end[1])goto bad;
  cur=end+1;
 }
 if(fgets(line,sizeof(line),f))goto bad;
 if(ferror(f)||!sane(&found))goto bad;
 fclose(f);
 *p=found;
 return 0;
bad:
 fclose(f);
 return -1;
}
