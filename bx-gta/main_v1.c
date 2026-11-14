/*
 * BX-GTA 1.0 / PS4 / GoldHEN
 * Minimal menu navigation using system notifications.
 * This is NOT a GTA graphics overlay and performs NO game-state modifications.
 * Reference catalog metadata comes from the user's Synapse.rar; no proprietary
 * executable components are included or loaded.
 */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <Common.h>
#include <orbis/Pad.h>
#include <orbis/UserService.h>
#include "plugin_common.h"
#include "GoldHEN.h"
#include "menu_core.h"
#include "menu_v1.h"
#include "synapse_catalog.h"
#include "feature_catalog.h"
#include "profile.h"
#include "palette.h"

#define BX_VERSION "1.0.0"
#define BX_CUSA "CUSA00419"
#define BX_DIR "/data/GoldHEN/BXGTA"
#define BX_ERROR_LOG BX_DIR "/error.log"

attr_public const char *g_pluginName="BXGTA_v1";
attr_public const char *g_pluginDesc="BX-GTA 1.0 minimalist navigable diagnostic and catalog";
attr_public const char *g_pluginAuth="BX-GTA";
attr_public uint32_t g_pluginVersion=0x00010000;

static bool g_running=false;
static bool g_thread_created=false;
static OrbisPthread g_thread;
static BxMenuV1 g_ui;
static BxPreferences g_prefs;
static bool g_dirty=false;
static char g_game_version[32];

