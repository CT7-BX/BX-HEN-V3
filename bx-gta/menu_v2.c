/* Automatically generated option hierarchy from menu_taxonomy_v2.json.
 * Labels are not evidence of working GTA native functions.
 */
#include "menu_v2.h"
#include <stdio.h>
typedef struct {const char* title;const BxOption* options;int count;} BxSubgroupV2;
typedef struct {const char* title;const BxSubgroupV2* groups;int count;} BxSectionV2;
#define N(arr) ((int)(sizeof(arr)/sizeof((arr)[0])))
static const BxOption options_0_0[]={
 {"Resumo",BX_ACT_SUMMARY,-1,5},
 {"Pesquisar funções",BX_ACT_SEARCH,-1,15},
 {"Favoritos",BX_ACT_FAVORITES,-1,16},
 {"Últimas opções",BX_ACT_RECENT,-1,16},
 {"Diagnóstico rápido",BX_ACT_GOLDHEN,-1,5},
};
static const BxOption options_0_1[]={
 {"Veículos",BX_ACT_OPEN_CATALOG,BX_LIB_VEHICLES,-1},
 {"Personagens",BX_ACT_OPEN_CATALOG,BX_LIB_MODELS,-1},
 {"Objetos",BX_ACT_OPEN_CATALOG,BX_LIB_OBJECTS,-1},
 {"Animações",BX_ACT_OPEN_CATALOG,BX_LIB_ANIMATIONS,-1},
 {"Cenários",BX_ACT_OPEN_CATALOG,BX_LIB_SCENARIOS,-1},
 {"Partículas",BX_ACT_OPEN_CATALOG,BX_LIB_PARTICLES,-1},
};
static const BxOption options_0_2[]={
 {"Trocar perfil",BX_ACT_PROFILE,-1,20},
 {"Tema preto/vermelho",BX_ACT_THEME,-1,1},
 {"Salvar preferências",BX_ACT_SAVE,-1,17},
 {"Ver CUSA",BX_ACT_CUSA,-1,6},
};
static const BxOption options_1_0[]={
 {"Conjuntos de roupa",BX_ACT_UNAVAILABLE,-1,2},
 {"Camisas e jaquetas",BX_ACT_UNAVAILABLE,-1,2},
 {"Calças e bermudas",BX_ACT_UNAVAILABLE,-1,2},
 {"Sapatos",BX_ACT_UNAVAILABLE,-1,2},
 {"Chapéus e bonés",BX_ACT_UNAVAILABLE,-1,2},
 {"Óculos",BX_ACT_UNAVAILABLE,-1,2},
 {"Máscaras",BX_ACT_UNAVAILABLE,-1,2},
 {"Acessórios",BX_ACT_UNAVAILABLE,-1,2},
 {"Salvar aparência",BX_ACT_UNAVAILABLE,-1,12},
 {"Carregar aparência",BX_ACT_UNAVAILABLE,-1,12},
};
static const BxOption options_1_1[]={
 {"Catálogo de personagens",BX_ACT_OPEN_CATALOG,BX_LIB_MODELS,-1},
 {"Trocar personagem",BX_ACT_UNAVAILABLE,-1,14},
 {"Restaurar personagem original",BX_ACT_UNAVAILABLE,-1,14},
 {"Modelos favoritos",BX_ACT_UNAVAILABLE,-1,14},
 {"Compatibilidade de modelos",BX_ACT_UNAVAILABLE,-1,14},
};
static const BxOption options_1_2[]={
 {"Catálogo de animações",BX_ACT_OPEN_CATALOG,BX_LIB_ANIMATIONS,-1},
 {"Cenários de animação",BX_ACT_OPEN_CATALOG,BX_LIB_SCENARIOS,-1},
 {"Gestos rápidos",BX_ACT_UNAVAILABLE,-1,13},
 {"Animações favoritas",BX_ACT_UNAVAILABLE,-1,13},
 {"Interromper animação",BX_ACT_UNAVAILABLE,-1,13},
 {"Prévia de animação",BX_ACT_UNAVAILABLE,-1,13},
};
static const BxOption options_1_3[]={
 {"Velocidade de caminhada",BX_ACT_UNAVAILABLE,-1,13},
 {"Velocidade de corrida",BX_ACT_UNAVAILABLE,-1,13},
 {"Altura do salto",BX_ACT_UNAVAILABLE,-1,13},
 {"Estilo de caminhada",BX_ACT_UNAVAILABLE,-1,13},
 {"Ações contextuais",BX_ACT_UNAVAILABLE,-1,13},
 {"Restaurar movimento",BX_ACT_UNAVAILABLE,-1,13},
};
static const BxOption options_2_0[]={
 {"Todos os veículos",BX_ACT_OPEN_CATALOG,BX_LIB_VEHICLES,-1},
 {"Pesquisar veículo",BX_ACT_UNAVAILABLE,-1,3},
 {"Veículos recentes",BX_ACT_UNAVAILABLE,-1,3},
 {"Veículos favoritos",BX_ACT_UNAVAILABLE,-1,10},
 {"Selecionar veículo",BX_ACT_UNAVAILABLE,-1,3},
};
static const BxOption options_2_1[]={
 {"Cor primária",BX_ACT_UNAVAILABLE,-1,8},
 {"Cor secundária",BX_ACT_UNAVAILABLE,-1,8},
 {"Acabamento da pintura",BX_ACT_UNAVAILABLE,-1,8},
 {"Rodas",BX_ACT_UNAVAILABLE,-1,8},
 {"Cor das rodas",BX_ACT_UNAVAILABLE,-1,8},
 {"Pneus",BX_ACT_UNAVAILABLE,-1,8},
 {"Vidros",BX_ACT_UNAVAILABLE,-1,8},
 {"Faróis",BX_ACT_UNAVAILABLE,-1,8},
 {"Luzes decorativas",BX_ACT_UNAVAILABLE,-1,8},
 {"Placa",BX_ACT_UNAVAILABLE,-1,8},
 {"Buzina",BX_ACT_UNAVAILABLE,-1,8},
};
static const BxOption options_2_2[]={
 {"Motor",BX_ACT_UNAVAILABLE,-1,8},
 {"Freios",BX_ACT_UNAVAILABLE,-1,8},
 {"Transmissão",BX_ACT_UNAVAILABLE,-1,8},
 {"Suspensão",BX_ACT_UNAVAILABLE,-1,8},
 {"Turbo",BX_ACT_UNAVAILABLE,-1,8},
 {"Aderência",BX_ACT_UNAVAILABLE,-1,8},
 {"Restaurar desempenho",BX_ACT_UNAVAILABLE,-1,8},
};
static const BxOption options_2_3[]={
 {"Reparar veículo",BX_ACT_UNAVAILABLE,-1,9},
 {"Limpar veículo",BX_ACT_UNAVAILABLE,-1,9},
 {"Colocar veículo no chão",BX_ACT_UNAVAILABLE,-1,9},
 {"Ligar/desligar motor",BX_ACT_UNAVAILABLE,-1,9},
 {"Trancar/destrancar portas",BX_ACT_UNAVAILABLE,-1,9},
 {"Abrir/fechar portas",BX_ACT_UNAVAILABLE,-1,9},
 {"Velocímetro",BX_ACT_UNAVAILABLE,-1,11},
};
static const BxOption options_2_4[]={
 {"Salvar veículo",BX_ACT_UNAVAILABLE,-1,10},
 {"Carregar veículo",BX_ACT_UNAVAILABLE,-1,10},
 {"Garagem por categoria",BX_ACT_UNAVAILABLE,-1,10},
 {"Favoritos da garagem",BX_ACT_UNAVAILABLE,-1,10},
 {"Presets de personalização",BX_ACT_UNAVAILABLE,-1,10},
 {"Excluir preset",BX_ACT_UNAVAILABLE,-1,10},
};
static const BxOption options_3_0[]={
 {"Ir ao marcador",BX_ACT_UNAVAILABLE,-1,4},
 {"Ir a coordenadas",BX_ACT_UNAVAILABLE,-1,4},
 {"Voltar à posição anterior",BX_ACT_UNAVAILABLE,-1,4},
 {"Locais predefinidos",BX_ACT_UNAVAILABLE,-1,4},
 {"Locais favoritos",BX_ACT_UNAVAILABLE,-1,25},
 {"Salvar local atual",BX_ACT_UNAVAILABLE,-1,25},
};
static const BxOption options_3_1[]={
 {"Criar marcador",BX_ACT_UNAVAILABLE,-1,27},
 {"Renomear marcador",BX_ACT_UNAVAILABLE,-1,27},
 {"Excluir marcador",BX_ACT_UNAVAILABLE,-1,27},
 {"Mostrar marcadores",BX_ACT_UNAVAILABLE,-1,27},
 {"Organizar favoritos",BX_ACT_UNAVAILABLE,-1,25},
};
static const BxOption options_3_2[]={
 {"Salvar rota",BX_ACT_UNAVAILABLE,-1,25},
 {"Carregar rota",BX_ACT_UNAVAILABLE,-1,25},
 {"Ponto inicial",BX_ACT_UNAVAILABLE,-1,27},
 {"Ponto final",BX_ACT_UNAVAILABLE,-1,27},
 {"Restaurar mapa",BX_ACT_UNAVAILABLE,-1,27},
};
static const BxOption options_4_0[]={
 {"Ensolarado",BX_ACT_UNAVAILABLE,-1,26},
 {"Nublado",BX_ACT_UNAVAILABLE,-1,26},
 {"Chuva",BX_ACT_UNAVAILABLE,-1,26},
 {"Nevoeiro",BX_ACT_UNAVAILABLE,-1,26},
 {"Hora do dia",BX_ACT_UNAVAILABLE,-1,26},
 {"Hora da noite",BX_ACT_UNAVAILABLE,-1,26},
 {"Congelar horário",BX_ACT_UNAVAILABLE,-1,26},
 {"Restaurar clima",BX_ACT_UNAVAILABLE,-1,26},
};
static const BxOption options_4_1[]={
 {"Densidade de tráfego",BX_ACT_UNAVAILABLE,-1,26},
 {"Densidade de pedestres",BX_ACT_UNAVAILABLE,-1,26},
 {"Iluminação ambiente",BX_ACT_UNAVAILABLE,-1,26},
 {"Gravidade ambiente",BX_ACT_UNAVAILABLE,-1,26},
 {"Ondas do mar",BX_ACT_UNAVAILABLE,-1,26},
 {"Restaurar ambiente",BX_ACT_UNAVAILABLE,-1,26},
};
static const BxOption options_4_2[]={
 {"Catálogo de objetos",BX_ACT_OPEN_CATALOG,BX_LIB_OBJECTS,-1},
 {"Partículas e efeitos",BX_ACT_OPEN_CATALOG,BX_LIB_PARTICLES,-1},
 {"Gerenciar objetos",BX_ACT_UNAVAILABLE,-1,26},
 {"Limpar objetos de sessão",BX_ACT_UNAVAILABLE,-1,26},
 {"Presets de cenário",BX_ACT_UNAVAILABLE,-1,26},
};
static const BxOption options_5_0[]={
 {"Ativar câmera livre",BX_ACT_UNAVAILABLE,-1,24},
 {"Velocidade da câmera",BX_ACT_UNAVAILABLE,-1,24},
 {"Campo de visão (FOV)",BX_ACT_UNAVAILABLE,-1,24},
 {"Altura e distância",BX_ACT_UNAVAILABLE,-1,24},
 {"Salvar posição",BX_ACT_UNAVAILABLE,-1,24},
 {"Restaurar câmera",BX_ACT_UNAVAILABLE,-1,24},
};
static const BxOption options_5_1[]={
 {"Preset cinematográfico",BX_ACT_UNAVAILABLE,-1,21},
 {"Movimento suave",BX_ACT_UNAVAILABLE,-1,21},
 {"Enquadramento",BX_ACT_UNAVAILABLE,-1,21},
 {"Transições",BX_ACT_UNAVAILABLE,-1,21},
 {"Salvar preset",BX_ACT_UNAVAILABLE,-1,21},
 {"Carregar preset",BX_ACT_UNAVAILABLE,-1,21},
};
static const BxOption options_5_2[]={
 {"Filtro neutro",BX_ACT_UNAVAILABLE,-1,22},
 {"Filtro cinematográfico",BX_ACT_UNAVAILABLE,-1,22},
 {"Contraste",BX_ACT_UNAVAILABLE,-1,22},
 {"Saturação",BX_ACT_UNAVAILABLE,-1,22},
 {"Brilho",BX_ACT_UNAVAILABLE,-1,22},
 {"Restaurar filtros",BX_ACT_UNAVAILABLE,-1,22},
};
static const BxOption options_5_3[]={
 {"Ocultar HUD",BX_ACT_UNAVAILABLE,-1,23},
 {"Restaurar HUD",BX_ACT_UNAVAILABLE,-1,23},
 {"Elementos da tela",BX_ACT_UNAVAILABLE,-1,23},
 {"Painel gráfico integrado",BX_ACT_UNAVAILABLE,-1,0},
 {"Posição do painel",BX_ACT_UNAVAILABLE,-1,0},
 {"Escala do painel",BX_ACT_UNAVAILABLE,-1,0},
};
static const BxOption options_6_0[]={
 {"Veículos (20 categorias)",BX_ACT_OPEN_CATALOG,BX_LIB_VEHICLES,-1},
 {"Personagens (7 grupos)",BX_ACT_OPEN_CATALOG,BX_LIB_MODELS,-1},
 {"Objetos (13 grupos)",BX_ACT_OPEN_CATALOG,BX_LIB_OBJECTS,-1},
 {"Animações",BX_ACT_OPEN_CATALOG,BX_LIB_ANIMATIONS,-1},
 {"Cenários",BX_ACT_OPEN_CATALOG,BX_LIB_SCENARIOS,-1},
 {"Partículas",BX_ACT_OPEN_CATALOG,BX_LIB_PARTICLES,-1},
};
static const BxOption options_6_1[]={
 {"Pesquisa no catálogo",BX_ACT_SEARCH,-1,15},
 {"Favoritos",BX_ACT_FAVORITES,-1,16},
 {"Histórico",BX_ACT_RECENT,-1,16},
 {"Importar presets",BX_ACT_UNAVAILABLE,-1,17},
 {"Exportar presets",BX_ACT_UNAVAILABLE,-1,17},
};
static const BxOption options_7_0[]={
 {"Tema preto e vermelho",BX_ACT_THEME,-1,1},
 {"Tom de vermelho",BX_ACT_ACCENT,-1,1},
 {"Transparência do painel",BX_ACT_UNAVAILABLE,-1,0},
 {"Tamanho da fonte",BX_ACT_UNAVAILABLE,-1,0},
 {"Tamanho do painel",BX_ACT_UNAVAILABLE,-1,0},
 {"Posição na tela",BX_ACT_UNAVAILABLE,-1,0},
 {"Efeito de entrada",BX_ACT_UNAVAILABLE,-1,0},
};
static const BxOption options_7_1[]={
 {"Alternar perfil",BX_ACT_PROFILE,-1,20},
 {"Salvar configuração",BX_ACT_SAVE,-1,17},
 {"Recarregar configuração",BX_ACT_LOAD,-1,17},
 {"Renomear perfil",BX_ACT_UNAVAILABLE,-1,20},
 {"Duplicar perfil",BX_ACT_UNAVAILABLE,-1,20},
 {"Restaurar padrão",BX_ACT_UNAVAILABLE,-1,20},
};
static const BxOption options_7_2[]={
 {"Mostrar controles",BX_ACT_HELP,-1,15},
 {"Personalizar atalho",BX_ACT_UNAVAILABLE,-1,15},
 {"Velocidade de rolagem",BX_ACT_UNAVAILABLE,-1,15},
 {"Som de seleção",BX_ACT_UNAVAILABLE,-1,15},
 {"Favoritos automáticos",BX_ACT_UNAVAILABLE,-1,16},
};
static const BxOption options_7_3[]={
 {"Scripts Lua",BX_ACT_UNAVAILABLE,-1,19},
 {"Gerenciador de scripts",BX_ACT_UNAVAILABLE,-1,19},
 {"Permissões do servidor",BX_ACT_UNAVAILABLE,-1,18},
 {"Verificar compatibilidade externa",BX_ACT_UNAVAILABLE,-1,18},
};
static const BxOption options_8_0[]={
 {"Status GoldHEN",BX_ACT_GOLDHEN,-1,5},
 {"Identificar CUSA e versão",BX_ACT_CUSA,-1,6},
 {"Resumo do plugin",BX_ACT_SUMMARY,-1,5},
 {"Teste de notificações",BX_ACT_NOTIFY,-1,5},
};
static const BxOption options_8_1[]={
 {"Registrar teste no log",BX_ACT_LOG,-1,7},
 {"Mostrar controles",BX_ACT_HELP,-1,15},
 {"Relatório completo",BX_ACT_UNAVAILABLE,-1,7},
 {"Exportar diagnóstico",BX_ACT_UNAVAILABLE,-1,7},
};
static const BxOption options_8_2[]={
 {"Salvar preferências",BX_ACT_SAVE,-1,17},
 {"Recarregar preferências",BX_ACT_LOAD,-1,17},
 {"Teste de painel gráfico",BX_ACT_UNAVAILABLE,-1,0},
 {"Verificar adaptador GTA",BX_ACT_UNAVAILABLE,-1,0},
};
static const BxOption options_9_0[]={
 {"Estado da conexão",BX_ACT_UNAVAILABLE,-1,18},
 {"Permissões disponíveis",BX_ACT_UNAVAILABLE,-1,18},
 {"Identificar servidor",BX_ACT_UNAVAILABLE,-1,18},
 {"Modos autorizados",BX_ACT_UNAVAILABLE,-1,18},
};
static const BxOption options_9_1[]={
 {"API do servidor",BX_ACT_UNAVAILABLE,-1,18},
 {"Solicitar permissão",BX_ACT_UNAVAILABLE,-1,18},
 {"Logs de permissões",BX_ACT_UNAVAILABLE,-1,18},
 {"Desativar integração",BX_ACT_UNAVAILABLE,-1,18},
};

