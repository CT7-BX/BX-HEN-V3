/*
 * BX-GTA v0.9: profiles, favorites, indexed search and diagnostics.
 * Navigates through GoldHEN system notifications; NOT a graphical overlay
 * and does not alter GTA V game state or private-server state.
 */
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <sys/stat.h>
#include <Common.h>
#include <orbis/Pad.h>
#include <orbis/UserService.h>
#include "plugin_common.h"
#include "GoldHEN.h"
#include "menu_core.h"
#include "feature_catalog.h"
#include "profile.h"
#include "palette.h"

#define BX_VERSION "0.9.0"
#define BX_DIR "/data/GoldHEN/BXGTA"
#define BX_LOG_PATH BX_DIR "/error.log"
#define BX_TITLE "CUSA00419"
#define BX_COMBO (ORBIS_PAD_BUTTON_L1 | ORBIS_PAD_BUTTON_RIGHT)

attr_public const char *g_pluginName = "BXGTA_menu";
attr_public const char *g_pluginDesc = "BX-GTA v0.9 profiles and notification menu (no gameplay edits)";
attr_public const char *g_pluginAuth = "BX-GTA";
attr_public uint32_t g_pluginVersion = 0x00000900;

static bool g_running = false;
static bool g_thread_created = false;
static OrbisPthread g_thread;
static BxMenu g_menu;
static char g_detected_version[32];
static BxPreferences g_prefs;
static bool g_prefs_dirty = false;


static void bx_log(const char *event) {
    FILE *f = fopen(BX_LOG_PATH, "a+");
    if (!f) {
        final_printf("[BX-GTA] unable to write error log\n");
        return;
    }
    (void)fseek(f, 0, SEEK_END);
    if (ftell(f) > 65536L) {
        fclose(f);
        (void)rename(BX_LOG_PATH, BX_DIR "/error.previous.log");
        f=fopen(BX_LOG_PATH, "w");
        if (!f) return;
    }
    fprintf(f, "[%lld] %s\n", (long long)time(NULL), event ? event : "(unknown)");
    fclose(f);
}
static void bx_profile_path(char *out, size_t size) {
    if(!out || !size) return;
    snprintf(out, size, BX_DIR "/profile%u.ini", g_prefs.slot);
}
static void bx_save_prefs(bool notify) {
    char path[128]={0};
    bx_profile_path(path,sizeof(path));
    if (bx_prefs_write(&g_prefs,path)==0) {
        g_prefs_dirty=false;
        if(notify) Notify(TEX_ICON_SYSTEM, "BX-GTA: perfil %u salvo",g_prefs.slot+1);
    } else {
        bx_log("ERRO: falha ao salvar perfil");
        if(notify) NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: erro ao salvar perfil");
    }
}
static bool bx_load_prefs(bool notify) {
    char path[128]={0};
    bx_profile_path(path,sizeof(path));
    const bool loaded=bx_prefs_read(&g_prefs,path)==0;
    if(!loaded) {
        bx_log("Perfil nao encontrado ou invalido; mantendo preferencias atuais");
        if(notify) NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: perfil ausente/invalido");
    } else if(notify) {
        Notify(TEX_ICON_SYSTEM,"BX-GTA: perfil %u carregado",g_prefs.slot+1);
    }
    return loaded;
}
static void bx_next_profile(void) {
    bx_save_prefs(false);
    const unsigned slot=(g_prefs.slot+1)%BX_PROFILE_COUNT;
    bx_prefs_defaults(&g_prefs);
    (void)bx_prefs_set_slot(&g_prefs,slot);
    if(!bx_load_prefs(false)) {
        snprintf(g_prefs.query,sizeof(g_prefs.query),"%s","camera");
        g_prefs_dirty=true;
    }
    Notify(TEX_ICON_SYSTEM,"BX-GTA: perfil %u / 3",slot+1);
}
static int bx_feature_for_selection(int category,int item) {
    if(category==0) {
        if(item==7)return 5;
        if(item==8)return 7;
        if(item==9 || item==10)return 17;
        if(item==11)return 20;
        if(item==1)return 6;
    } else if(category==1) {
        const int ids[]={2,13,14};
        return item>=0 && item<3?ids[item]:-1;
    } else if(category==2) {
        const int ids[]={3,10,11};
        return item>=0 && item<3?ids[item]:-1;
    } else if(category==3) {
        const int ids[]={25,27,4};
        return item>=0 && item<3?ids[item]:-1;
    } else if(category==4) {
        return 26;
    } else if(category==5) {
        const int ids[]={24,21,22};
        return item>=0 && item<3?ids[item]:-1;
    } else if(category==6) {
        const int ids[]={1,1,20,16,16,15,17,17,0};
        return item>=0 && item<9?ids[item]:-1;
    } else if(category==7) {
        return 18;
    }
    return -1;
}
static void bx_list_favorites(void) {
    int count=0, first=-1;
    for(int i=0;i<bx_feature_count();++i) if(bx_prefs_is_favorite(&g_prefs,i)) {
        ++count;
        if(first<0)first=i;
    }
    if(!count) {
        NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: nenhum favorito; use L1+Esquerda");
        return;
    }
    Notify(TEX_ICON_SYSTEM,"BX-GTA: %d favoritos\nPrimeiro: %s",count,
           bx_feature_at(first)->name);
}
static void bx_list_recent(void) {
    if(!g_prefs.recent_count) {
        NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: nenhuma opcao recente");
        return;
    }
    const BxFeature *f=bx_feature_at(g_prefs.recent[0]);
    Notify(TEX_ICON_SYSTEM,"BX-GTA: %u recentes\nUltimo: %s",g_prefs.recent_count,
           f ? f->name : "indisponivel");
}
static void bx_search(void) {
    if(!g_prefs.query[0]) {
        NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: configure query no perfil.ini via FTP");
        return;
    }
    int ids[28]={0};
    const int count=bx_feature_find(g_prefs.query,ids,28);
    const BxFeature *f=count>0?bx_feature_at(ids[0]):NULL;
    Notify(TEX_ICON_SYSTEM,"BX-GTA: busca '%s' | %d achados\n%s",
           g_prefs.query,count,f?f->name:"Nenhum resultado");
}

