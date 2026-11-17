/*
 * BX-REMOTE-PLAY native PS4 dashboard v0.25.
 * Real RGB CPU framebuffer via OpenOrbis VideoOut, not the website, a
 * notification overlay, or a screenshot. No external fonts/graphics assets.
 * Fail open: pairing remains usable when the display cannot initialize.
 */
#include "native_ui.h"
#include "native_diag.h"
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
    char hint[84];
    char code[12];
    unsigned progress;
    enum BXDiagnosticLevel level;
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
/* Pixel-only rounded geometry. No external assets, GPU, heap allocation or
 * font dependency: the OpenOrbis VideoOut fallback remains unchanged. */
static void rounded(uint32_t *dst,int x,int y,int w,int h,int radius,uint32_t shade) {
    int row,col,cut;
    if(!dst || w<=0 || h<=0)return;
    if(radius<0)radius=0;
    if(radius>w/2)radius=w/2;
    if(radius>h/2)radius=h/2;
    for(row=0;row<h;++row) {
        cut=0;
        if(radius>0 && (row<radius || row>=h-radius)) {
            int dy=row<radius ? radius-1-row : row-(h-radius);
            for(col=0;col<radius;++col) {
                int dx=radius-1-col;
                if(dx*dx+dy*dy<=radius*radius)break;
            }
            cut=col;
        }
        fill(dst,x+cut,y+row,w-2*cut,1,shade);
    }
}
static void background_gradient(uint32_t *dst) {
    int y;
    for(y=0;y<UI_H;++y) {
        int r=10 + y*5/UI_H;
        int g=11 + y*2/UI_H;
        int b=18 + y*8/UI_H;
        fill(dst,0,y,UI_W,1,color((uint8_t)r,(uint8_t)g,(uint8_t)b));
    }
}
static void stroke_card(uint32_t *dst,int x,int y,int w,int h,
                        uint32_t bg,uint32_t border,int radius) {
    rounded(dst,x,y,w,h,radius,border);
    rounded(dst,x+2,y+2,w-4,h-4,radius>2?radius-2:0,bg);
}
static void draw_frame(uint32_t *dst) {
    const uint32_t canvas=color(12,13,21), card=color(24,25,36),
        raised=color(35,28,42), surface=color(17,20,30),
        border=color(81,59,78), muted=color(177,169,188),
        white=color(249,244,248), red=color(239,55,86),
        rose=color(255,154,179), teal=color(100,225,170),
        danger=color(238,105,128);
    const char *phase=ui.stage[0]?ui.stage:"INICIALIZANDO";
    const char *status=ui.status[0]?ui.status:"AGUARDANDO REDE";
    const uint32_t stateColor=ui.level==BX_DIAG_FAILURE?danger:
         ui.level==BX_DIAG_GOOD?teal:rose;
    const char *markers[4]={"CONFIG","REDE","VINCULO","FIM"};
    const char *linkLabel =
        ui.level==BX_DIAG_FAILURE ? "VERIFICACAO FALHOU" :
        ui.level==BX_DIAG_WARNING ? "RECUPERACAO OU AVISO" :
        ui.level==BX_DIAG_GOOD ? "ETAPA CONFIRMADA" :
        "AGUARDANDO VERIFICACAO";
    int i;
    background_gradient(dst);

    /* Branding in a slim header, with a live but honest local state. */
    fill(dst,0,0,UI_W,7,red);
    rounded(dst,71,41,66,66,17,red);
    text(dst,82,56,"BX",4,white,2);
    text(dst,159,43,"BX REMOTE PLAY",6,white,19);
    text(dst,161,97,"CENTRAL DE VINCULO  /  PS4 LOCAL",2,muted,50);
    stroke_card(dst,1453,47,390,57,raised,border,18);
    text(dst,1482,63,"VERSION 0.25   BETA",3,rose,20);
    fill(dst,70,146,1773,2,border);

    text(dst,79,187,"CENTRAL DO CONSOLE",5,white,28);
    text(dst,80,238,"CONECTIVIDADE, VINCULO E DIAGNOSTICO",2,muted,46);

    /* Stable HUD banner: state is based on this console's diagnostic stage.
       Neither an HTTPS reply nor a pairing ACK represents active gameplay. */
    stroke_card(dst,1134,171,708,85,raised,border,18);
    rounded(dst,1152,190,10,46,5,stateColor);
    text(dst,1180,181,"ESTABILIDADE HTTPS",2,rose,32);
    text(dst,1180,213,linkLabel,3,stateColor,35);

    /* Four concise status cards; labels are not interactive menu buttons. */
    for(i=0;i<4;++i) {
        static const char *titles[4]={"01  CONFIG","02  REDE","03  VINCULO","04  ENCERRAR"};
        static const char *sub[4]={
            "ARQUIVO LOCAL PRIVADO","CONEXAO HTTPS SEGURA",
            "APROVACAO PELO CONTROLE","FECHAR PELO MENU PS"};
        const int y=279+i*132;
        const uint32_t accent=ui.progress >= (unsigned)(i+1)
            ? (ui.level==BX_DIAG_FAILURE?danger:teal):red;
        stroke_card(dst,76,y,494,116,card,border,20);
        rounded(dst,94,y+17,5,81,2,accent);
        text(dst,119,y+22,titles[i],4,white,23);
        text(dst,121,y+77,sub[i],2,muted,34);
        if(ui.progress >= (unsigned)(i+1)) {
            rounded(dst,507,y+29,43,44,12,color(25,66,51));
            text(dst,519,y+40,"OK",2,teal,2);
        }
    }

    /* Session focus panel: clear phase, progression, and owner pairing code. */
    stroke_card(dst,598,278,1244,529,card,border,23);
    rounded(dst,626,306,321,43,13,color(75,34,52));
    text(dst,649,318,"ESTADO DA CONEXAO",2,rose,27);
    text(dst,628,375,phase,5,stateColor,39);
    if(ui.level==BX_DIAG_WARNING) {
        text(dst,1380,391,"RECONEXAO LIMITADA",2,rose,28);
    }
    text(dst,629,445,"PROGRESSO LOCAL DO VINCULO",2,muted,43);
    for(i=0;i<4;++i) {
        const int x=629+i*291;
        const uint32_t accent=ui.progress >= (unsigned)(i+1)
            ? (ui.level==BX_DIAG_FAILURE?danger:teal):color(74,61,78);
        rounded(dst,x,482,271,10,4,accent);
        text(dst,x,510,markers[i],2,muted,13);
    }
    fill(dst,628,558,1182,2,border);
    text(dst,630,582,"CODIGO TEMPORARIO",3,muted,26);
    if(ui.code[0]) {
        rounded(dst,628,628,616,115,18,color(18,55,43));
        text(dst,652,645,ui.code,10,teal,8);
        text(dst,1298,666,"DIGITE NO IPHONE",3,rose,23);
    } else {
        rounded(dst,628,628,616,115,18,surface);
        text(dst,654,662,"AGUARDANDO CODIGO",4,muted,22);
        text(dst,1292,667,"VINCULE PELO SITE",2,muted,24);
    }

    /* Recovery guidance always comes from a bounded local stage mapping. */
    stroke_card(dst,598,827,1244,113,surface,border,18);
    rounded(dst,616,848,6,69,3,stateColor);
    text(dst,645,849,"PROXIMO PASSO",2,rose,27);
    text(dst,645,885,ui.hint[0]?ui.hint:"CONSULTE O RELATORIO LOCAL",
         3,white,58);

    stroke_card(dst,76,827,493,113,raised,border,18);
    text(dst,101,851,"STATUS DO APLICATIVO",2,rose,28);
    text(dst,101,892,status,2,white,34);

    stroke_card(dst,75,961,1767,85,color(25,23,33),border,17);
    text(dst,102,981,"X  APROVAR/SEGUIR     O  RECUSAR     TRIANGULO  SERVICO",
         3,white,86);
    text(dst,106,1020,"OPTIONS CANCELA/ENCERRA   /   VIDEO E CONTROLES DIRETOS PENDENTES",
         2,muted,89);
    (void)canvas;
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
    strcpy(ui.hint,"PREPARE CFG PRIVADA NO PS4");
    ui.progress=0u;
    ui.level=BX_DIAG_WAIT;
    draw();
    return 1;
fail:
    bx_ui_shutdown();
    return 0;
}
int bx_ui_enabled(void) {return ui.ready;}
void bx_ui_status(const char *message) {
    char next[sizeof(ui.status)]={0};
    if(!ui.ready || !message)return;
    snprintf(next,sizeof(next),"%s",message);
    if(strcmp(ui.status,next)==0)return; /* Avoid needless VideoOut flips. */
    memcpy(ui.status,next,sizeof(next));
    draw();
}
void bx_ui_stage(const char *stage) {
    char next[sizeof(ui.stage)]={0};
    char hint[sizeof(ui.hint)]={0};
    unsigned progress;
    enum BXDiagnosticLevel level;
    if(!ui.ready || !stage)return;
    snprintf(next,sizeof(next),"%s",bx_diag_label(stage));
    snprintf(hint,sizeof(hint),"%s",bx_diag_hint(stage,0));
    progress=bx_diag_progress(stage);
    level=bx_diag_level(stage,0);
    if(strcmp(ui.stage,next)==0 && strcmp(ui.hint,hint)==0 &&
       ui.progress==progress && ui.level==level)return;
    memcpy(ui.stage,next,sizeof(next));
    memcpy(ui.hint,hint,sizeof(hint));
    ui.progress=progress;
    ui.level=level;
    draw();
}
void bx_ui_code(const char *code) {
    char next[sizeof(ui.code)]={0};
    size_t i;
    if(!ui.ready)return;
    if(code && strlen(code)==8) {
        for(i=0;i<8;++i)if(code[i]<'0'||code[i]>'9')break;
        if(i==8)snprintf(next,sizeof(next),"%s",code);
    }
    if(strcmp(ui.code,next)==0)return;
    memcpy(ui.code,next,sizeof(next));
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
