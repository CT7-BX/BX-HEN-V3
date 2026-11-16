# BX-REMOTE-PLAY — tela de jogo experimental 0.8

A página principal em [index.html](index.html) prioriza a tela e o controle físico. Sem controle conectado no iPhone, o modo automático mostra um DualShock virtual **sobre a área de vídeo**.

## Funcionalidades implementadas no navegador

- Reconhecimento de controle físico via Gamepad API e prioridade para ele em modo automático.
- Controles translúcidos e mais circulares, posicionados nas bordas com organização inspirada no Remote Play oficial, sem reutilizar imagens ou código de terceiros.
- Ajustes de tamanho e transparência do controle virtual (apenas na sessão atual).
- Dois toques rápidos em um analógico acionam L3 ou R3, de forma semelhante aos gestos documentados do app oficial.
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

## Verificação da rede local

O comando `npm run probe:ps4 -- 192.168.1.20` na pasta `relay/` testa **somente** a conectividade TCP 9295 do IP privado indicado, sem autenticar ou abrir uma sessão Remote Play. Veja [PS4-CONNECTION-AND-PKG.md](../docs/PS4-CONNECTION-AND-PKG.md).

## Vínculo com console (laboratório v0.5)

No painel lateral, abra **Vincular console (laboratório)**. Um servidor relay de teste e um console **simulado** devem estar ativos; digite o código apresentado pelo simulador e aguarde aprovação explícita. Quando aprovado, a interface passa o token temporário diretamente ao WebSocket de controle. O token não é guardado no navegador e não é exibido no HTML.

**Ainda não vincula um PS4 físico nem transmite vídeo.** O site público GitHub Pages não tem backend próprio implantado. Consulte [o guia de vínculo](../docs/PAIRING-AND-REAL-PS4.md).

## Teste de conexão com o relay

Na seção **Vincular PS4 — conexão experimental**, informe seu endpoint WSS de laboratório e selecione **Testar servidor**. O site consulta o endpoint público `/health` com limite de 5,5 segundos e informa se encontrou um relay compatível. Esse teste **não vincula o PS4, não verifica um console online e não confirma imagem ou áudio**.

O vínculo por código pode ser testado com simulador ou com o PKG PS4 experimental ainda não validado em hardware. A geração local e privada de credenciais está descrita em [native-pair/README.md](../native-pair/README.md). O GitHub Pages não hospeda o backend.

## Primeiros testes — v0.7

O painel **Primeiros testes — checklist e diagnóstico** permite conferir recursos básicos do navegador, marcar etapas manualmente e copiar um **relatório local que não contém IP, endereço do relay, código do vínculo, token nem identificadores de controle**. Os campos de vídeo e controle real do PS4 permanecem explicitamente como não implementados. O relatório só é gerado no navegador; não é enviado para nenhum backend. Consulte o [guia de testes físicos](../docs/FIRST-HARDWARE-TESTS.md).

As chamadas de pareamento HTTP no navegador agora possuem limite de 6,5 segundos cada e podem ser interrompidas ao cancelar, sair da página ou iniciar outra tentativa. Isso diminui a chance de uma solicitação ficar presa em redes instáveis.

### Servidor de vínculo sugerido

O site preenche automaticamente `wss://bx-remote-link.4rt949zpj8.workers.dev/v1/link`, correspondente ao Worker exclusivo BX-REMOTE-LINK implantado no Cloudflare. A URL WSS é usada **apenas para derivar as rotas HTTPS de pareamento**; o Worker não oferece WebSocket nem vídeo. O endpoint `/health` informa `configured:false` enquanto o titular da conta não definir o segredo privado do PS4. A configuração manual está em [cloudflare/README.md](../cloudflare/README.md). A disponibilidade do endereço público ainda precisa de um teste real no navegador.

## Conexão HTTPS direta de pareamento

O campo do site agora aceita diretamente `https://bx-remote-link.4rt949zpj8.workers.dev`. Isso é mais preciso: o serviço Cloudflare oferece uma **API HTTPS de vínculo**, não WebSocket de controle. Endereços legados `wss://.../v1/link` do simulador continuam aceitos e são convertidos em base HTTPS para os pedidos de código. `http://` sem TLS continua aceito apenas em localhost para teste local.

O botão **Testar servidor** diferencia serviço online sem chave secreta, serviço preparado, endereço inválido e rede indisponível. O navegador interrompe uma verificação antiga ao alterar o servidor, evitando status incorreto. A aprovação via PKG real continua a significar **somente vínculo HTTP**, sem vídeo/áudio ou controles do jogo.

## Pareamento guiado no celular — v0.8

Ao expandir **Vincular PS4 — conexão experimental**, o site verifica o servidor HTTPS uma vez sem enviar token ou código. O formulário inclui três passos para o teste com PKG v0.12: abrir o aplicativo no console, digitar os oito dígitos exibidos na TV, depois confirmar com X ou recusar com O. É possível colar códigos com espaço/hífen. O navegador exibe a contagem regressiva enquanto aguarda a resposta, e a solicitação cancelada não pode retomar a espera caso uma resposta antiga chegue atrasada.

O diagnóstico exportável distingue `unconfigured` (Worker online, sem chave) dos estados de rede falha, inválida e preparada; **não registra credenciais**. A aprovação HTTP não inicia vídeo, áudio ou controle do PS4.
