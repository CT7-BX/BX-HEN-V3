/*
 * Original summary data derived from the USER-SUPPLIED Synapse.rar JSON
 * configuration lists. The compiled synapse.sprx is NOT embedded or reused.
 * Counts are metadata, not evidence that engine features work on GTA 1.57.
 */
#include "synapse_catalog.h"
static const BxCatalogGroup groups[]={
 {BX_LIB_VEHICLES,"Super",71,"adder","autarch"},
 {BX_LIB_VEHICLES,"Esportivos",98,"alpha","banshee"},
 {BX_LIB_VEHICLES,"Classicos",47,"ardent","boor"},
 {BX_LIB_VEHICLES,"Muscle",76,"blade","buccaneer"},
 {BX_LIB_VEHICLES,"Sedas",43,"asea","asterope"},
 {BX_LIB_VEHICLES,"Coupes",15,"cogcabrio","f620"},
 {BX_LIB_VEHICLES,"Compactos",23,"asbo","blista"},
 {BX_LIB_VEHICLES,"SUV",48,"astron","baller"},
 {BX_LIB_VEHICLES,"Off-road",57,"bfinjection","bifta"},
 {BX_LIB_VEHICLES,"Vans",32,"burrito","burrito2"},
 {BX_LIB_VEHICLES,"Emergencia",21,"ambulance","fbi"},
 {BX_LIB_VEHICLES,"Servico",29,"airtug","bulldozer"},
 {BX_LIB_VEHICLES,"Militares",22,"apc","barracks"},
 {BX_LIB_VEHICLES,"Motos",58,"akuma","bagger"},
 {BX_LIB_VEHICLES,"Bicicletas",7,"bmx","cruiser"},
 {BX_LIB_VEHICLES,"Comerciais",43,"airbus","benson"},
 {BX_LIB_VEHICLES,"Helicopteros",28,"akula","annihilator"},
 {BX_LIB_VEHICLES,"Avioes",40,"alkonost","alphaz1"},
 {BX_LIB_VEHICLES,"Barcos",26,"avisa","dinghy"},
 {BX_LIB_VEHICLES,"Trailers",28,"armytrailer","baletrailer"},
 {BX_LIB_MODELS,"Historia",98,"player_zero","player_one"},
 {BX_LIB_MODELS,"Ambiente",67,"a_m_m_skater_01","a_f_y_bevhills_01"},
 {BX_LIB_MODELS,"Gangues",23,"g_m_y_ballaeast_01","g_m_y_mexgoon_02"},
 {BX_LIB_MODELS,"Servicos",33,"s_m_y_cop_01","s_m_m_paramedic_01"},
 {BX_LIB_MODELS,"Unicos",22,"u_m_y_zombie_01","u_m_m_jesus_01"},
 {BX_LIB_MODELS,"Animais",30,"a_c_boar","a_c_husky"},
 {BX_LIB_MODELS,"Multiplayer",2,"mp_m_freemode_01","mp_f_freemode_01"},
 {BX_LIB_OBJECTS,"Rampas",16,"stt_prop_ramp_adj_flip_m","stt_prop_ramp_jump_s"},
 {BX_LIB_OBJECTS,"Acrobacias",23,"stt_prop_stunt_track_start","stt_prop_stunt_track_jump"},
 {BX_LIB_OBJECTS,"Skate",7,"prop_skate_funbox_cr","prop_skate_flatramp_cr"},
 {BX_LIB_OBJECTS,"Arena",6,"xs_prop_arrow_tyre_01a_wl","xs_prop_arena_wedge_01a_sf"},
 {BX_LIB_OBJECTS,"Barreiras",21,"prop_roadcone01a","prop_barrier_work01a"},
 {BX_LIB_OBJECTS,"Pneus",4,"prop_tyre_spike_01","prop_tyre_wall_01"},
 {BX_LIB_OBJECTS,"Containers",13,"prop_container_01a","prop_container_02a"},
 {BX_LIB_OBJECTS,"Itens",12,"prop_money_bag_01","p_cash_case_s"},
 {BX_LIB_OBJECTS,"Cenario adulto",7,"prop_weed_01","prop_weed_02"},
 {BX_LIB_OBJECTS,"Lazer",12,"prop_beach_fire","prop_bbq_2"},
 {BX_LIB_OBJECTS,"Moveis",23,"prop_couch_01a","prop_tv_01"},
 {BX_LIB_OBJECTS,"Maquinas",21,"prop_dumpster_01a","prop_dumpster_02a"},
 {BX_LIB_OBJECTS,"Diversos",7,"prop_barbell_01a","prop_mp_num_2"},
 {BX_LIB_ANIMATIONS,"Animacoes",204,"base","dance_loop_tyler"},
 {BX_LIB_SCENARIOS,"Cenarios",134,"WORLD_HUMAN_AA_COFFEE","WORLD_HUMAN_BINOCULARS"},
 {BX_LIB_PARTICLES,"Particulas",197,"ent_amb_insect_plane","scr_jewel_fog_volume"}
};
static const char *titles[]={"Veiculos","Modelos","Objetos","Animacoes","Cenarios","Particulas"};
int bx_catalog_group_count(BxLibrary kind) {
 if(kind<BX_LIB_VEHICLES||kind>BX_LIB_PARTICLES)return 0;
 int n=0;
 for(size_t i=0;i<sizeof(groups)/sizeof(groups[0]);++i)
  if(groups[i].library==kind)++n;
 return n;
}
const BxCatalogGroup *bx_catalog_group(BxLibrary kind,int index){
 if(index<0 ||kind<BX_LIB_VEHICLES ||kind>BX_LIB_PARTICLES)return NULL;
 for(size_t i=0;i<sizeof(groups)/sizeof(groups[0]);++i) {
  if(groups[i].library!=kind)continue;
  if(!index--)return &groups[i];
 }
 return NULL;
}
int bx_catalog_total(BxLibrary kind) {
 int total=0;
 for(int i=0;i<bx_catalog_group_count(kind);++i){
  const BxCatalogGroup *g=bx_catalog_group(kind,i);
  if(g)total+=(int)g->total;
 }
 return total;
}
const char *bx_catalog_title(BxLibrary kind){
 return kind>=BX_LIB_VEHICLES&&kind<=BX_LIB_PARTICLES?titles[kind]:"Invalido";
}
