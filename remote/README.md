# BX-REMOTE-PLAY — interface, pareamento PS4 e mídia WHEP experimental

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
- Receptor WebRTC/WHEP funcional para trilhas reais de vídeo e áudio fornecidas por um gateway HTTPS compatível (não fornece por si só mídia do PS4). Sem frames artificiais. O painel mostra contadores reais de quadros decodificados e bytes de áudio recebidos via `RTCPeerConnection.getStats()` quando há um gateway.
- Integração opcional com relay WSS para teste com **console simulado**, com token de jogador informado manualmente, sem armazenamento local de credenciais.
- Indicador RTT do navegador até o relay; **não** é ping do PS4 ou latência real do jogo.
- Liberação de comandos de toque quando termina a pressão ou quando a página perde foco.

## Teste físico de vídeo e áudio sem manter o PKG aberto

O painel **Testar imagem e áudio reais do PS4 — primeira etapa** orienta a validar o serviço Remote Play nativo com um cliente Chiaki local. A aprovação HTTPS do BX v0.19, o PIN do Remote Play e o fluxo WHEP são mecanismos **distintos**. Para uma primeira prova física, siga [o plano de teste real de vídeo e áudio](../docs/REAL-AV-TEST-PLAN.md). Os contadores WHEP do site servem para verificar mídia de um gateway, mas não verificam a identidade da origem PS4.

## O que ainda não funciona

**Ainda não existe um gateway integrado ao PS4 capaz de fornecer vídeo/áudio**, agente permanente, autenticação de sessão Remote Play nativa, captura do protocolo Remote Play ou servidor de mídia implantado. O receptor WHEP pode exibir vídeo/áudio de um gateway que você configure, mas não cria a fonte. O relay atual só confirma comandos com um console **simulado**. O PKG compilado é teste HTTPS de execução única, não um serviço de streaming.

O GitHub Pages hospeda apenas a interface, sem gateway TCP/UDP, TURN ou processo Node. Consulte [Integração real de mídia](../docs/REAL-MEDIA-GATEWAY.md) para usar Chiaki-NG-Web em cliente externo ou configurar um endpoint WHEP de mídia compatível.

## Como testar

Acesse o site publicado e tente a interface em portrait/landscape. Sem controle físico no iPhone, verifique os botões que aparecem automaticamente. Com um DualShock 4 pareado, verifique que o modo automático os oculta e prefere o controle físico. Faça combinações com analógicos e botões simultaneamente. O botão Tela cheia deve usar native fullscreen onde houver suporte, ou modo imersivo no Safari do iPhone.

Para simular transmissão de comandos por rede, execute o servidor em [relay/](../relay/) e um simulador de console conforme o [README do relay](../relay/README.md); configure WSS seguro se estiver testando em outra máquina. **Não abra o relay de laboratório à internet sem TLS, controle de acesso e revisão de segurança.**

