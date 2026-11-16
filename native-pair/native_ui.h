#ifndef BX_NATIVE_UI_H
#define BX_NATIVE_UI_H
/* Optional real PS4 VideoOut dashboard. Falls back to system notifications. */
int bx_ui_init(void);
void bx_ui_status(const char *message);
void bx_ui_stage(const char *stage);
void bx_ui_code(const char *code);
void bx_ui_shutdown(void);
int bx_ui_enabled(void);
#endif
