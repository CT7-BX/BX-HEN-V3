# BX-REMOTE-PLAY — alternativas técnicas (15/11/2026)

## Requisitos fixos do projeto

- Somente PS4 com GoldHEN ligado em casa. **Nenhum computador ou gateway local adicional**.
- Acesso pelo **Safari no iPhone** e pelo navegador do **MacBook**, inclusive em outra rede.
- Preferência máxima pelo **controle físico DualShock 4**, com touchscreen opcional.
- Vídeo, áudio e comandos funcionais. Não atualizar o firmware como pré-requisito.
- Só modificar o repositório `CT7-BX/BX-REMOTE-PLAY`.

## Resultados de pesquisa (fontes primárias)

| Caminho | Componentes | Viabilidade | Limitação |
|---|---|---|---|
| **A. Remote Play nativo com gateway web** | GoldHEN Remote Play Enabler + Chiaki-NG-Web + servidor Node HTTPS | Mais rápido para vídeo/áudio. Chiaki já implementa o protocolo e WebAssembly. | Chiaki-NG-Web usa proxy TCP/UDP e requer IP acessível/encaminhamento; não resolve CGNAT por si só. |
| **B. Serviço PS4 residente + túnel de saída + gateway Chiaki** | Payload GoldHEN residente + túnel autenticado para servidor + proxy Chiaki-NG-Web | **Arquitetura preferida para o objetivo sem computador em casa**, *sujeita à prova física*. O serviço PS4 estabelece conexão de saída e pode transportar tráfego Remote Play, evitando depender de portas de entrada no roteador. | Complexo: transportar TCP/UDP sem perder desempenho, inicialização automática, compatibilidade GoldHEN/firmware, autenticação, latência e controle da sessão. **Não existe implementação validada aqui.** |
| **C. Captura nativa própria + WebRTC** | Agente PS4 capturando/comprimindo frames e áudio + WebRTC | Controla integralmente o formato. | Maior risco: acesso às interfaces de captura, codificação com baixa latência e execução junto aos jogos ainda não demonstrados. |
| **D. Controle virtual sem vídeo** | Control4Free | Prova forte de virtualização de DualShock no PS4, inclusive menus e jogos. | Não fornece vídeo/áudio. Serviço descrito como LAN-only e **sem autenticação**: não publicar a porta 4264 na internet. |

### Evidências

1. [GoldHEN/GoldHEN](https://github.com/GoldHEN/GoldHEN) lista *Remote Play Enabler*, suporte a homebrew e plugins. Isso não significa acesso automático pela internet.
2. [Chiaki-NG-Web](https://github.com/CSystem77/Chiaki-NG-Web) descreve WebAssembly, vídeo, áudio, proxy Node.js e necessidade de conectividade TCP/UDP ao console. A versão Web não fornece hole punching via PSN.
3. [Control4Free/how-it-works](https://github.com/MoHadiShibli/Control4Free/blob/main/docs/how-it-works.md) utiliza payload residente em vez de plugin apenas de jogos, e o recurso `scePadVirtualDevice*` do PS4. A página de instalação esclarece que o serviço permanece em segundo plano e exige GoldHEN recente.
4. [Control4Free/installation](https://github.com/MoHadiShibli/Control4Free/blob/main/docs/installation.md) confirma suporte testado em firmware 13.52 e serviço em portas 4264 TCP/UDP para rede local. **Não há evidência de teste no nosso PS4 específico.**
5. [Chiaki-ng configuration](https://chiaki-ng.github.io/chiaki-ng/setup/configuration/) documenta registro local com código de pareamento. Na nossa situação, não presumir conta PSN ou atualização de firmware.
6. [PlayStation suporte oficial](https://www.playstation.com/pt-br/support/games/ps4-vita-remote-play-second-screen/) documenta portas usadas pelo Remote Play (TCP 9295, UDP 9296/9297), mas não valida método próprio de túnel.
7. [MDN Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API) documenta leitura de controles no navegador. Safari/iPhone precisa de teste real com DualShock 4.

## Decisão de arquitetura

**B para conexão fora de casa atrás de CGNAT; A para vídeo/áudio.** Precisamos estudar a interoperabilidade entre um agente PS4 de saída e o proxy do Chiaki-NG-Web. Não copiar o protocolo sem revisão técnica e licença. O frontend do GitHub Pages é estático, enquanto os processos de sessão devem rodar **em servidor externo** (não na sua casa).

Diagrama-alvo:

```text
iPhone/Mac + DualShock 4
  └─ HTTPS/WSS → BX-REMOTE-PLAY (web / proxy)
                     │ sessão autenticada + mídia
                     └─ relay remoto com transporte TCP/UDP
                           ⇅ conexão PS4 → relay, iniciada de casa
                        PS4 GoldHEN: serviço residente
                           ↳ Remote Play nativo (vídeo+áudio+entrada)
```

**Bloqueio principal:** comprovar que o PS4 pode iniciar e manter um túnel seguro em segundo plano, com permissão do dono, e que o gateway consegue alcançar o serviço Remote Play nativo por esse túnel. Mesmo que isso seja confirmado, precisamos testar custo de dados, latência, perda de pacotes e segurança.

## Marcos implementados / não implementados

- [x] Frontend com leitura local do Gamepad e teste virtual.
- [x] Código PS4 para consulta HTTPS de diagnóstico, PKG **experimental** compilado, sem validação física.
- [x] **Relay laboratório 0.2:** autenticado para sinalização e frames de controle, com console **simulado**. Sem captura de vídeo ou transporte Remote Play.
- [ ] Execução do PKG de diagnóstico no PS4 físico.
- [ ] Pareamento real do Chiaki com o PS4 via rede local.
- [ ] Serviço residente PS4 seguro e conexão de saída autenticada.
- [ ] Transporte remoto do Remote Play por gateway TCP/UDP com testes.
- [ ] Vídeo/áudio + input físico funcionando no Safari do iPhone e no MacBook.
- [ ] Testes reais entre redes diferentes e sob CGNAT, sem exposição de FTP/GoldHEN.

## Segurança e licenças

- Rejeitar tráfego não autenticado, não guardar tokens no front-end, utilizar TLS e consentimento de pareamento no PS4. Sem acesso remoto a FTP ou payload loader.
- Control4Free é **GPLv3**; Chiaki-NG-Web é **AGPL-3.0**. A avaliação técnica não concede permissão para ignorar exigências de redistribuição ou de disponibilização de fonte.
- Nunca anunciar a demo simulada como jogo remoto; nenhuma métrica sintética pode ser rotulada como latência real do PS4.