Os testes de interface são executados com:

    node --test remote/tests/*.test.cjs

O núcleo do futuro payload tem documentação separada em [AUTORUN-DESIGN.md](../ps4-agent/AUTORUN-DESIGN.md). Confira também [LOW-LATENCY-AND-NETWORK.md](../docs/LOW-LATENCY-AND-NETWORK.md) e o [estudo técnico anterior](../docs/REMOTE-PLAY-RESEARCH-2026-11-15.md).

## Verificação da rede local

O comando `npm run probe:ps4 -- 192.168.1.20` na pasta `relay/` testa **somente** a conectividade TCP 9295 do IP privado indicado, sem autenticar ou abrir uma sessão Remote Play. Veja [PS4-CONNECTION-AND-PKG.md](../docs/PS4-CONNECTION-AND-PKG.md).

## Vínculo com console (laboratório v0.5)

No painel lateral, abra **Vincular console (laboratório)** para testar o simulador WSS; o fluxo HTTPS com PKG real é separado. Um servidor relay de teste e um console **simulado** devem estar ativos; digite o código apresentado pelo simulador e aguarde aprovação explícita. Quando aprovado, a interface passa o token temporário diretamente ao WebSocket de controle. O token não é guardado no navegador e não é exibido no HTML.

**O PKG Pair Test v0.15 oferece um fluxo experimental de vínculo HTTPS com confirmação no PS4, sujeito a configuração privada e validação física.** Isso não estabelece sessão de jogo nem transmite vídeo. O site público GitHub Pages não tem backend próprio implantado. Consulte [o guia de vínculo](../docs/PAIRING-AND-REAL-PS4.md).

## Teste de conexão com o relay

Na seção **Vincular PS4 — conexão experimental**, informe o endereço HTTPS do Worker e selecione **Testar servidor HTTPS**. O campo **Servidor WSS** é exclusivo do simulador. O site consulta o endpoint público `/health` com limite de 5,5 segundos e informa se encontrou um relay compatível. Esse teste **não vincula o PS4, não verifica um console online e não confirma imagem ou áudio**.

O vínculo por código pode ser testado com simulador ou com o PKG PS4 experimental; o sucesso da compilação não substitui a validação de ponta a ponta em hardware. A geração local e privada de credenciais está descrita em [native-pair/README.md](../native-pair/README.md). O GitHub Pages não hospeda o backend.

## Primeiros testes — v0.7

O painel **Primeiros testes — checklist e diagnóstico** permite conferir recursos básicos do navegador, marcar etapas manualmente e copiar um **relatório local que não contém IP, endereço do relay, código do vínculo, token nem identificadores de controle**. Os campos de vídeo e controle real do PS4 permanecem explicitamente como não implementados. O relatório só é gerado no navegador; não é enviado para nenhum backend. Consulte o [guia de testes físicos](../docs/FIRST-HARDWARE-TESTS.md).

As chamadas de pareamento HTTP no navegador agora possuem limite de 6,5 segundos cada e podem ser interrompidas ao cancelar, sair da página ou iniciar outra tentativa. Isso diminui a chance de uma solicitação ficar presa em redes instáveis.

### Servidor de vínculo sugerido

O campo HTTPS é preenchido com `https://bx-remote-link.4rt949zpj8.workers.dev`, correspondente ao Worker exclusivo BX-REMOTE-LINK implantado no Cloudflare. O Worker não oferece WebSocket nem vídeo. O endpoint `/health` informa `configured:false` enquanto o titular da conta não definir o segredo privado do PS4. A configuração manual está em [cloudflare/README.md](../cloudflare/README.md). A disponibilidade do endereço público ainda precisa de um teste real no navegador.

## Conexão HTTPS direta de pareamento

O campo do site agora aceita diretamente `https://bx-remote-link.4rt949zpj8.workers.dev`. Isso é mais preciso: o serviço Cloudflare oferece uma **API HTTPS de vínculo**, não WebSocket de controle. Endereços legados `wss://.../v1/link` do simulador continuam aceitos e são convertidos em base HTTPS para os pedidos de código. `http://` sem TLS continua aceito apenas em localhost para teste local.

O botão **Testar servidor** diferencia serviço online sem chave secreta, serviço preparado, endereço inválido e rede indisponível. O navegador interrompe uma verificação antiga ao alterar o servidor, evitando status incorreto. A aprovação via PKG real continua a significar **somente vínculo HTTP**, sem vídeo/áudio ou controles do jogo.

## Pareamento guiado no celular — v0.8

Ao expandir **Vincular PS4 — conexão experimental**, o site verifica o servidor HTTPS uma vez sem enviar token ou código. O formulário inclui três passos para o teste com PKG v0.15: abrir o aplicativo no console, digitar os oito dígitos exibidos na TV, depois confirmar com X ou recusar com O. É possível colar códigos com espaço/hífen. O navegador exibe a contagem regressiva enquanto aguarda a resposta, e a solicitação cancelada não pode retomar a espera caso uma resposta antiga chegue atrasada.

O diagnóstico exportável distingue `unconfigured` (Worker online, sem chave) dos estados de rede falha, inválida e preparada; **não registra credenciais**. A aprovação HTTP não inicia vídeo, áudio ou controle do PS4.

### Diagnóstico de HTTPS no navegador (interface 0.9)

Quando o botão **Testar servidor HTTPS** é clicado em **Vincular PS4 — conexão experimental**, um código independente dos módulos de controles mostra imediatamente **Verificando HTTPS...** e depois informa o resultado ou falha. Isso evita parecer que o botão não fez nada caso o módulo de jogos ou o módulo de pareamento não carregue. Há também o link **Abrir diagnóstico HTTPS direto (sem chave)**, que permite inspecionar `/health` fora da interface. O teste não envia nem revela o segredo do console. Uma resposta configurada do backend **não** prova que o PS4 esteja online nem habilita jogos remotos. O campo **Servidor WSS** pertence exclusivamente ao simulador.

### Resiliência no navegador móvel — interface v0.10

- No pareamento, uma queda temporária da internet (erro de rede, timeout ou HTTP 5xx) **durante a consulta do status** não cancela imediatamente o pedido: o navegador tenta ler **o mesmo vínculo** no máximo duas vezes adicionais. A chamada `POST /v1/pair/claim` **nunca é repetida automaticamente**, para evitar solicitações duplicadas.
- Erros permanentes (código inválido, solicitação expirada, bloqueio por tentativas, autorização negada) encerram o teste imediatamente, com mensagem.
- Ao sair da página ou voltar pelo histórico do Safari, requisições pendentes são canceladas e os botões voltam ao estado normal; nunca é retomada uma autorização antiga silenciosamente.
- O botão de saúde HTTPS também é restaurado após retorno do navegador e verifica novamente o servidor caso a seção esteja aberta.
- O simulador WSS permanece separado. Não há streaming, controle real de jogos ou conexão de mídia ao PS4.

## Estado de integração (novembro de 2026)

- Controles virtuais, Gamepad API, diagnósticos e verificações de navegador: implementados no frontend; dependem das permissões e capacidades do navegador.
- Worker HTTPS e PKG Dashboard v0.19: vínculo experimental com confirmação local no PS4; **não** é transporte de jogos.
- WSS `/v1/link`: relay separado para simulador, não é oferecido pelo Worker HTTPS.
- Perfis de qualidade e rota: metas visuais, sem encoder, servidor de mídia ou seleção efetiva de transporte.
- Receptor de mídia WHEP/WebRTC: **implementado no navegador**, sujeito a fonte externa; vídeo/áudio do PS4, comandos reais, gateway Chiaki→WHEP e serviço residente capaz de transmitir mídia: **não implementados**. O ELF existente é apenas um serviço experimental de heartbeat HTTPS.
- A v0.19 preserva a atualização experimental do PKG e inclui interface nativa exibida no PS4, confirmada pelo usuário. Isso ainda não representa streaming de jogos.

Para um teste físico, valide separadamente a saúde do Worker, a configuração privada do console, a exibição do código, a confirmação local e o resultado do vínculo. Nunca publique tokens ou arquivos `.cfg` privados.
