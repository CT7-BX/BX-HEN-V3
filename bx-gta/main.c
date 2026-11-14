/*
 * BX-GTA v0.8: controller-driven notification menu and diagnostics.
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

#define BX_VERSION "0.8.0"
#define BX_TITLE "CUSA00419"
#define BX_COMBO (ORBIS_PAD_BUTTON_L1 | ORBIS_PAD_BUTTON_RIGHT)

attr_public const char *g_pluginName = "BXGTA_menu";
attr_public const char *g_pluginDesc = "BX-GTA v0.8 notification menu test (no gameplay edits)";
attr_public const char *g_pluginAuth = "BX-GTA";
attr_public uint32_t g_pluginVersion = 0x00000800;

static bool g_running = false;
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
    char message[256] = {0};
    if (bx_menu_render(&g_menu, message, sizeof(message)) < 0) return;
    Notify(TEX_ICON_SYSTEM, "%s", message);
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
            NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA v0.8: controles e menu de notificacoes ativos");
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
            NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA v0.8: teste de notificacao OK");
            break;
        case 5:
            bx_menu_reset(&g_menu);
            bx_menu_input(&g_menu, BX_KEY_TOGGLE);
            show_selection();
            break;
        case 6:
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
static uint32_t normalize_buttons(uint32_t buttons) {
    uint32_t normalized = 0;
    if (buttons & ORBIS_PAD_BUTTON_L1) normalized |= BX_PAD_L1;
    if (buttons & ORBIS_PAD_BUTTON_RIGHT) normalized |= BX_PAD_RIGHT;
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
    NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA v0.8: plugin carregado");
    bx_menu_reset(&g_menu);
    if (!target_ok()) return 0;
    __atomic_store_n(&g_running, true, __ATOMIC_RELEASE);
    int32_t result = scePthreadCreate(&g_thread, NULL, menu_input_thread,
                                    NULL, "bx_gta_menu");
    if (result != 0) {
        __atomic_store_n(&g_running, false, __ATOMIC_RELEASE);
        Notify(TEX_ICON_SYSTEM, "BX-GTA: falha ao iniciar leitura do controle: %d", result);
        final_printf("[BX-GTA] thread failed: %d\n", result);
        return 0;
    }
    g_thread_created = true;
    NotifyStatic(TEX_ICON_SYSTEM, "BX-GTA v0.8: aperte L1 + DIREITA");
    return 0;
}
int32_t attr_public plugin_unload(int32_t argc, const char *argv[]) {
    (void)argc; (void)argv;
    __atomic_store_n(&g_running, false, __ATOMIC_RELEASE);
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
