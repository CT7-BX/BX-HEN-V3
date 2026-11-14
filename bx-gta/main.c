/*
 * BX-GTA v0.7: first controller-driven in-game navigation test.
 * Navigates through GoldHEN system notifications; NOT a graphical overlay
 * and does not alter GTA V game state or private-server state.
 */
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <Common.h>
#include <orbis/Pad.h>
#include <orbis/UserService.h>
#include "plugin_common.h"
#include "GoldHEN.h"
#include "menu_core.h"

#define BX_VERSION "0.7.0"
#define BX_TITLE "CUSA00419"
#define BX_COMBO (ORBIS_PAD_BUTTON_L1 | ORBIS_PAD_BUTTON_RIGHT)

attr_public const char *g_pluginName = "BXGTA_menu";
attr_public const char *g_pluginDesc = "BX-GTA v0.7 controller menu test (not gameplay mod)";
attr_public const char *g_pluginAuth = "BX-GTA";
attr_public uint32_t g_pluginVersion = 0x00000700;

static volatile bool g_running = false;
static bool g_thread_created = false;
static OrbisPthread g_thread;
static BxMenu g_menu;
static char g_detected_version[32];

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
    if (!g_menu.opened) {
        NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA: menu fechado");
    } else if (!g_menu.in_category) {
        Notify(TEX_ICON_SYSTEM, "BX-GTA v%s [%d/%d]\n%s\nX entrar | O sair",
               BX_VERSION, g_menu.category + 1, bx_menu_category_count(),
               bx_menu_category_name(g_menu.category));
    } else {
        const int count = bx_menu_item_count(g_menu.category);
        const char *label = bx_menu_item_name(g_menu.category, g_menu.item);
        Notify(TEX_ICON_SYSTEM, "BX-GTA > %s\n[%d/%d] %s",
               bx_menu_category_name(g_menu.category), g_menu.item + 1,
               count, label);
    }
}
static void on_selection(void) {
    if (!bx_menu_item_implemented(g_menu.category, g_menu.item)) {
        NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA: requer adaptador GTA/servidor; indisponivel");
        return;
    }
    if (g_menu.category != 0) {
        NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA: opcao ainda indisponivel");
        return;
    }
    switch (g_menu.item) {
        case 0:
            NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA v0.7: controle e menu ativos");
            break;
        case 1:
            Notify(TEX_ICON_SYSTEM, "BX-GTA: %s / GTA V %s",
                   BX_TITLE, g_detected_version);
            break;
        case 2:
            NotifyStatic(TEX_ICON_SYSTEM,
                "L1+Direita abre/fecha; CIMA/BAIXO navega; X escolhe; O volta");
            break;
        case 3:
            NotifyStatic(TEX_ICON_SYSTEM,
                "BX-GTA: navegacao ativa. Gameplay/servidor nao integrados.");
            break;
        case 4:
            bx_menu_input(&g_menu, BX_KEY_TOGGLE);
            show_selection();
            break;
        default: break;
    }
}
static void on_key(BxKey key) {
    const BxResult result = bx_menu_input(&g_menu, key);
    if (result == BX_NO_CHANGE) return;
    if (result == BX_SELECTED) on_selection();
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
static void *menu_input_thread(void *ignored) {
    (void)ignored;
    OrbisUserServiceInitializeParams params = {0};
    params.priority = ORBIS_KERNEL_PRIO_FIFO_LOWEST;
    (void)sceUserServiceInitialize(&params);
    (void)scePadInit();

    bool owned = false;
    int32_t handle = -1;
    uint32_t previous = 0;
    while (g_running) {
        if (handle <= 0) {
            handle = get_pad_handle(&owned);
            if (handle <= 0) {
                usleep(400000);
                continue;
            }
            final_printf("[BX-GTA] controller handle acquired: %d\n", handle);
        }
        OrbisPadData data = {0};
        int32_t rc = scePadReadState(handle, &data);
        if (rc == 0 && data.connected) {
            const uint32_t current = data.buttons;
            const uint32_t pressed = current & ~previous;
            const bool combo = (current & BX_COMBO) == BX_COMBO;
            const bool prev_combo = (previous & BX_COMBO) == BX_COMBO;
            if (combo && !prev_combo) {
                on_key(BX_KEY_TOGGLE);
            } else if (!combo && !(current & ORBIS_PAD_BUTTON_L1) && g_menu.opened) {
                if (pressed & ORBIS_PAD_BUTTON_UP) on_key(BX_KEY_UP);
                else if (pressed & ORBIS_PAD_BUTTON_DOWN) on_key(BX_KEY_DOWN);
                else if (pressed & ORBIS_PAD_BUTTON_CROSS) on_key(BX_KEY_SELECT);
                else if (pressed & ORBIS_PAD_BUTTON_CIRCLE) on_key(BX_KEY_BACK);
            }
            previous = current;
        } else if (rc < 0 || !data.connected) {
            previous = 0;
        }
        usleep(70000);
    }
    if (owned && handle > 0) (void)scePadClose(handle);
    final_printf("[BX-GTA] input thread stopped\n");
    return NULL;
}
int32_t attr_public plugin_load(int32_t argc, const char *argv[]) {
    (void)argc; (void)argv;
    final_printf("[BX-GTA] v%s plugin_load\n", BX_VERSION);
    NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA v0.7: plugin carregado");
    bx_menu_reset(&g_menu);
    if (!target_ok()) return 0;
    g_running = true;
    int32_t result = scePthreadCreate(&g_thread, NULL, menu_input_thread,
                                    NULL, "bx_gta_menu");
    if (result != 0) {
        g_running = false;
        Notify(TEX_ICON_SYSTEM, "BX-GTA: falha ao iniciar leitura do controle: %d", result);
        final_printf("[BX-GTA] thread failed: %d\n", result);
        return 0;
    }
    g_thread_created = true;
    NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA v0.7: aperte L1 + DIREITA");
    return 0;
}
int32_t attr_public plugin_unload(int32_t argc, const char *argv[]) {
    (void)argc; (void)argv;
    g_running = false;
    if (g_thread_created) {
        (void)scePthreadJoin(g_thread, NULL);
        g_thread_created = false;
    }
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