static const BxSubgroupV2 groups_0[]={
 {"Acesso rápido",options_0_0,N(options_0_0)},
 {"Biblioteca rápida",options_0_1,N(options_0_1)},
 {"Atalhos",options_0_2,N(options_0_2)},
};
static const BxSubgroupV2 groups_1[]={
 {"Aparência e roupas",options_1_0,N(options_1_0)},
 {"Modelos",options_1_1,N(options_1_1)},
 {"Animações e gestos",options_1_2,N(options_1_2)},
 {"Movimento",options_1_3,N(options_1_3)},
};
static const BxSubgroupV2 groups_2[]={
 {"Catálogo e seleção",options_2_0,N(options_2_0)},
 {"Oficina e pintura",options_2_1,N(options_2_1)},
 {"Desempenho",options_2_2,N(options_2_2)},
 {"Utilidades",options_2_3,N(options_2_3)},
 {"Garagem",options_2_4,N(options_2_4)},
};
static const BxSubgroupV2 groups_3[]={
 {"Teleporte",options_3_0,N(options_3_0)},
 {"Marcadores",options_3_1,N(options_3_1)},
 {"Rotas e pontos",options_3_2,N(options_3_2)},
};
static const BxSubgroupV2 groups_4[]={
 {"Clima e horário",options_4_0,N(options_4_0)},
 {"Ambiente",options_4_1,N(options_4_1)},
 {"Objetos e efeitos",options_4_2,N(options_4_2)},
};
static const BxSubgroupV2 groups_5[]={
 {"Câmera livre",options_5_0,N(options_5_0)},
 {"Cinematografia",options_5_1,N(options_5_1)},
 {"Filtros",options_5_2,N(options_5_2)},
 {"HUD e painel",options_5_3,N(options_5_3)},
};
static const BxSubgroupV2 groups_6[]={
 {"Catálogos",options_6_0,N(options_6_0)},
 {"Organização",options_6_1,N(options_6_1)},
};
static const BxSubgroupV2 groups_7[]={
 {"Aparência do menu",options_7_0,N(options_7_0)},
 {"Perfis",options_7_1,N(options_7_1)},
 {"Navegação",options_7_2,N(options_7_2)},
 {"Extensões",options_7_3,N(options_7_3)},
};
static const BxSubgroupV2 groups_8[]={
 {"Estado do sistema",options_8_0,N(options_8_0)},
 {"Logs e testes",options_8_1,N(options_8_1)},
 {"Manutenção",options_8_2,N(options_8_2)},
};
static const BxSubgroupV2 groups_9[]={
 {"Informações",options_9_0,N(options_9_0)},
 {"Integração autorizada",options_9_1,N(options_9_1)},
};

