# BX-REMOTE-PLAY — latência, rede local e internet

**Situação atual:** nenhuma transmissão do PS4 ou teste de rede externa realizado. O relay atual é somente um demonstrador de controle para **console simulado**.

## Rede local (mesma internet)

O melhor cenário de latência é um caminho direto entre o cliente e o console. Porém, o Safari e navegadores não abrem sozinhos os sockets TCP/UDP proprietários do Remote Play: precisaremos de um gateway ou cliente WebAssembly que encapsule esse transporte.

Com **apenas o PS4 ligado em casa**, não existe computador para hospedar um gateway local. Teremos que comprovar um serviço residente PS4 capaz de expor uma conexão segura local ou transportar o protocolo para um gateway externo. A existência do GitHub Pages não resolve isso.

## Outra rede, 5G e CGNAT

A arquitetura proposta é: payload PS4 autenticado inicia conexão de saída → servidor remoto com suporte de mídia → navegador autenticado no iPhone/MacBook. O gateway precisará encaminhar o Remote Play nativo ou converter a mídia para WebRTC. A escolha entre direto e relay deve resultar de medições e conectividade real. Em CGNAT, uma simples página estática não cria rota de entrada para o PS4.

## Opções para reduzir atraso

| Camada | Opção | Observação |
|---|---|---|
| Vídeo | Reaproveitar codificação do Remote Play nativo | Evita inventar captura/encoder e pode preservar desempenho do jogo |
| Navegador | WebAssembly, WebCodecs ou WebRTC | Depende de suporte real no Safari, decodificação e headers corretos |
| Transporte | UDP/WebRTC quando viável | Evita enfileirar quadros de vídeo antigos e permite controle de jitter |
| Comandos | Estados contínuos em canal não ordenado e sem retransmissão; canal confiável para pareamento | Evita head-of-line blocking; pulsos de botões precisam de confirmação |
| Relay | Servidor geograficamente próximo das duas pontas | Aumenta disponibilidade, mas cobra banda e adiciona saltos |
| Perfil | Começar com uma meta 720p60 equilibrada e reduzir qualidade se houver perda | Os perfis do site **não** comandam um encoder neste estágio |
| Tela | Vídeo como elemento HTML e controles CSS sobrepostos | Evita cópias de quadros via canvas e permite multitouch |

**Metas de interface, não medições reais:** Economia 540p30 até 3 Mb/s; Equilibrado 720p60 até 8 Mb/s; Qualidade 1080p60 até 15 Mb/s, conforme capacidade real de console, decoder e rede. Nem todo PS4 é compatível com 1080p no Remote Play.

## Tela cheia e controles

- No MacBook, usar Fullscreen API no contêiner inteiro, incluindo vídeo e botões.
- No iPhone Safari, o fullscreen de elementos com overlays tem restrições; usamos modo imersivo CSS e recomendamos Adicionar à Tela de Início para reduzir a interface do Safari quando suportado.
- O elemento de vídeo usa playsinline para não perder os controles virtuais.
- No modo automático, um controle físico detectado tem prioridade; em celular touchscreen sem controle aparecem os botões sobrepostos.
- Cada stick usa Pointer Events, deadzone e liberação no fim do toque; a perda de foco envia estado neutro ao relay quando possível.

**Latência exibida como RTT relay** mede apenas a comunicação navegador ↔ servidor. Não representa a latência real controle → PS4 → vídeo.

## Pré-requisitos ainda faltantes

1. Um ELF residente seguro que funcione com jogos e GoldHEN e suporte conexão de saída autenticada.
2. Gateway de mídia que entenda Remote Play ou conversão para WebRTC.
3. Pareamento real no PS4 e vínculo ao dono, com credenciais revogáveis.
4. Teste direto na LAN e teste externo, inclusive CGNAT, com medidas reais e correção automática de bitrate.
5. Backend implantado em infraestrutura apropriada; GitHub Pages hospeda somente o front-end.

## Referências

- [Chiaki-NG-Web](https://github.com/CSystem77/Chiaki-NG-Web): cliente web por WASM e proxy Node; não possui hole punching PSN na versão web.
- [Control4Free](https://github.com/MoHadiShibli/Control4Free): payload residente e WebRTC DataChannel para controle local.
- [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API) e [limitação WebKit iPhone](https://bugs.webkit.org/show_bug.cgi?id=328773).
- [Video frame callbacks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).
