#include "palette.h"
static const char *themes[] = {"Escuro","Claro","Neon","Contraste"};
static const char *accents[] = {"Azul","Vermelho","Verde","Roxo","Dourado","Branco"};
static const uint32_t colors[] = {
    0x2F80EDFFu, 0xE84B55FFu, 0x23B66FFFu, 0x9B59B6FFu, 0xE6B85CFFu, 0xFFFFFFFFu
};
const char *bx_theme_name(unsigned theme) {
    return theme<sizeof(themes)/sizeof(themes[0])? themes[theme] : "Invalido";
}
const char *bx_accent_name(unsigned accent) {
    return accent<sizeof(accents)/sizeof(accents[0])? accents[accent] : "Invalido";
}
BxPalette bx_palette_select(unsigned theme, unsigned accent) {
    BxPalette p={0x171923E8u,0xF8FAFCFFu,0xCBD5E1FFu,0x2F80EDFFu,0xE84B55FFu};
    if(theme==1){p.panel=0xF0F4F9F2u;p.text=0x111827FFu;p.secondary=0x384152FFu;}
    if(theme==2){p.panel=0x0B1023F0u;p.text=0xFFFFFFFFu;p.secondary=0xBEDBFFFFu;}
    if(theme==3){p.panel=0x000000FFu;p.text=0xFFFFFFFFu;p.secondary=0xFFFFFFFFu;}
    p.highlight=colors[accent<6?accent:0];
    return p;
}