static const BxSectionV2 sections[]={
 {"Início",groups_0,N(groups_0)},
 {"Jogador",groups_1,N(groups_1)},
 {"Veículos",groups_2,N(groups_2)},
 {"Mapa",groups_3,N(groups_3)},
 {"Mundo",groups_4,N(groups_4)},
 {"Câmera e visual",groups_5,N(groups_5)},
 {"Biblioteca",groups_6,N(groups_6)},
 {"Configurações",groups_7,N(groups_7)},
 {"Diagnóstico",groups_8,N(groups_8)},
 {"Servidor privado",groups_9,N(groups_9)},
};
int bx_v2_section_count(void){return N(sections);}
const char *bx_v2_section_title(int s){
 return s>=0 && s<N(sections)?sections[s].title:"Invalido";
}
int bx_v2_subgroup_count(int s){
 return s>=0 && s<N(sections)?sections[s].count:0;
}
const char *bx_v2_subgroup_title(int s,int g){
 if(s<0||s>=N(sections)||g<0||g>=sections[s].count)return "Invalido";
 return sections[s].groups[g].title;
}
int bx_v2_option_count(int s,int g){
 if(s<0||s>=N(sections)||g<0||g>=sections[s].count)return 0;
 return sections[s].groups[g].count;
}
const BxOption *bx_v2_option(int s,int g,int index){
 if(s<0||s>=N(sections)||g<0||g>=sections[s].count||
    index<0||index>=sections[s].groups[g].count)return NULL;
 return &sections[s].groups[g].options[index];
}
int bx_v2_total_options(void){
 int sum=0;
 for(int s=0;s<N(sections);++s)
  for(int g=0;g<sections[s].count;++g)sum+=sections[s].groups[g].count;
 return sum;
}
void bx_v2_reset(BxMenuV2 *s){
 if(!s)return;
 *s=(BxMenuV2){0,0,0,0,0,-1,0};
}
int bx_v2_current_feature(const BxMenuV2 *s){
 if(!s||!s->opened||s->depth!=2)return -1;
 const BxOption *item=bx_v2_option(s->section,s->subgroup,s->option);
 return item?item->feature_id:-1;
}
BxUiEvent bx_v2_input(BxMenuV2 *s,BxKey key){
 BxUiEvent e={0,BX_ACT_NONE,-1};
 if(!s)return e;
 if(key==BX_KEY_TOGGLE){
  s->opened=!s->opened;
  if(!s->opened)s->depth=0;
  e.changed=1;return e;
 }
 if(!s->opened)return e;
 if(key==BX_KEY_BACK){
  if(s->depth>0)--s->depth;
  else s->opened=0;
  e.changed=1;return e;
 }
 if(key==BX_KEY_UP||key==BX_KEY_DOWN){
  int count=s->depth==0?bx_v2_section_count():
            s->depth==1?bx_v2_subgroup_count(s->section):
            s->depth==2?bx_v2_option_count(s->section,s->subgroup):
            s->depth==3?bx_catalog_group_count((BxLibrary)s->library):0;
  if(count<=0)return e;
  int *index=s->depth==0?&s->section:s->depth==1?&s->subgroup:
             s->depth==2?&s->option:&s->catalog_group;
  *index=(*index+(key==BX_KEY_UP?count-1:1))%count;
  if(s->depth==0){s->subgroup=0;s->option=0;s->catalog_group=0;}
  if(s->depth==1){s->option=0;s->catalog_group=0;}
  e.changed=1;return e;
 }
 if(key==BX_KEY_SELECT){
  if(s->depth==0){s->depth=1;s->subgroup=0;s->option=0;s->catalog_group=0;e.changed=1;return e;}
  if(s->depth==1){s->depth=2;s->option=0;e.changed=1;return e;}
  if(s->depth==3){e.action=BX_ACT_CATALOG_INFO;e.changed=1;return e;}
  const BxOption *opt=bx_v2_option(s->section,s->subgroup,s->option);
  if(!opt)return e;
  e.changed=1;e.action=opt->action;e.feature_id=opt->feature_id;
  if(opt->action==BX_ACT_OPEN_CATALOG){
   s->depth=3;s->library=opt->library;s->catalog_group=0;
  }
  return e;
 }
 return e;
}
int bx_v2_render(const BxMenuV2 *s,char *out,size_t size){
 if(!s||!out||!size)return -1;
 if(!s->opened)return snprintf(out,size,"BX-GTA | Menu fechado");
 if(s->depth==0){
  const int count=bx_v2_section_count();
  if(s->section<0||s->section>=count)return snprintf(out,size,"Menu invalido");
  return snprintf(out,size,"BX-GTA / PRINCIPAL\n  %s\n> %s (%d/%d)\n  %s",
    bx_v2_section_title((s->section+count-1)%count),
    bx_v2_section_title(s->section),s->section+1,count,
    bx_v2_section_title((s->section+1)%count));
 }
 if(s->depth==1){
  const int count=bx_v2_subgroup_count(s->section);
  if(s->subgroup<0||s->subgroup>=count)return snprintf(out,size,"Submenu invalido");
  return snprintf(out,size,"BX-GTA / %s\n> %s (%d/%d)\nX abrir | O voltar",
     bx_v2_section_title(s->section),bx_v2_subgroup_title(s->section,s->subgroup),
     s->subgroup+1,count);
 }
 if(s->depth==2){
  const BxOption *it=bx_v2_option(s->section,s->subgroup,s->option);
  if(!it)return snprintf(out,size,"Opcao invalida");
  const int count=bx_v2_option_count(s->section,s->subgroup);
  const BxOption *next=bx_v2_option(s->section,s->subgroup,(s->option+1)%count);
  return snprintf(out,size,"BX-GTA / %s\n> %s (%d/%d)%s\n  %s",
    bx_v2_subgroup_title(s->section,s->subgroup),it->title,s->option+1,count,
    it->action==BX_ACT_UNAVAILABLE?" [pendente]":"",next?next->title:"");
 }
 if(s->depth==3){
  const BxCatalogGroup *g=bx_catalog_group((BxLibrary)s->library,s->catalog_group);
  if(!g)return snprintf(out,size,"Catalogo invalido");
  return snprintf(out,size,"BX-GTA / %s\n> %s (%d/%d)\n%u referencias\n%s / %s",
    bx_catalog_title((BxLibrary)s->library),g->group,s->catalog_group+1,
    bx_catalog_group_count((BxLibrary)s->library),g->total,g->example_a,g->example_b);
 }
 return snprintf(out,size,"Tela invalida");
}
