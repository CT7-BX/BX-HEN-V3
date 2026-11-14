#include "palette.h"
/* Black/red design tokens for the future native overlay.
 * GoldHEN system notifications do NOT support these color tokens. */
static const char *themes[]={"Preto/Vermelho","Preto Fosco","Vermelho Neon","Contraste"};
static const char *accents[]={"Vermelho","Rubi","Carmesim","Bordo","Coral","Vermelho Claro"};
static const uint32_t colors[]={
  0xE12632FFu,0xCE1F3AFFu,0xB9132FFFu,0x8E1732FFu,0xF45659FFu,0xFF9E9EFFu
};
const char *bx_theme_name(unsigned v){
 return v<sizeof(themes)/sizeof(themes[0])?themes[v]:"Invalido";
}
const char *bx_accent_name(unsigned v){
 return v<sizeof(accents)/sizeof(accents[0])?accents[v]:"Invalido";
}
BxPalette bx_palette_select(unsigned theme,unsigned accent){
 BxPalette p={0x080A0DFC,0xF5F5F5FFu,0xAAAAB2FFu,0xE12632FFu,0xEE5252FFu};
 if(theme==1){p.panel=0x101010FAu;p.text=0xE9E9E9FFu;p.secondary=0x9F9F9FFFu;}
 if(theme==2){p.panel=0x15050DFC;p.text=0xFFFFFFFFu;p.secondary=0xC8A7ABFFu;}
 if(theme==3){p.panel=0x000000FFu;p.text=0xFFFFFFFFu;p.secondary=0xF2F2F2FFu;}
 p.highlight=colors[accent<6?accent:0];
 return p;
}
