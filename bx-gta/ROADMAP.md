# BX-GTA Menu — Viabilidade e prioridades (v0.9)

**Alvo**: PS4 / GoldHEN / GTA V 1.57 / CUSA00419. A notificação de carregamento da versão diagnóstica 0.6.3 foi confirmada pelo usuário; as versões 0.7, 0.8 e 0.9 ainda precisam de testes no PS4 físico.

**Escopo atual**: plugin PRX com menu baseado em notificações, núcleo portável com testes GCC/Clang e sanitizers. **Não** é um mod menu gráfico e **não** altera o GTA V.

| # | Funcionalidade pedida | Prioridade | Estado / bloqueio |
|---|---|---|---|
| 1 | Painel gráfico dentro do GTA | P1 | Pendente: integração de renderizador PS4/GTA e teste de estabilidade |
| 2 | Temas e cores personalizáveis | P0 | Núcleo pronto: quatro paletas e seis acentos, sem desenho no jogo |
| 3 | Personalização de roupas | P2 | Pendente: adaptador de nativos/recursos GTA 1.57 |
| 4 | Lista de veículos por categoria | P1 | Pendente: catálogo veicular e chamada segura ao engine |
| 5 | Teleporte por marcador | P2 | Pendente: coordenadas, proteção de limites e validação de modo |
| 6 | Diagnóstico GoldHEN | P0 | Plugin carrega e fornece diagnósticos básicos; não lê versão exata do GoldHEN |
| 7 | Detecção automática de CUSA | P0 | Checagem CUSA00419 e versões 1.57/01.57 no carregamento |
| 8 | Registros de erro | P0 | Arquivo com rotação em /data/GoldHEN/BXGTA/error.log |
| 9 | Personalização de cores e rodas | P2 | Pendente: interface nativa de veículos GTA |
| 10 | Reparo de veículos | P2 | Pendente: função validada de jogo/modo |
| 11 | Garagem e favoritos | P2 | Pendente: persistência de garagem distinta dos favoritos do menu |
| 12 | Velocímetro | P1 | Pendente: leitura validada de velocidade e overlay |
| 13 | Presets de aparência | P2 | Pendente: adaptador de roupas/personagens |
| 14 | Animações e gestos | P2 | Pendente: animações nativas GTA |
| 15 | Modelos de personagem compatíveis | P2 | Pendente: validação de recursos e troca segura |
| 16 | Pesquisa e navegação rápida | P0 | Catálogo indexado; consulta usa valor query= do perfil via FTP |
| 17 | Favoritos e opções recentes | P0 | Persistência e teclas L1+Esquerda; listas ainda resumidas |
| 18 | Salvar preferências | P0 | Três arquivos de perfil de texto, escrita temporária + rename |
| 19 | Permissões do servidor privado | P3 | Pendente: integração de APIs de autorização fornecidas pelo próprio servidor |
| 20 | Scripts Lua compatíveis | P3 | Pendente: sandbox, cotas de execução e APIs permitidas, sem suporte atual |
| 21 | Perfis de configuração | P0 | Três slots de configuração com carga/salvamento |
| 22 | Presets cinematográficos | P2 | Pendente: overlay/câmera/filtros |
| 23 | Filtros visuais | P2 | Pendente: pipeline de renderização |
| 24 | Ocultar elementos da HUD | P2 | Pendente: mecanismo reversível do engine |
| 25 | Câmera livre | P2 | Pendente: controles de câmera seguros e restauração |
| 26 | Locais favoritos | P2 | Pendente: esquema de coordenadas e armazenamento por perfil |
| 27 | Clima e horário | P2 | Pendente: funções do engine para sessão permitida |
| 28 | Marcadores personalizados | P2 | Pendente: leitura/escrita de marcadores via game API |

## Uso do v0.9

- Instale `BXGTA_menu.prx` em `/data/GoldHEN/plugins/`.
- Em `/data/GoldHEN/plugins.ini`, sob `[CUSA00419]`, acrescente `/data/GoldHEN/plugins/BXGTA_menu.prx=true` sem duplicar a seção.
- Remova a entrada de versões anteriores BXGTA_menu/BXGTA_diag, para evitar plugins duplicados.
- Reinicie GTA V; `L1 + Direita` abre o menu, setas navegam, X seleciona, O volta; `L1 + Esquerda` marca o item destacado como favorito.
- O sistema salva os perfis em `/data/GoldHEN/BXGTA/profile0.ini`, `profile1.ini` e `profile2.ini`. No perfil, `query=camera` pode ser alterado via FTP e depois recarregado no menu.
- As paletas são apenas configurações para uma futura interface gráfica e **não** mudam as notificações atuais.
- O plugin não implementa mods jogáveis, cheats de servidor, scripts Lua, ou interface gráfica. Não anuncie funcionamento dessas opções.

## Critérios para o próximo marco

1. Teste no PS4 da v0.9: a notificação aparece? `L1+Direita` navega? Persistência funciona após reiniciar?
2. Renderizador do painel: implementar backend real e testar ciclos de abrir/fechar com segurança; manter o menu de notificações como fallback.
3. Engine GTA: identificar nativos compatíveis com 1.57 CUSA00419, construir adaptador versionado; testar primeiro em jogo individual e sem efeitos permanentes.
4. Servidores privados: exigir APIs/autorização documentadas; não presumir permissões nem suporte geral.
5. Lua: somente depois de sandbox, limites e interfaces explícitas de permissão.
