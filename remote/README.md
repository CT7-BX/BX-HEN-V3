# BX-REMOTE-PLAY — tela de jogo experimental 0.3

A página principal em [index.html](index.html) prioriza a tela e o controle físico. Sem controle conectado no iPhone, o modo automático mostra um DualShock virtual **sobre a área de vídeo**.

## Funcionalidades implementadas no navegador

- Reconhecimento de controle físico via Gamepad API e prioridade para ele em modo automático.
- Modo automático, sempre mostrar ou ocultar os botões virtuais.
- Dois analógicos multitoque com deadzone, cruz, círculo, quadrado, triângulo, D-pad, L1/R1/L2/R2, L3/R3, Share, Options, PS e toque no touchpad como botão. A superfície tátil com posições e gestos reais não está implementada.
- Botão de tela cheia do palco (vídeo + controles) quando o navegador aceita Fullscreen API. No Safari do iPhone, usa modo imersivo CSS e pode ser aberto via **Adicionar à Tela de Início**. O Safari ainda pode apresentar barras e não oferece garantia de fullscreen nativo.
- Arquivo manifest e ícone SVG para uso como web app.
- Três perfis de resolução e frame rate como **metas** (540p30, 720p60 e 1080p60). Não afetam um encoder ainda inexistente.
- Seleção de rota local, remota ou automática como **planejamento visual**; não muda o transporte real.
- Tela de vídeo preparada para uma futura MediaStream de um gateway confiável, sem mídia falsa.
- Integração opcional com relay WSS para teste com **console simulado**, com token de jogador informado manualmente, sem armazenamento local de credenciais.
- Indicador RTT do navegador até o relay; **não** é ping do PS4 ou latência real do jogo.
- Liberação de comandos de toque quando termina a pressão ou quando a página perde foco.

## O que ainda não funciona

**Não existe streaming de vídeo ou áudio do PS4**, agente permanente, autenticação real do console, captura do protocolo Remote Play e servidor de mídia implantado. O relay atual só confirma comandos com um console **simulado**. O PKG compilado é teste HTTPS de execução única, não um serviço de streaming.

O GitHub Pages hospeda apenas a interface, sem gateway TCP/UDP, TURN ou processo Node.

## Como testar

Acesse o site publicado e tente a interface em portrait/landscape. Sem controle físico no iPhone, verifique os botões que aparecem automaticamente. Com um DualShock 4 pareado, verifique que o modo automático os oculta e prefere o controle físico. Faça combinações com analógicos e botões simultaneamente. O botão Tela cheia deve usar native fullscreen onde houver suporte, ou modo imersivo no Safari do iPhone.

Para simular transmissão de comandos por rede, execute o servidor em [relay/](../relay/) e um simulador de console conforme o [README do relay](../relay/README.md); configure WSS seguro se estiver testando em outra máquina. **Não abra o relay de laboratório à internet sem TLS, controle de acesso e revisão de segurança.**

Os testes de interface são executados com:

    node --test remote/tests/*.test.cjs

O núcleo do futuro payload tem documentação separada em [AUTORUN-DESIGN.md](../ps4-agent/AUTORUN-DESIGN.md). Confira também [LOW-LATENCY-AND-NETWORK.md](../docs/LOW-LATENCY-AND-NETWORK.md) e o [estudo técnico anterior](../docs/REMOTE-PLAY-RESEARCH-2026-11-15.md).
