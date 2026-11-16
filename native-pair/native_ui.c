/*
 * BX-REMOTE-PLAY native PS4 dashboard v0.22.
 * Real RGB CPU framebuffer via OpenOrbis VideoOut, not the website, a
 * notification overlay, or a screenshot. No external fonts/graphics assets.
 * Fail open: pairing remains usable when the display cannot initialize.
 */
#include "native_ui.h"
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include <unistd.h>
#include <orbis/libkernel.h>
#include <orbis/VideoOut.h>

#define UI_W 1920
#define UI_H 1080
#define UI_BUFFERS 2
#define UI_PIXELS ((size_t)UI_W * (size_t)UI_H)
#define UI_BYTES (UI_PIXELS * 4u)
#define UI_ALIGN 0x200000u

typedef struct BXScreen {
    int video;
    int ready;
    int registered;
    int allocated;
    int queued;
    int current;
    int64_t frame_id;
    off_t direct_offset;
    size_t direct_size;
    void *memory;
    uint32_t *buffer[2];
    OrbisKernelEqueue flip_queue;
    OrbisVideoOutBufferAttribute attribute;
    char status[148];
    char stage[48];
    char code[12];
} BXScreen;
static BXScreen ui;

/* Hand-drawn five-by-seven monospaced font in a compact 35-character set.
   Index 0..25 = A..Z, 26..35 = 0..9. UTF-8 is not parsed into secrets. */
static const uint8_t glyphs[36][7] = {
    {14,17,17,31,17,17,17}, /* A */
    {30,17,17,30,17,17,30}, /* B */
    {14,17,16,16,16,17,14}, /* C */
    {30,17,17,17,17,17,30}, /* D */
    {31,16,16,30,16,16,31}, /* E */
    {31,16,16,30,16,16,16}, /* F */
    {14,17,16,23,17,17,14}, /* G */
    {17,17,17,31,17,17,17}, /* H */
    {31,4,4,4,4,4,31}, /* I */
    {7,2,2,2,18,18,12}, /* J */
    {17,18,20,24,20,18,17}, /* K */
    {16,16,16,16,16,16,31}, /* L */
    {17,27,21,21,17,17,17}, /* M */
    {17,25,21,19,17,17,17}, /* N */
    {14,17,17,17,17,17,14}, /* O */
    {30,17,17,30,16,16,16}, /* P */
    {14,17,17,17,21,18,13}, /* Q */
    {30,17,17,30,20,18,17}, /* R */
    {15,16,16,14,1,1,30}, /* S */
    {31,4,4,4,4,4,4}, /* T */
    {17,17,17,17,17,17,14}, /* U */
    {17,17,17,17,17,10,4}, /* V */
    {17,17,17,21,21,21,10}, /* W */
    {17,17,10,4,10,17,17}, /* X */
    {17,17,10,4,4,4,4}, /* Y */
    {31,1,2,4,8,16,31}, /* Z */
    {14,17,19,21,25,17,14}, /* 0 */
    {4,12,4,4,4,4,14}, /* 1 */
    {14,17,1,2,4,8,31}, /* 2 */
    {30,1,1,14,1,1,30}, /* 3 */
    {2,6,10,18,31,2,2}, /* 4 */
    {31,16,16,30,1,1,30}, /* 5 */
    {14,16,16,30,17,17,14}, /* 6 */
    {31,1,2,4,8,8,8}, /* 7 */
    {14,17,17,14,17,17,14}, /* 8 */
    {14,17,17,15,1,1,14} /* 9 */
};