static bool target_ok(void) {
    struct proc_info info = {0};
    const int32_t rc = sys_sdk_proc_info(&info);
    if (rc != 0) {
        final_printf("[BX-GTA] proc_info failed: 0x%08x\n", rc);
        NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA: nao foi possivel identificar o jogo");
        return false;
    }
    info.titleid[sizeof(info.titleid)-1] = '\0';
    info.version[sizeof(info.version)-1] = '\0';
    snprintf(g_detected_version, sizeof(g_detected_version), "%s", info.version);
    final_printf("[BX-GTA] detected %s / %s\n", info.titleid, info.version);
    if (strcmp(info.titleid, BX_TITLE) ||
        (strcmp(info.version, "1.57") && strcmp(info.version, "01.57"))) {
        NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA: este PRX exige CUSA00419 v1.57");
        return false;
    }
    return true;
}
static void show_selection(void) {
    char message[256] = {0};
    if (bx_menu_render(&g_menu, message, sizeof(message)) < 0) return;
    Notify(TEX_ICON_SYSTEM, "%s", message);
}
static void on_selection(void) {
    const int id=bx_feature_for_selection(g_menu.category,g_menu.item);
    if(id>=0) {
        (void)bx_prefs_add_recent(&g_prefs,id);
        g_prefs_dirty=true;
    }
    if(!bx_menu_item_implemented(g_menu.category,g_menu.item)) {
        NotifyStatic(TEX_ICON_SYSTEM,
            "BX-GTA: recurso planejado; adaptador GTA/servidor nao integrado");
        return;
    }
    if(g_menu.category==6) {
        switch(g_menu.item) {
            case 0:
                bx_prefs_set_theme(&g_prefs,(g_prefs.theme+1)%4);
                g_prefs_dirty=true;
                Notify(TEX_ICON_SYSTEM,"BX-GTA: tema %s\nDisponivel no futuro painel",
                       bx_theme_name(g_prefs.theme));
                break;
            case 1:
                bx_prefs_set_accent(&g_prefs,(g_prefs.accent+1)%6);
                g_prefs_dirty=true;
                Notify(TEX_ICON_SYSTEM,"BX-GTA: cor %s\nPaleta salva para painel futuro",
                       bx_accent_name(g_prefs.accent));
                break;
            case 2: bx_next_profile(); break;
            case 3: bx_list_favorites(); break;
            case 4: bx_list_recent(); break;
            case 5: bx_search(); break;
            case 6: bx_save_prefs(true); break;
            case 7: (void)bx_load_prefs(true); break;
            case 8: {
                const BxPalette p=bx_palette_select(g_prefs.theme,g_prefs.accent);
                Notify(TEX_ICON_SYSTEM,"BX-GTA: tema %s | %s\nPaleta: %08x",
                       bx_theme_name(g_prefs.theme),bx_accent_name(g_prefs.accent),
                       (unsigned)p.highlight);
                break;
            }
            default: break;
        }
        return;
    }
    if(g_menu.category!=0) {
        NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: recurso sem adaptador funcional");
        return;
    }
    switch(g_menu.item) {
        case 0:
            NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA v0.9: nucleo do menu carregado");
            break;
        case 1:
            Notify(TEX_ICON_SYSTEM,"BX-GTA: %s / GTA V %s",BX_TITLE,g_detected_version);
            break;
        case 2:
            NotifyStatic(TEX_ICON_SYSTEM,
                "L1+Direita abre; L1+Esquerda favorito; setas, X e O navegam");
            break;
        case 3:
            NotifyStatic(TEX_ICON_SYSTEM,
                "Navegacao, perfis e busca: nucleo ativo. GTA/servidor pendentes.");
            break;
        case 4:
            NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA v0.9: notificacao OK");
            break;
        case 5:
            bx_menu_reset(&g_menu);
            bx_menu_input(&g_menu,BX_KEY_TOGGLE);
            show_selection();
            break;
        case 6:
            bx_menu_input(&g_menu,BX_KEY_TOGGLE);
            show_selection();
            break;
        case 7:
            bx_log("Diagnostico GoldHEN solicitado; plugin_load OK");
            NotifyStatic(TEX_ICON_SYSTEM,
                "GoldHEN plugin_load OK; verificacao GTA e controle em andamento");
            break;
        case 8:
            bx_log("Teste de escrita do log solicitado");
            NotifyStatic(TEX_ICON_SYSTEM,
                "BX-GTA: veja /data/GoldHEN/BXGTA/error.log");
            break;
        case 9: bx_save_prefs(true);break;
        case 10:(void)bx_load_prefs(true);break;
        case 11:
            Notify(TEX_ICON_SYSTEM,"BX-GTA: perfil %u / 3\nTema %s | Acento %s",
                   g_prefs.slot+1,bx_theme_name(g_prefs.theme),
                   bx_accent_name(g_prefs.accent));
            break;
        default:break;
    }
}
static void on_key(BxKey key) {
    if(key==BX_KEY_FAVORITE) {
        if(!g_menu.opened || !g_menu.in_category) return;
        const int id=bx_feature_for_selection(g_menu.category,g_menu.item);
        if(id<0) {
            NotifyStatic(TEX_ICON_SYSTEM,"BX-GTA: esta opcao nao tem favorito");
            return;
        }
        const int enabled=bx_prefs_toggle_favorite(&g_prefs,id);
        if(enabled<0) return;
        g_prefs_dirty=true;
        bx_save_prefs(false);
        Notify(TEX_ICON_SYSTEM,"BX-GTA: %s\n%s",
               bx_feature_at(id)->name,enabled?"Favorito adicionado":"Favorito removido");
        return;
    }
    const BxResult result=bx_menu_input(&g_menu,key);
    if(result==BX_NO_CHANGE)return;
    if(result==BX_SELECTED)on_selection();
    else show_selection();
}
static int32_t get_pad_handle(bool *owned) {
    int32_t user_id = -1;
    *owned = false;
    if (sceUserServiceGetInitialUser(&user_id) < 0) return -1;
    int32_t handle = scePadOpen(user_id, 0, 0, 0);
    if (handle == ORBIS_PAD_ERROR_ALREADY_OPENED) {
        handle = scePadGetHandle(user_id, 0, 0);
    } else if (handle > 0) {
        *owned = true;
    }
    return handle;
}
static uint32_t normalize_buttons(uint32_t buttons) {
    uint32_t normalized = 0;
    if (buttons & ORBIS_PAD_BUTTON_L1) normalized |= BX_PAD_L1;
    if (buttons & ORBIS_PAD_BUTTON_RIGHT) normalized |= BX_PAD_RIGHT;
    if (buttons & ORBIS_PAD_BUTTON_LEFT) normalized |= BX_PAD_LEFT;
    if (buttons & ORBIS_PAD_BUTTON_UP) normalized |= BX_PAD_UP;
    if (buttons & ORBIS_PAD_BUTTON_DOWN) normalized |= BX_PAD_DOWN;
    if (buttons & ORBIS_PAD_BUTTON_CROSS) normalized |= BX_PAD_X;
    if (buttons & ORBIS_PAD_BUTTON_CIRCLE) normalized |= BX_PAD_O;
    return normalized;
}
static void *menu_input_thread(void *ignored) {
    (void)ignored;
    OrbisUserServiceInitializeParams params = {0};
    params.priority = ORBIS_KERNEL_PRIO_FIFO_LOWEST;
    const int32_t user_rc = sceUserServiceInitialize(&params);
    const int32_t pad_rc = scePadInit();
    final_printf("[BX-GTA] user init: 0x%08x, pad init: 0x%08x\\n",
                 user_rc, pad_rc);

    bool owned = false;
    int32_t handle = -1;
    int failures = 0;
    BxPadFilter filter;
    bx_pad_reset(&filter);

    while (__atomic_load_n(&g_running, __ATOMIC_ACQUIRE)) {
        if (handle <= 0) {
            handle = get_pad_handle(&owned);
            if (handle <= 0) {
                usleep(400000);
                continue;
            }
            failures = 0;
            bx_pad_reset(&filter);
            final_printf("[BX-GTA] controller handle acquired: %d\\n", handle);
        }
        OrbisPadData data = {0};
        const int32_t rc = scePadReadState(handle, &data);
        if (rc == 0 && data.connected) {
            failures = 0;
            const BxKey key = bx_pad_next(&filter, normalize_buttons(data.buttons));
            if (key != BX_KEY_NONE) on_key(key);
        } else {
            bx_pad_reset(&filter);
            if (++failures >= 20) {
                final_printf("[BX-GTA] controller disconnected/error: %d\\n", rc);
                if (owned && handle > 0) (void)scePadClose(handle);
                handle = -1;
                owned = false;
                failures = 0;
            }
        }
        usleep(60000);
    }
    if (owned && handle > 0) (void)scePadClose(handle);
    final_printf("[BX-GTA] input thread stopped\\n");
    return NULL;
}
int32_t attr_public plugin_load(int32_t argc, const char *argv[]) {
    (void)argc; (void)argv;
    final_printf("[BX-GTA] v%s plugin_load\n", BX_VERSION);
    NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA v0.9: plugin carregado");
    bx_menu_reset(&g_menu);
    (void)sceKernelMkdir(BX_DIR, 0777);
    bx_prefs_defaults(&g_prefs);
    snprintf(g_prefs.query,sizeof(g_prefs.query),"%s","camera");
    (void)bx_load_prefs(false);
    bx_log("BX-GTA v0.9 iniciou");
    if (!target_ok()) {
        bx_log("CUSA ou versao GTA nao conferiu; bloqueando entrada");
        return 0;
    }
    __atomic_store_n(&g_running, true, __ATOMIC_RELEASE);
    int32_t result = scePthreadCreate(&g_thread, NULL, menu_input_thread,
                                    NULL, "bx_gta_menu");
    if (result != 0) {
        __atomic_store_n(&g_running, false, __ATOMIC_RELEASE);
        Notify(TEX_ICON_SYSTEM, "BX-GTA: falha ao iniciar leitura do controle: %d", result);
        final_printf("[BX-GTA] thread failed: %d\n", result);
        bx_log("ERRO: thread do controle nao iniciada");
        return 0;
    }
    g_thread_created = true;
    NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA v0.9: L1 + DIREITA | Favoritos: L1 + ESQUERDA");
    return 0;
}
int32_t attr_public plugin_unload(int32_t argc, const char *argv[]) {
    (void)argc; (void)argv;
    __atomic_store_n(&g_running, false, __ATOMIC_RELEASE);
    if (g_thread_created) {
        (void)scePthreadJoin(g_thread, NULL);
        g_thread_created = false;
    }
    if(g_prefs_dirty)bx_save_prefs(false);
    bx_log("BX-GTA descarregado");
    return 0;
}
int32_t attr_module_hidden module_start(int64_t argc, const void *args) {
    (void)argc; (void)args;
    return 0;
}
int32_t attr_module_hidden module_stop(int64_t argc, const void *args) {
    (void)argc; (void)args;
    return 0;
}
