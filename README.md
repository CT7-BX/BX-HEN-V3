# BX-REMOTE-PLAY

Projeto de **acesso remoto ao PS4**, desenvolvido por **CT7-BX**. Este repositório é dedicado ao **BX-REMOTE-PLAY**; não é o host de desbloqueio do console.

🌐 **[Abrir BX-REMOTE-PLAY](https://ct7-bx.github.io/BX-REMOTE-PLAY/)**

## Objetivo

Permitir futuramente jogar e controlar um PS4 em casa por meio de um iPhone ou MacBook em outra rede, com prioridade para o **DualShock 4 físico** e controles virtuais opcionais.

## Situação real

**Interface 0.4 — controles refinados e diagnóstico LAN.** A página em [remote/](remote/) possui controles de toque automáticos no celular, dois sticks multitoque, suporte a DualShock 4, layout imersivo/tela cheia, metas de qualidade e uma interface para o relay de laboratório. O vídeo do PS4 ainda não está conectado.

**O PKG PS4 de diagnóstico foi aprimorado na v0.20**, com notificação de resultado, ícone próprio e verificações extras de metadados e integridade. Continua sem validação em console físico e não transmite jogos.

**Não funciona ainda como Remote Play:** não transmite vídeo/áudio nem envia comandos ao PS4 real. Existe agora um relay **experimental** com autenticação para ligar o navegador a um **console simulado**; ainda falta um agente PS4 persistente, transporte de mídia e integração do protocolo Remote Play. Nenhuma sessão com console físico foi comprovada.

A raiz do site redireciona para `remote/`; mantemos esse caminho para evitar quebrar links anteriores. O código original da página experimental anterior permanece no histórico do GitHub, sem ser a página inicial.

## Organização

- [remote/index.html](remote/index.html) — interface responsiva preta e vermelha
- [remote/controller-core.js](remote/controller-core.js) — processamento local da Gamepad API
- [remote/tests/](remote/tests/) — testes automatizados
- [remote/README.md](remote/README.md) — requisitos, limitações e arquitetura futura
- [ps4-agent/](ps4-agent/) — prova HTTPS para PS4 e PKG experimental gerado em CI, ainda sem validação no console
- [relay/](relay/) — servidor Node autenticado de controle para console simulado (sem streaming)
- [remote/relay-lab.html](remote/relay-lab.html) — laboratório de controle separado
- [remote/game-core.js](remote/game-core.js) — estado de controles, seleção automático/toque/físico e metas de qualidade
- [remote/game.js](remote/game.js) — interação da tela, multitoque, tela cheia e enlace ao relay simulado
- [remote/touch-layout.css](remote/touch-layout.css) — controles translúcidos responsivos inspirados na organização do Remote Play
- [relay/tools/ps4-lan-probe.mjs](relay/tools/ps4-lan-probe.mjs) — teste de alcance TCP 9295 de um IP privado, sem pareamento
- [ps4-agent/AUTORUN-DESIGN.md](ps4-agent/AUTORUN-DESIGN.md) — plano de payload residente após GoldHEN, **não instalável ainda**
- [docs/LOW-LATENCY-AND-NETWORK.md](docs/LOW-LATENCY-AND-NETWORK.md) — estratégia LAN, CGNAT e atraso
- [Pesquisa de alternativas](docs/REMOTE-PLAY-RESEARCH-2026-11-15.md) — opções, limites e arquitetura recomendada
- [.github/workflows/remote-tests.yml](.github/workflows/remote-tests.yml) — CI para controles e navegação

**Importante:** o PKG atual continua sendo somente um diagnóstico HTTPS. O modelo de AutoRun não é um ELF residente e não foi aplicado ao console.

## Revisões técnicas

- **Verificação 1:** relay e botões virtuais agora liberam controles após desconexão, input parado ou perda de foco; limite de fila e testes de regressão para comandos perdidos.
- **Verificação 2:** GitHub Pages publica somente o front-end explicitamente permitido; DDP UDP 987 permite consultar o estado de **um PS4 informado na LAN**, sem escanear redes ou acordar o console. CLI e testes em `relay/`.
- Essas verificações são **automatizadas/simuladas**. A instalação e execução no PS4 físico ainda não foram confirmadas.

## Próximo passo: conexão real

Veja o [plano do PS4 e do PKG](docs/PS4-CONNECTION-AND-PKG.md) para os requisitos de pareamento LAN, agente residente após GoldHEN e transporte de vídeo/áudio por gateway. O PKG atual continua sendo apenas um diagnóstico HTTPS, não executa streaming.

## Validação

A pipeline [Build PS4 Probe](https://github.com/CT7-BX/BX-REMOTE-PLAY/actions/workflows/ps4-build.yml) compila `eboot.bin`, gera PKG de diagnóstico e valida os hashes do pacote. O artefato é publicado para **teste de hardware**, não como Remote Play funcional.


```sh
node --test remote/tests/*.test.cjs
```

A leitura do DualShock 4 depende do navegador; validar fisicamente no Safari do iPhone e no MacBook.

## Próximos marcos

1. Testar leitura real de botões e analógicos nos dispositivos.
2. Investigar captura de vídeo/áudio e entrada de controles no PS4 com GoldHEN.
3. Implementar um agente PS4 ou gateway Remote Play com sessão autenticada e transporte de mídia.
4. Criar sinalização/relay seguro, necessário para conexão entre redes em cenários como CGNAT.
5. Validar ponta a ponta controle e vídeo no iPhone e MacBook.

O **GitHub Pages** hospeda apenas o front-end; não substitui o servidor de relay e não permite conexão direta automática ao PS4.

## Host de desbloqueio — separado

O host de desbloqueio é um projeto distinto:
[CT7-BX/BX-CT7.github.io](https://github.com/CT7-BX/BX-CT7.github.io).

Este repositório não publica nem executa cargas de desbloqueio. O host separado não é alterado pelas mudanças deste projeto.

Histórico: [CHANGELOG.md](CHANGELOG.md).
