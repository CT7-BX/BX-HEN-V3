## PS4 v0.24 + Android Gateway v0.4 — estabilidade e novo visual

O PKG PS4 recebeu um novo painel VideoOut nativo, com fundo em degradê, cartões arredondados, código temporário em destaque, progresso e orientação para falhas. O residente passou a recuperar inicialização de rede e conexões HTTPS interrompidas com backoff, mantendo a parada manual, e a evitar gravação repetitiva dos mesmos logs. O pareamento do PKG tolera até duas falhas de consulta transitórias. **Isso não cria vídeo ou controle do PS4 no navegador.**

O APK Android ganhou uma interface mais moderna com três cartões: Sistema, Conectividade HTTPS e Próximos passos. O teste HTTPS é voluntário, usa apenas o endpoint público `/health`, tempos máximos de cinco segundos, sem autenticação nem dados do PS4. **A única permissão Android adicionada é INTERNET**, sem câmera, áudio, captura de tela ou execução contínua. O relatório de hardware continua privado até cópia voluntária. Não confundir servidor alcançável com console conectado.

# BX-REMOTE-PLAY — interface, pareamento PS4 e mídia WHEP experimental

## Interface v0.26 — BX Command Center

A página principal ganhou uma **central de modos interativa**, sem alterar os protocolos ou a execução do player. Os quatro caminhos são: BX Native (PS4 → iPhone, ainda em desenvolvimento), Gateway Android (APK diagnóstico v0.3, sem streaming), cliente Remote Play externo no iPhone (jogável no próprio app, compatibilidade a testar) e Mac P2P (transmissor experimental WebRTC já existente). Cada modo mostra passos específicos, progresso **marcado manualmente e não salvo**, um botão que abre a seção real, uma advertência própria e opção de copiar um checklist local sem PIN/token.

Um painel lateral consulta apenas os elementos **já exibidos** pelo navegador para indicar o estado do servidor HTTPS, vínculo aprovado, fonte P2P/WHEP anexada e versão pública do PKG. Não afirma que o PS4 está online pelo simples fato do Worker responder nem que anexar mídia equivale a jogar. No iPhone, uma barra de navegação inferior respeita o recorte de tela e as áreas seguras; atalhos revelam corretamente seções recolhidas.

Estilos e código separados em `command-center.css` e `command-center.js`, ambos publicados pela allowlist restrita do GitHub Pages, sem novas bibliotecas ou ligações de rede. Os testes cobrem rotas, destinos, estado do sistema, progresso, interface Android e ausência de credenciais. O menu nativo PS4/PKG continua **v0.22**; esta atualização não adiciona transmissão direta de jogos.

A [central Android](gateway.html) também recebeu nova hierarquia visual e roteiro por etapas, e o APK diagnóstico usa três cartões nativos e versão 0.3.


## Web v0.25 + Android Gateway v0.2 — diagnóstico mais robusto

A central Android agora permite **compartilhar o endereço público com o celular antigo** pelo menu de compartilhamento do iPhone, pela área de transferência ou por um endereço selecionável. Não inclui PINs, token, conta ou endereço do PS4. Os testes de compatibilidade continuam locais e voluntários.

O APK diagnóstico v0.2, para Android 7+, acrescenta **RAM livre e sinalização de pressão de memória, nível/temperatura da bateria** e, em Android 10+, estado térmico declarado pelo sistema. Mantém o relatório ao girar o celular, habilita a cópia apenas após a análise e não exige novas permissões. As medições são instantâneas e **não autorizam uso desassistido de 24 horas**. Continua sem conexão com jogos ou transmissão real.

O autodiagnóstico da página principal agora verifica `/health` e `update.txt` **simultaneamente, com prazos de resposta independentes**. Se o Worker travar, a versão oficial do PKG ainda poderá ser consultada; se o manifesto falhar, o estado HTTPS ainda poderá ser mostrado. Os testes automatizados validam timeout, cancelamento, ordem das respostas e ausência de credenciais.

**O PKG do PS4 permanece v0.22.** Não há mudança nativa no PS4 nem alegação de streaming direto de jogos nesta atualização.

## Android Gateway v0.24 — compatibilidade de aparelhos antigos

O BX passa a ter uma [central Android](gateway.html), integrada por um quarto atalho no player principal. A página verifica localmente (sem enviar dados) versão Android detectável, RAM estimada pelo navegador, CPU declarada, APIs WebRTC e suporte à captura de tela do navegador. Os resultados são apenas estimativas e vêm acompanhados de alertas sobre Android antigo, restrições de áudio e ausência de captura web no Chrome Android.