static void bx_log(const char *text){
 FILE *f=fopen(BX_ERROR_LOG,"a+");
 if(!f)return;
 if(fseek(f,0,SEEK_END)==0 && ftell(f)>65536L){
  fclose(f);
  (void)rename(BX_ERROR_LOG,BX_DIR "/error.previous.log");
  f=fopen(BX_ERROR_LOG,"w");
  if(!f)return;
 }
 fprintf(f,"[%lld] %s\n",(long long)time(NULL),text?text:"(null)");
 fclose(f);
}
static void bx_profile_path(char *path,size_t n){
 if(path&&n)snprintf(path,n,BX_DIR "/profile%u.ini",g_prefs.slot);
}
static void bx_save(bool notify){
 char path[128]={0};bx_profile_path(path,sizeof(path));
 if(bx_prefs_write(&g_prefs,path)==0){
  g_dirty=false;
  if(notify)Notify(TEX_ICON_SYSTEM,"BX-GTA: perfil %u salvo",g_prefs.slot+1);
 } else {
  bx_log("Falha salvando preferencias");
  if(notify)NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: erro ao salvar perfil");
 }
}
static bool bx_load(bool notify){
 char path[128]={0};bx_profile_path(path,sizeof(path));
 if(bx_prefs_read(&g_prefs,path)==0){
  g_dirty=false;
  if(notify)Notify(TEX_ICON_SYSTEM,"BX-GTA: perfil %u carregado",g_prefs.slot+1);
  return true;
 }
 if(notify)NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: perfil ausente/invalido");
 return false;
}
static void bx_next_profile(void){
 if(g_dirty)bx_save(false);
 unsigned next=(g_prefs.slot+1)%BX_PROFILE_COUNT;
 bx_prefs_defaults(&g_prefs);
 (void)bx_prefs_set_slot(&g_prefs,next);
 if(!bx_load(false)){
  snprintf(g_prefs.query,sizeof(g_prefs.query),"%s","veiculo");
 }
 Notify(TEX_ICON_SYSTEM,"BX-GTA: perfil %u de 3",next+1);
}
static bool bx_check_target(void){
 struct proc_info info={0};
 int32_t rc=sys_sdk_proc_info(&info);
 if(rc!=0){
  bx_log("Erro consultando informacoes do processo");
  NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: falha ao consultar CUSA");
  return false;
 }
 info.titleid[sizeof(info.titleid)-1]='\0';
 info.version[sizeof(info.version)-1]='\0';
 snprintf(g_game_version,sizeof(g_game_version),"%s",info.version);
 if(strcmp(info.titleid,BX_CUSA) ||
    (strcmp(info.version,"1.57") && strcmp(info.version,"01.57"))){
  bx_log("CUSA ou versao GTA nao compativel");
  Notify(TEX_ICON_SYSTEM,"BX-GTA: esperado %s v1.57; detectado %s v%s",
         BX_CUSA,info.titleid,info.version);
  return false;
 }
 bx_log("CUSA00419 v1.57 confirmado");
 return true;
}
static void bx_render(void){
 char text[256]={0};
 if(bx_v1_render(&g_ui,text,sizeof(text))>=0){
  Notify(TEX_ICON_SYSTEM,"%s",text);
 }
}
static void bx_show_favorites(void){
 int total=0,last=-1;
 for(int i=0;i<bx_feature_count();++i)
  if(bx_prefs_is_favorite(&g_prefs,i)){++total;last=i;}
 const BxFeature *f=bx_feature_at(last);
 Notify(TEX_ICON_SYSTEM,"BX-GTA: %d favoritos\n%s",total,
        f?f->name:"Use L1+ESQUERDA no item");
}
static void bx_show_recent(void){
 const BxFeature *f=g_prefs.recent_count ?
  bx_feature_at(g_prefs.recent[0]) : NULL;
 Notify(TEX_ICON_SYSTEM,"BX-GTA: %u recentes\n%s",
        g_prefs.recent_count,f?f->name:"Nenhum item selecionado");
}
static void bx_search(void){
 int ids[28]={0};
 const int n=bx_feature_find(g_prefs.query,ids,28);
 const BxFeature *first=n?bx_feature_at(ids[0]):NULL;
 Notify(TEX_ICON_SYSTEM,"BX-GTA: busca '%s'\n%d resultados: %s",
        g_prefs.query,n,first?first->name:"Nenhum");
}
static void bx_action(BxUiEvent event){
 if(event.feature_id>=0 && event.feature_id<bx_feature_count()){
  (void)bx_prefs_add_recent(&g_prefs,event.feature_id);
  g_dirty=true;
 }
 switch(event.action){
 case BX_ACT_NONE: break;
 case BX_ACT_SUMMARY:
  Notify(TEX_ICON_SYSTEM,"BX-GTA %s\n9 secoes | 28 recursos mapeados\nNavegacao ativa",BX_VERSION);
  break;
 case BX_ACT_FAVORITES: bx_show_favorites();break;
 case BX_ACT_RECENT:bx_show_recent();break;
 case BX_ACT_SEARCH:bx_search();break;
 case BX_ACT_THEME:
  (void)bx_prefs_set_theme(&g_prefs,(g_prefs.theme+1)%4);
  g_dirty=true;
  Notify(TEX_ICON_SYSTEM,"BX-GTA: tema %s\nPaleta para renderizador futuro",
         bx_theme_name(g_prefs.theme));
  break;
 case BX_ACT_ACCENT:
  (void)bx_prefs_set_accent(&g_prefs,(g_prefs.accent+1)%6);
  g_dirty=true;
  Notify(TEX_ICON_SYSTEM,"BX-GTA: destaque %s\nConfiguracao salva no perfil",
         bx_accent_name(g_prefs.accent));
  break;
 case BX_ACT_PROFILE:bx_next_profile();break;
 case BX_ACT_SAVE:bx_save(true);break;
 case BX_ACT_LOAD:(void)bx_load(true);break;
 case BX_ACT_CUSA:
  Notify(TEX_ICON_SYSTEM,"BX-GTA: GTA V %s / %s",
         BX_CUSA,g_game_version);
  break;
 case BX_ACT_GOLDHEN:
  bx_log("Diagnostico solicitado: GoldHEN plugin ativo");
  NotifyStatic(TEX_ICON_SYSTEM,
       "BX-GTA: carregador GoldHEN ativo\nVersao exata nao consultada");
  break;
 case BX_ACT_LOG:
  bx_log("Teste de gravacao do log");
  NotifyStatic(TEX_ICON_SYSTEM,
     "BX-GTA: log em /data/GoldHEN/BXGTA/error.log");
  break;
 case BX_ACT_HELP:
  NotifyStatic(TEX_ICON_SYSTEM,
      "L1+Dir abrir, L1+Esq favorito; setas mover, X entrar, O voltar");
  break;
 case BX_ACT_NOTIFY:
  NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: teste de notificacao OK");
  break;
 case BX_ACT_OPEN_CATALOG:bx_render();break;
 case BX_ACT_CATALOG_INFO:{
  const BxCatalogGroup *g=
      bx_catalog_group((BxLibrary)g_ui.library,g_ui.group);
  if(g)Notify(TEX_ICON_SYSTEM,
      "BX-GTA: %s (%u)\nExemplos: %s, %s\nCatalogo informativo, nao executa spawn",
      g->group,g->total,g->example_a,g->example_b);
  break;
 }
 case BX_ACT_UNAVAILABLE:
  NotifyStatic(TEX_ICON_SYSTEM,
      "BX-GTA: recurso organizado, mas nao conectado ao GTA V");
  break;
 }
}
static void bx_key(BxKey key){
 if(key==BX_KEY_FAVORITE){
  const int feature=bx_v1_current_feature(&g_ui);
  if(feature<0){
   NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: selecione uma opcao para favoritar");
   return;
  }
  const int state=bx_prefs_toggle_favorite(&g_prefs,feature);
  if(state<0)return;
  g_dirty=true;
  bx_save(false);
  const BxFeature *f=bx_feature_at(feature);
  Notify(TEX_ICON_SYSTEM,"BX-GTA: %s\n%s",
       f?f->name:"Opcao",state?"Favorito adicionado":"Favorito removido");
  return;
 }
 const BxUiEvent event=bx_v1_input(&g_ui,key);
 if(event.action!=BX_ACT_NONE)bx_action(event);
 else if(event.changed)bx_render();
}
static uint32_t bx_normalize(uint32_t buttons){
 uint32_t flags=0;
 if(buttons & ORBIS_PAD_BUTTON_L1)flags|=BX_PAD_L1;
 if(buttons & ORBIS_PAD_BUTTON_RIGHT)flags|=BX_PAD_RIGHT;
 if(buttons & ORBIS_PAD_BUTTON_LEFT)flags|=BX_PAD_LEFT;
 if(buttons & ORBIS_PAD_BUTTON_UP)flags|=BX_PAD_UP;
 if(buttons & ORBIS_PAD_BUTTON_DOWN)flags|=BX_PAD_DOWN;
 if(buttons & ORBIS_PAD_BUTTON_CROSS)flags|=BX_PAD_X;
 if(buttons & ORBIS_PAD_BUTTON_CIRCLE)flags|=BX_PAD_O;
 return flags;
}
static int bx_pad_handle(bool *owned){
 int32_t user_id=-1;
 *owned=false;
 if(sceUserServiceGetInitialUser(&user_id)<0)return -1;
 int handle=scePadOpen(user_id,0,0,0);
 if(handle==ORBIS_PAD_ERROR_ALREADY_OPENED)
  handle=scePadGetHandle(user_id,0,0);
 else if(handle>0)*owned=true;
 return handle;
}
static void *bx_controller_thread(void *unused){
 (void)unused;
 OrbisUserServiceInitializeParams params={0};
 params.priority=ORBIS_KERNEL_PRIO_FIFO_LOWEST;
 const int32_t urc=sceUserServiceInitialize(&params);
 const int32_t prc=scePadInit();
 final_printf("[BX-GTA] user init %08x pad init %08x\n",urc,prc);
 BxPadFilter filter;
 bx_pad_reset(&filter);
 int handle=-1, failures=0;
 bool owned=false;
 while(__atomic_load_n(&g_running,__ATOMIC_ACQUIRE)){
  if(handle<=0){
   handle=bx_pad_handle(&owned);
   if(handle<=0){usleep(400000);continue;}
   bx_pad_reset(&filter);
   failures=0;
  }
  OrbisPadData data={0};
  int32_t rc=scePadReadState(handle,&data);
  if(rc==0&&data.connected){
   failures=0;
   const uint32_t normalized=bx_normalize(data.buttons);
   BxKey key=bx_pad_next(&filter,normalized);
   if(key!=BX_KEY_NONE)bx_key(key);
  }else{
   bx_pad_reset(&filter);
   if(++failures>=20){
    if(owned&&handle>0)(void)scePadClose(handle);
    handle=-1;
    owned=false;
    failures=0;
    bx_log("Controle desconectado / falha de leitura");
   }
  }
  usleep(60000);
 }
 if(owned&&handle>0)(void)scePadClose(handle);
 return NULL;
}
int32_t attr_public plugin_load(int32_t argc,const char *argv[]){
 (void)argc;(void)argv;
 NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA v1.0: plugin carregado");
 bx_v1_reset(&g_ui);
 bx_prefs_defaults(&g_prefs);
 snprintf(g_prefs.query,sizeof(g_prefs.query),"%s","veiculo");
 (void)sceKernelMkdir(BX_DIR,0777);
 (void)bx_load(false);
 bx_log("Plugin BX-GTA v1.0 carregado");
 if(!bx_check_target())return 0;
 __atomic_store_n(&g_running,true,__ATOMIC_RELEASE);
 const int32_t rc=scePthreadCreate(&g_thread,NULL,bx_controller_thread,
                                  NULL,"bx_gta_input");
 if(rc!=0){
  __atomic_store_n(&g_running,false,__ATOMIC_RELEASE);
  bx_log("Erro: thread controle nao iniciou");
  Notify(TEX_ICON_SYSTEM,"BX-GTA: falha thread de controle: %d",rc);
  return 0;
 }
 g_thread_created=true;
 NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA v1.0: L1 + DIREITA para abrir");
 return 0;
}
int32_t attr_public plugin_unload(int32_t argc,const char *argv[]){
 (void)argc;(void)argv;
 __atomic_store_n(&g_running,false,__ATOMIC_RELEASE);
 if(g_thread_created){
  (void)scePthreadJoin(g_thread,NULL);
  g_thread_created=false;
 }
 if(g_dirty)bx_save(false);
 bx_log("Plugin descarregado");
 return 0;
}
int32_t attr_module_hidden module_start(int64_t argc,const void *args){
 (void)argc;(void)args;return 0;
}
int32_t attr_module_hidden module_stop(int64_t argc,const void *args){
 (void)argc;(void)args;return 0;
}