static uint32_t color(uint8_t r, uint8_t g, uint8_t b) {
    return 0x80000000u | ((uint32_t)r << 16) | ((uint32_t)g << 8) | b;
}
static void fill(uint32_t *dst, int x, int y, int w, int h, uint32_t c) {
    int i, j;
    if(!dst || w <= 0 || h <= 0) return;
    if(x < 0) {w += x; x = 0;}
    if(y < 0) {h += y; y = 0;}
    if(x >= UI_W || y >= UI_H) return;
    if(x + w > UI_W) w = UI_W - x;
    if(y + h > UI_H) h = UI_H - y;
    if(w <= 0 || h <= 0) return;
    for(j = 0; j < h; ++j)
        for(i = 0; i < w; ++i)
            dst[(size_t)(y + j) * UI_W + x + i] = c;
}
static void glyph(uint32_t *dst, int x, int y, char character, int scale, uint32_t c) {
    const uint8_t *g = NULL;
    static const uint8_t dash[7] = {0,0,0,31,0,0,0};
    static const uint8_t colon[7] = {0,4,4,0,4,4,0};
    static const uint8_t dot[7] = {0,0,0,0,0,12,12};
    static const uint8_t slash[7] = {1,2,2,4,8,8,16};
    static const uint8_t question[7] = {14,17,2,4,4,0,4};
    static const uint8_t percent[7] = {17,2,4,4,8,16,17};
    int row, col;
    if(character >= 'a' && character <= 'z') character = (char)(character - 32);
    if(character >= 'A' && character <= 'Z') g = glyphs[character - 'A'];
    else if(character >= '0' && character <= '9') g = glyphs[26 + character - '0'];
    else if(character == '-') g = dash;
    else if(character == ':') g = colon;
    else if(character == '.') g = dot;
    else if(character == '/') g = slash;
    else if(character == '%') g = percent;
    else if(character != ' ' && character != '\t') g = question;
    if (!g) return;
    for(row = 0; row < 7; row++)
        for(col = 0; col < 5; col++)
            if(g[row] & (1u << (4-col)))
                fill(dst, x + col*scale, y + row*scale, scale, scale, c);
}
static void text(uint32_t *dst, int x, int y, const char *line, int scale,
                 uint32_t c, int limit) {
    int col = 0;
    if(!line) return;
    while(*line && col < limit) {
        /* Do not draw invalid bytes outside our ASCII glyph map. */
        unsigned char ch = (unsigned char)*line++;
        if(ch >= 32 && ch < 127) glyph(dst, x + col*scale*6, y, (char)ch, scale, c);
        else glyph(dst, x + col*scale*6, y, '?', scale, c);
        col++;
    }
}
static void panel(uint32_t *dst, int x, int y, int w, int h, uint32_t bg,
                  uint32_t accent) {
    fill(dst,x,y,w,h,bg);
    fill(dst,x,y,7,h,accent);
}
static void draw_frame(uint32_t *dst) {
    const uint32_t bg=color(9,10,14), card=color(24,24,33),
                   dim=color(176,175,190), white=color(247,245,248),
                   red=color(243,53,82), teal=color(107,222,155),
                   danger=color(230,103,126);
    const char *phase = ui.stage[0] ? ui.stage : "INICIALIZANDO";
    const char *status = ui.status[0] ? ui.status : "ABRA O BX REMOTE PLAY NO PS4";
    fill(dst,0,0,UI_W,UI_H,bg);
    fill(dst,0,0,UI_W,138,color(25,19,29));
    fill(dst,0,0,UI_W,8,red);
    fill(dst,70,43,22,52,red);
    text(dst,116,45,"BX REMOTE PLAY",6,white,19);
    fill(dst,1440,44,385,62,color(55,26,42));
    fill(dst,1440,44,5,62,red);
    text(dst,1484,58,"VERSAO 0.22 BETA",3,white,18);

    text(dst,83,170,"CENTRAL DO PS4",4,white,25);
    text(dst,83,213,"VINCULO  -  ATUALIZACAO  -  DIAGNOSTICO",2,dim,58);
    panel(dst,82,239,395,129,card,red);
    text(dst,108,265,"01 VINCULO",4,white,21);
    text(dst,108,320,"AUTORIZAR DISPOSITIVO",2,dim,30);

    panel(dst,82,385,395,129,card,teal);
    text(dst,108,410,"02 SERVICO",4,white,21);
    text(dst,108,465,"EXECUTA SEM PKG ABERTO",2,dim,30);

    panel(dst,82,531,395,129,card,red);
    text(dst,108,556,"03 ATUALIZAR",4,white,21);
    text(dst,108,611,"VERSAO OFICIAL",2,dim,30);

    panel(dst,82,678,395,129,card,danger);
    text(dst,108,702,"04 DIAGNOSTICO",3,white,25);
    text(dst,108,758,"REMOTE PLAY EM TESTES",2,dim,29);

    panel(dst,527,236,1310,572,card,red);
    text(dst,565,279,"STATUS DA SESSAO",3,dim,45);
    text(dst,566,333,phase,4,white,47);
    fill(dst,565,414,1235,2,color(66,52,67));
    fill(dst,565,444,6,214,red);
    text(dst,592,463,"CODIGO DE PAREAMENTO",3,dim,41);
    if(ui.code[0]) {
        fill(dst,589,521,535,110,color(22,43,39));
        text(dst,610,535,ui.code,10,teal,9);
    } else text(dst,592,529,"AGUARDANDO CODIGO",5,dim,27);
    fill(dst,565,677,1235,2,color(66,52,67));
    text(dst,565,700,"STATUS DO APLICATIVO",3,dim,41);
    text(dst,565,744,status,2,white,96);

    fill(dst,82,856,1755,120,color(21,20,29));
    fill(dst,82,856,1755,5,red);
    text(dst,110,885,"X APROVAR / SEGUIR     O RECUSAR     TRIANGULO SERVICO",3,white,80);
    text(dst,110,940,"OPTIONS ENCERRAR   -   STREAMING DIRETO AINDA INDISPONIVEL",2,dim,100);
    text(dst,84,1025,"BX REMOTE PLAY   -   PKG DE VINCULO E DIAGNOSTICO",2,dim,94);
}
static void draw(void) {
    OrbisVideoOutFlipStatus s;
    OrbisKernelEvent event;
    int count=0, tries;
    int index;
    if(!ui.ready) return;
    index=ui.current;
    draw_frame(ui.buffer[index]);
    if(sceVideoOutSubmitFlip(ui.video,index,ORBIS_VIDEO_OUT_FLIP_VSYNC,ui.frame_id) >= 0) {
        for(tries=0;tries<100;tries++) {
            if(sceVideoOutGetFlipStatus(ui.video,&s)>=0 && s.flipArg==ui.frame_id) break;
            if(ui.queued) {
                if(sceKernelWaitEqueue(ui.flip_queue,&event,1,&count,0)!=0) usleep(5000);
            } else usleep(5000);
        }
        ui.frame_id++;
        ui.current=(ui.current+1)%UI_BUFFERS;
    }
}
int bx_ui_init(void) {
    size_t all;
    void *buffers[2];
    memset(&ui,0,sizeof(ui));
    ui.video=-1;
    ui.video=sceVideoOutOpen(ORBIS_VIDEO_USER_MAIN,ORBIS_VIDEO_OUT_BUS_MAIN,0,NULL);
    if(ui.video<0) return 0;
    all=(UI_BYTES*UI_BUFFERS + UI_ALIGN-1)/UI_ALIGN*UI_ALIGN;
    ui.direct_size=all;
    if(sceKernelAllocateDirectMemory(0,(off_t)sceKernelGetDirectMemorySize(),
       all,UI_ALIGN,3,&ui.direct_offset)<0) goto fail;
    ui.allocated=1;
    if(sceKernelMapDirectMemory(&ui.memory,all,0x33,0,ui.direct_offset,UI_ALIGN)<0) goto fail;
    ui.buffer[0]=(uint32_t *)ui.memory;
    ui.buffer[1]=(uint32_t *)((unsigned char *)ui.memory + UI_BYTES);
    buffers[0]=ui.buffer[0]; buffers[1]=ui.buffer[1];
    sceVideoOutSetBufferAttribute(&ui.attribute,0x80000000,1,0,UI_W,UI_H,UI_W);
    if(sceVideoOutRegisterBuffers(ui.video,0,buffers,UI_BUFFERS,&ui.attribute)<0)goto fail;
    ui.registered=1;
    if(sceKernelCreateEqueue(&ui.flip_queue,"BX remote flip")==0 &&
       sceVideoOutAddFlipEvent(ui.flip_queue,ui.video,NULL)>=0)ui.queued=1;
    sceVideoOutSetFlipRate(ui.video,ORBIS_VIDEO_OUT_FLIP_30HZ);
    ui.ready=1;
    strcpy(ui.stage,"INICIALIZANDO");
    strcpy(ui.status,"TESTE NATIVO    AGUARDANDO REDE");
    draw();
    return 1;
fail:
    bx_ui_shutdown();
    return 0;
}
int bx_ui_enabled(void) {return ui.ready;}
void bx_ui_status(const char *message) {
    if(!ui.ready || !message)return;
    snprintf(ui.status,sizeof(ui.status),"%s",message);
    draw();
}
void bx_ui_stage(const char *stage) {
    if(!ui.ready || !stage)return;
    snprintf(ui.stage,sizeof(ui.stage),"%s",stage);
    draw();
}
void bx_ui_code(const char *code) {
    if(!ui.ready)return;
    if(code && strlen(code)==8)snprintf(ui.code,sizeof(ui.code),"%s",code);
    else ui.code[0]=0;
    draw();
}
void bx_ui_shutdown(void) {
    if(ui.ready)ui.ready=0;
    if(ui.video>=0 && ui.registered)sceVideoOutUnregisterBuffers(ui.video,0);
    if(ui.queued)sceKernelDeleteEqueue(ui.flip_queue);
    if(ui.memory)sceKernelMunmap(ui.memory,ui.direct_size);
    if(ui.allocated)sceKernelReleaseDirectMemory(ui.direct_offset,ui.direct_size);
    if(ui.video>=0)sceVideoOutClose(ui.video);
    memset(&ui,0,sizeof(ui));
    ui.video=-1;
}