O diretório [android-gateway](../android-gateway/README.md) contém um **APK nativo experimental de diagnóstico**, com Android 7+ (API 24) como requisito de compilação. Ele mede informações reais do sistema e codecs H.264 sem pedir permissões nem realizar chamadas de rede; o usuário decide se copia o relatório. A workflow do Android gera o APK de teste quando o código passa pela compilação. Esse app **não é um cliente Remote Play e ainda não retransmite jogos**.

A integração de transporte PS4 → Android → iPhone continua pendente, inclusive registro de sessão, vídeo, áudio e retorno de comandos. O modo BX Native PS4 → iPhone continua uma frente de desenvolvimento separada. Ao contrário de testes via Mac, o Chrome Android normalmente não fornece `getDisplayMedia()`; para fazer captura de tela futuramente será preciso um aplicativo com permissão `MediaProjection`, e áudio de outros aplicativos depende de Android 10+ e da política do aplicativo fonte.

## Interface web v0.23 — confiabilidade e autodiagnóstico

A página v0.23 mantém o tema preto/vermelho e passa a ter **Verificação rápida do BX**. O botão **Verificar sistema** testa somente informações públicas: contexto HTTPS, APIs WebRTC, codec H.264 conforme a capacidade declarada pelo navegador, endpoint público `/health` do BX-REMOTE-LINK e manifesto `remote/update.txt`. O resultado aparece em linhas com estados e pode ser copiado como relatório seguro, **sem acessar PIN, token, IP local ou credenciais do console**. O status público do Worker **não prova que o PS4 está ligado** nem que uma sessão de jogo está funcionando.

Foi corrigido um defeito de ciclo de vida: o player recebia mídia por WHEP e pelo teste P2P de Mac no mesmo elemento `video`, mas a desconexão tardia de uma fonte podia apagar a imagem de outra. A nova camada `media-source-core.js` atribui a posse da tela à fonte `whep` ou `p2p`, avisa a fonte substituída para encerrar e ignora liberações atrasadas. O player preserva a ativação do áudio quando uma trilha adicional chega à **mesma** sessão, mas inicia mudo ao trocar de fonte para compatibilidade com Safari/iOS. Os testes cobrem posse, substituição, liberação, privacidade do diagnóstico e arquivos do GitHub Pages.

**O PKG continua na v0.22.** Essa correção é apenas web e não requer reinstalação. O BX ainda não integra um cliente nativo Remote Play no navegador; o teste P2P com Mac e o gateway WHEP continuam fontes independentes, e nenhum deles significa que o PS4 esteja transmitindo diretamente ao BX.

## Interface v0.22 — visual unificado preto e vermelho

O layout principal e o transmissor temporário [bridge.html](bridge.html) agora compartilham `site-v2.css`. A página principal traz navegação direta para Player, Vincular e Atualizações, atalhos para jogar sem Mac (cliente externo), conectar PS4 ou consultar PKG, estado da mídia honesto e configuração avançada recolhida por padrão. O script `site-ui.js` abre as seções de destino sem alterar pareamento, mídia, controle virtual ou credenciais. Ambos os arquivos foram incluídos na lista explícita do build GitHub Pages e possuem testes de regressão, iPhone/desktop e navegação por teclado. Nenhum vídeo foi criado artificialmente.

O painel do PKG v0.22 também ganhou hierarquia visual atualizada (VideoOut nativo 1920×1080), com código de pareamento destacado, etapas e controles mais claros. O serviço ELF preserva as funções da v0.21, mas precisa ser copiado novamente ao instalar a nova versão pelo TRIÂNGULO; a estabilidade durante jogos e a imagem PS4→BX ainda exigem testes físicos.

A página principal em [index.html](index.html) prioriza a tela e o controle físico. Sem controle conectado no iPhone, o modo automático mostra um DualShock virtual **sobre a área de vídeo**.

## Central de atualizações do PKG (consulta pública)

A página `remote/` possui a seção **Atualizar PKG do PS4 — versão oficial**. Ao abrir essa seção ou pressionar **Verificar versão oficial**, o navegador consulta o manifesto público `remote/update.txt` sem enviar credenciais ou tokens. O formulário exibe a versão publicada, o SHA-256 informado pelo release e links para baixar o pacote no GitHub ou abrir sua página de release. O link só é habilitado quando nome do arquivo, versão, `BRPM00001`, hash e domínio de download correspondem exatamente ao formato oficial do projeto. **O navegador não instala o PKG nem detecta qual versão está instalada no PS4.**

