#include "menu_v1.h"
#include <stdio.h>

#define CATALOG(lib) BX_ACT_OPEN_CATALOG,(lib),-1
#define READY(cmd,id) (cmd),-1,(id)
#define PLANNED(id) BX_ACT_UNAVAILABLE,-1,(id)
#define COUNT_OF(a) (int)(sizeof(a)/sizeof(a[0]))
static const BxOption home[]={
 {"Resumo",READY(BX_ACT_SUMMARY,5)},
 {"Favoritos",READY(BX_ACT_FAVORITES,16)},
 {"Historico",READY(BX_ACT_RECENT,16)},
 {"Pesquisa",READY(BX_ACT_SEARCH,15)}
};
static const BxOption player[]={
 {"Modelos e personagens",CATALOG(BX_LIB_MODELS)},
 {"Animacoes",CATALOG(BX_LIB_ANIMATIONS)},
 {"Cenarios",CATALOG(BX_LIB_SCENARIOS)},
 {"Roupas e aparencia",PLANNED(2)},
 {"Gestos",PLANNED(13)},
 {"Presets",PLANNED(12)}
};
static const BxOption vehicles[]={
 {"Catalogo de veiculos",CATALOG(BX_LIB_VEHICLES)},
 {"Oficina / rodas e cores",PLANNED(8)},
 {"Reparar veiculo",PLANNED(9)},
 {"Garagem",PLANNED(10)},
 {"Velocimetro",PLANNED(11)}
};
static const BxOption map[]={
 {"Teleporte por marcador",PLANNED(4)},
 {"Locais favoritos",PLANNED(25)},
 {"Marcadores",PLANNED(27)},
 {"Lista de teleporte (vazia)",PLANNED(4)}
};
static const BxOption world[]={
 {"Clima e hora",PLANNED(26)},
 {"Objetos do mundo",CATALOG(BX_LIB_OBJECTS)},
 {"Particulas e efeitos",CATALOG(BX_LIB_PARTICLES)},
 {"Hora congelada",PLANNED(26)}
};
static const BxOption visual[]={
 {"Camera livre",PLANNED(24)},
 {"Presets cinematograficos",PLANNED(21)},
 {"Filtros",PLANNED(22)},
 {"Ocultar HUD",PLANNED(23)},
 {"Painel grafico",PLANNED(0)}
};
static const BxOption library[]={
 {"Veiculos",CATALOG(BX_LIB_VEHICLES)},
 {"Personagens",CATALOG(BX_LIB_MODELS)},
 {"Objetos",CATALOG(BX_LIB_OBJECTS)},
 {"Animacoes",CATALOG(BX_LIB_ANIMATIONS)},
 {"Cenarios",CATALOG(BX_LIB_SCENARIOS)},
 {"Particulas",CATALOG(BX_LIB_PARTICLES)}
};
static const BxOption settings[]={
 {"Tema",READY(BX_ACT_THEME,1)},
 {"Cor de destaque",READY(BX_ACT_ACCENT,1)},
 {"Trocar perfil",READY(BX_ACT_PROFILE,20)},
 {"Salvar configuracao",READY(BX_ACT_SAVE,17)},
 {"Recarregar",READY(BX_ACT_LOAD,17)},
 {"Scripts Lua",PLANNED(19)},
 {"Servidor privado",PLANNED(18)}
};
static const BxOption diagnostics[]={
 {"Status do GoldHEN",READY(BX_ACT_GOLDHEN,5)},
 {"Jogo / CUSA",READY(BX_ACT_CUSA,6)},
 {"Registro de erros",READY(BX_ACT_LOG,7)},
 {"Como usar",READY(BX_ACT_HELP,5)},
 {"Testar notificacoes",READY(BX_ACT_NOTIFY,5)}
};
typedef struct { const char *title; const BxOption *options; int count; } BxSection;
static const BxSection sections[]={
 {"Inicio",home,COUNT_OF(home)},
 {"Jogador",player,COUNT_OF(player)},
 {"Veiculos",vehicles,COUNT_OF(vehicles)},
 {"Mapa",map,COUNT_OF(map)},
 {"Mundo",world,COUNT_OF(world)},
 {"Camera e visual",visual,COUNT_OF(visual)},
 {"Biblioteca",library,COUNT_OF(library)},
 {"Configuracoes",settings,COUNT_OF(settings)},
 {"Diagnostico",diagnostics,COUNT_OF(diagnostics)}
};
int bx_v1_section_count(void){return COUNT_OF(sections);}
const char *bx_v1_section_title(int section){
 return section>=0&&section<COUNT_OF(sections)?sections[section].title:"Invalido";
}
int bx_v1_option_count(int section){
 return section>=0&&section<COUNT_OF(sections)?sections[section].count:0;
}
const BxOption *bx_v1_option(int section,int index){
 if(section<0||section>=COUNT_OF(sections)||index<0||index>=sections[section].count)return NULL;
 return &sections[section].options[index];
}
void bx_v1_reset(BxMenuV1 *state){
 if(!state)return;
 *state=(BxMenuV1){0,0,0,0,0,-1};
}
int bx_v1_current_feature(const BxMenuV1 *s){
 if(!s||!s->opened||s->depth!=1)return -1;
 const BxOption *option=bx_v1_option(s->section,s->option);
 return option?option->feature_id:-1;
}
BxUiEvent bx_v1_input(BxMenuV1 *s,BxKey key){
 BxUiEvent event={0,BX_ACT_NONE,-1};
 if(!s)return event;
 if(key==BX_KEY_TOGGLE){
  s->opened=!s->opened;
  if(!s->opened)s->depth=0;
  event.changed=1;
  return event;
 }
 if(!s->opened)return event;
 if(key==BX_KEY_BACK){
  if(s->depth>0)--s->depth;
  else s->opened=0;
  event.changed=1;
  return event;
 }
 if(key==BX_KEY_UP||key==BX_KEY_DOWN){
  int count=s->depth==0?bx_v1_section_count():
            s->depth==1?bx_v1_option_count(s->section):
            bx_catalog_group_count((BxLibrary)s->library);
  if(count<1)return event;
  int *idx=s->depth==0?&s->section:s->depth==1?&s->option:&s->group;
  *idx=(*idx+(key==BX_KEY_UP?count-1:1))%count;
  if(s->depth==0)s->option=0;
  if(s->depth==1)s->group=0;
  event.changed=1;
  return event;
 }
 if(key==BX_KEY_SELECT){
  if(s->depth==0){s->depth=1;s->option=0;event.changed=1;return event;}
  if(s->depth==2){
   event.action=BX_ACT_CATALOG_INFO;
   event.changed=1;
   return event;
  }
  const BxOption *item=bx_v1_option(s->section,s->option);
  if(!item)return event;
  event.action=item->action;
  event.feature_id=item->feature_id;
  event.changed=1;
  if(item->action==BX_ACT_OPEN_CATALOG){
   s->depth=2;
   s->library=item->library;
   s->group=0;
  }
 }
 return event;
}
int bx_v1_render(const BxMenuV1 *s,char *out,size_t cap){
 if(!s||!out||cap==0)return -1;
 if(!s->opened)return snprintf(out,cap,"BX-GTA | Menu fechado");
 if(s->section<0||s->section>=bx_v1_section_count())
  return snprintf(out,cap,"BX-GTA | secao invalida");
 if(s->depth==0){
  const char *prev=bx_v1_section_title((s->section+bx_v1_section_count()-1)%bx_v1_section_count());
  const char *next=bx_v1_section_title((s->section+1)%bx_v1_section_count());
  return snprintf(out,cap,"BX-GTA | MENU\n  %s\n> %s (%d/%d)\n  %s",
                  prev,bx_v1_section_title(s->section),s->section+1,bx_v1_section_count(),next);
 }
 if(s->depth==1){
  const BxOption *item=bx_v1_option(s->section,s->option);
  if(!item)return snprintf(out,cap,"BX-GTA | opcao invalida");
  const int count=bx_v1_option_count(s->section);
  const BxOption *prev=bx_v1_option(s->section,(s->option+count-1)%count);
  const BxOption *next=bx_v1_option(s->section,(s->option+1)%count);
  return snprintf(out,cap,"BX-GTA / %s\n  %s\n> %s (%d/%d)\n  %s%s",
    bx_v1_section_title(s->section),prev->title,item->title,s->option+1,count,
    next->title,item->action==BX_ACT_UNAVAILABLE?" [em breve]":"");
 }
 if(s->depth==2){
  const BxCatalogGroup *g=bx_catalog_group((BxLibrary)s->library,s->group);
  if(!g)return snprintf(out,cap,"BX-GTA | grupo invalido");
  return snprintf(out,cap,"BX-GTA / %s\n> %s (%d/%d)\n%u nomes catalogados\nEx: %s, %s",
    bx_catalog_title((BxLibrary)s->library),g->group,s->group+1,
    bx_catalog_group_count((BxLibrary)s->library),
    g->total,g->example_a,g->example_b);
 }
 return snprintf(out,cap,"BX-GTA | tela invalida");
}
