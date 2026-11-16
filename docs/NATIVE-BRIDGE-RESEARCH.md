# BX-REMOTE-PLAY — arquitetura independente e referências analisadas (v0.21)

## Objetivo e estado atual

**Objetivo do usuário:** somente o PS4 e o iPhone, sem Mac nem computador na residência, com o PKG de configuração fechado enquanto o jogo executa. Precisa de vídeo/áudio reais, controles, autenticação e reconexão.

**Fatos verificados:** o PKG v0.19 exibiu o menu no PS4 físico; o ELF v0.20 compilou, mas não foi confirmado em execução durante jogos no hardware. O teste WebRTC do BX recebeu imagem via Mac/Chiaki (não atende independência). A versão v0.21 implementa o primeiro pedido de diagnóstico **iniciado pelo navegador e executado pelo ELF sem o PKG aberto**, mas **não** transporta mídia ou comandos de jogo. O status de compilação e validação de hardware são independentes.

## Projetos estudados (fontes e diferenças)

| Projeto | O que comprova | O que não resolve para o BX |
|---|---|---|
| [Chiaki-NG](https://github.com/chiaki-ng/chiaki-ng) | Protocolo Remote Play, registro, sessão, controle, mídia criptografada, H.264/Opus e redes. Licença AGPL-3.0. | Não fornece automaticamente um cliente no Safari nem serviço PS4 residente. |
| [Chiaki-NG-Web](https://github.com/CSystem77/Chiaki-NG-Web) | Chiaki em WASM/Emscripten, WebCodecs, AudioWorklet, interface virtual e um proxy POSIX WebSocket para TCP/UDP. Licença AGPL-3.0. | O proxy roda em Node, não no PS4. Requer isolamento COOP/COEP, WebAssembly com threads, codecs e compatibilidade real do navegador. A documentação prioriza Chrome/Edge/Firefox, não confirma Safari iOS. |
| [GoldHEN](https://github.com/GoldHEN/GoldHEN) | Oferece Remote Play Enabler, binloader e suporte a plugins. | Não faz captura de jogos nem cria automaticamente um gateway TLS/WebRTC para o celular. |
| [PXPlay / MirrorPlay](https://streamingdv.github.io/mirrorplay/index) | Cliente Remote Play nativo disponível para iOS, com registro do console, vídeo, áudio e controles. | É aplicativo externo, não a interface BX e nem código aberto completo para copiar. |
| [PS Remote Play](https://apps.apple.com/br/app/ps-remote-play/id1436192460) | Cliente oficial gratuito com controles na tela; pode funcionar sem Mac. | Exige conta PlayStation e condições de compatibilidade; um PS4 com GoldHEN pode não conseguir atender esses requisitos. |

**Estratégia:** aproveitar o **Remote Play nativo** no PS4; não tentar recriar um capturador de GPU enquanto jogamos. O cliente Chiaki só deve ser integrado com observância de sua licença e portabilidade comprovada para o iPhone. Evitar afirmar suporte ao Safari sem verificar WebCodecs e WebAssembly no aparelho físico.

## O que esta versão implementa no BX (v0.21)

A primeira troca de comandos autenticada, independente do Mac:

1. O usuário instala o PKG v0.21, prepara o ELF atualizado usando **TRIÂNGULO**, fecha o aplicativo e inicia manualmente `/data/payloads/bx-remote-service.elf` pelo GoldHEN LaunchPad.
2. O usuário abre o PKG temporariamente apenas para aprovar um vínculo HTTPS novo. O navegador guarda o token de reivindicação **somente em memória** e apenas até o fim da autorização.
3. O botão **Testar comunicação PS4 ↔ celular** envia `POST /v1/bridge/probe` ao Durable Object com o token do vínculo aprovado. **Não há comandos arbitrários.**
4. O ELF consulta o heartbeat existente por HTTPS. O Worker devolve um `bridgeProbeId` aleatório de 256 bits. O ELF executa somente a sonda TCP local `127.0.0.1:9295`, fecha o socket e responde via `POST /v1/bridge/probe-result`, com autenticação do console.
5. O navegador consulta `GET /v1/bridge/probe` e recebe apenas `queued` ou `done` com `tcp9295:true|false|null`. Nenhum PIN, IP, conta, mídia ou token PSN entra no banco público. A tarefa expira em 90 segundos; apenas uma fica pendente. A revogação apaga a tarefa. Novos vínculos invalidam a tarefa anterior.

O serviço não abre portas nem aceita comandos de destinos externos; usa somente HTTPS de saída e um socket local para teste. **É canal de comando de diagnóstico**, não transporte TCP/UDP para o Remote Play.

## O que falta para transmitir os jogos

1. **Compatibilidade física:** validar se o ELF permanece executando com o PKG fechado e um jogo aberto, e se a porta de Remote Play permite conexões locais; um resultado `false` em loopback não prova que Remote Play está desativado.
2. **Transporte de mídia:** implementar multiplexação TCP/UDP com limites, filas, criptografia/autorização e controle de congestionamento. Evitar túneis genéricos e serviços locais expostos à internet. O Durable Object de vínculo não é servidor de streaming e não pode ser tratado como tal.
3. **Cliente compatível:** implementar a negociação de uma sessão Remote Play real no iPhone ou portar um cliente de licença adequada. Testar decodificação H.264 e áudio, além das limitações do Safari; não basta receber bytes RTP criptografados.
4. **Controles do jogo:** adaptar eventos dos botões para mensagens de Remote Play autenticadas e soltar todos os botões quando a sessão for encerrada ou perder a conexão.
5. **Teste ponta a ponta:** com o PKG fechado e sem Mac, ver imagem em movimento, ouvir áudio, controlar um jogo, desconectar, reconectar e verificar que o PS4 não trava.

Não anunciar vídeo/áudio real antes do item 5. Para **jogar agora sem Mac**, utilizar um cliente Remote Play para iPhone, como PS Remote Play ou PXPlay, se conseguir registrar seu console. Isso serve para verificar o PS4 enquanto o BX não está pronto.

## Cuidados

Não inserir PINs de Remote Play, login PSN, endereços privados ou tokens no GitHub, Cloudflare Pages ou em tickets públicos. Não instalar firmware apenas para testar este aplicativo, não abrir FTP/GoldHEN ao público e não habilitar AutoRun do payload novo antes de confirmar estabilidade em console físico.

Para compilar a versão nativa, o CI usa OpenOrbis. Um PKG compilado significa somente que as bibliotecas e o empacotamento foram aceitos; **não significa vídeo funcionando ou ELF testado no console**.