Para atualização no próprio console, o **PKG Dashboard v0.19** contém um OTA experimental: ao abrir o aplicativo com conexão/configuração privada válida, verifica se existe uma versão publicada mais recente, tenta baixá-la, checa o SHA-256 e pede X antes de instalar. Isso ainda não comprova êxito de instalação no hardware; se o instalador experimental falhar, use o Package Installer do GoldHEN com o PKG transferido por USB/FTP. Para instalar uma versão publicada pelo site, baixe o pacote e transfira ao PS4: **clicar no site não envia instalação para o console**.

O ELF residente atual só envia heartbeats HTTPS. Para oferecer no futuro **Solicitar atualização pelo site**, seria necessário um serviço autenticado que recebesse esse pedido, validasse a autorização específica do usuário e exigisse confirmação no console antes de instalar. Não há endpoint para isso hoje; portanto, o site não mostra botão de instalação remota.

**Correção de publicação:** o script GitHub Pages agora copia `media-whep.js` e `media-controls.js`, que já existiam no repositório mas eram omitidos da pasta `_site`. Também publica `pkg-updates.js`. O workflow verifica a presença desses arquivos para evitar regressões. O receptor WHEP ainda depende de um gateway real e continua sem vídeo de PS4 até haver uma fonte.

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

## Primeiro comando remoto autenticado sem Mac — PKG v0.21

Após um vínculo HTTP temporário aprovado no PS4, a página oferece o botão **Testar comunicação PS4 ↔ celular**. Ele solicita pelo Worker um único comando seguro, que o serviço ELF residente (com PKG fechado) recebe no heartbeat HTTPS, executa como sonda local TCP 9295 e responde ao mesmo navegador. Não é um canal de jogo: não transmite imagem, áudio ou comandos do controle. O token de vínculo fica só em memória durante a autorização, o pedido expira em até 90 segundos e o cancelamento local interrompe a consulta.

Para testar **jogos reais já, sem Mac**, o site também aponta para clientes de Remote Play existentes no iPhone. O PS Remote Play oficial requer conta PlayStation; o PXPlay permite alternativas de registro local, mas a compatibilidade com GoldHEN e a versão do console não foi confirmada. O vídeo aparecerá no aplicativo externo, não no BX. Consulte o [estudo comparativo](../docs/NATIVE-BRIDGE-RESEARCH.md).

## Primeiro diagnóstico independente de Mac — PKG v0.20

Após instalar v0.20 no PS4, o ELF residente atualizado verifica localmente a porta TCP 9295 (Remote Play) e envia por HTTPS autenticado apenas o resultado booleano. Ao aprovar um vínculo temporário pelo PKG, o navegador exibe se a porta respondeu, não respondeu, ou se houve erro. O Worker mostra esse diagnóstico **somente** a um requerente aprovado e oculta dados antigos. A verificação não exige Mac ou PC, mas **não envia imagem, áudio ou comandos** e não valida uma sessão Remote Play real. A etapa seguinte é uma ponte de transporte TCP/UDP e um cliente WebAssembly compatível com iOS. Consulte [Plano PS4-only](../docs/PS4-ONLY-VIDEO-BRIDGE.md).

## Piloto P2P para imagem real no player do BX

O arquivo [bridge.html](bridge.html) permite que um Mac com Chiaki conectado ao PS4 compartilhe uma janela/aba **sob permissão explícita do navegador**, enviando mídia WebRTC diretamente a outro navegador. No iPhone, a seção **Receber imagem do Mac — teste P2P real** aceita um código privado de sessão de 64 caracteres e anexa as trilhas reais ao player BX. Áudio depende da captura suportada pelo navegador. **O Mac precisa ficar ligado e o PKG v0.19 não envia vídeo nem controla jogos.**

A sinalização temporária usa o Worker existente `bx-remote-link` (rotas `/v1/media/*`). Este recurso exige que a nova versão do Worker esteja implantada; publicar os arquivos estáticos do GitHub Pages não é suficiente. Por segurança, os códigos não entram nas URLs. Para instruções completas, limitações de rede e privacidade, veja [P2P-REAL-VIDEO-PILOT.md](../docs/P2P-REAL-VIDEO-PILOT.md).

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
