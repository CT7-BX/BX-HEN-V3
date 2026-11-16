# BX-REMOTE-PLAY

Projeto de **acesso remoto ao PS4**, desenvolvido por **CT7-BX**. Este repositório é dedicado ao **BX-REMOTE-PLAY**; não é o host de desbloqueio do console.

🌐 **[Abrir BX-REMOTE-PLAY](https://ct7-bx.github.io/BX-REMOTE-PLAY/)**

## Objetivo

Permitir futuramente jogar e controlar um PS4 em casa por meio de um iPhone ou MacBook em outra rede, com prioridade para o **DualShock 4 físico** e controles virtuais opcionais.

## Situação real

**Interface 0.8 — controles, diagnóstico LAN, vínculo guiado e checklist de testes.** A página em [remote/](remote/) possui controles de toque automáticos no celular, dois sticks multitoque, suporte a DualShock 4, layout imersivo/tela cheia, metas de qualidade e uma interface para o relay de laboratório. O vídeo do PS4 ainda não está conectado.

**O PKG PS4 de diagnóstico foi aprimorado na v0.21**, com notificação de resultado, ícone próprio, tratamento de erros de rede temporários e testes adicionais de metadados e integridade. Continua sem validação em console físico e não transmite jogos.

**Prova nativa de vínculo PS4 v0.12:** há agora código OpenOrbis para um PKG **separado** em [native-pair/](native-pair/) que realiza vínculo por HTTPS, mostra código no console e pede autorização pelo DualShock 4. As versões anteriores compilaram no OpenOrbis; a v0.12 aumenta o tempo para confirmação e registra erros HTTP/nativos mais específicos. A execução física ainda não foi comprovada. O app não transmite vídeo ou comandos e não tem AutoRun.

**Vínculo em desenvolvimento:** a interface e o relay têm agora solicitação de código de oito dígitos, aprovação por console **simulado** e credencial temporária. Esse fluxo NÃO vincula o PS4 físico, nem substitui o registro do protocolo Remote Play. [Documentação do teste de vínculo](docs/PAIRING-AND-REAL-PS4.md).

**Não funciona ainda como Remote Play:** não transmite vídeo/áudio nem envia comandos ao PS4 real. Existe agora um relay **experimental** com autenticação para ligar o navegador a um **console simulado**; ainda falta um agente PS4 persistente, transporte de mídia e integração do protocolo Remote Play. Nenhuma sessão com console físico foi comprovada.

A raiz do site redireciona para `remote/`; mantemos esse caminho para evitar quebrar links anteriores. O código original da página experimental anterior permanece no histórico do GitHub, sem ser a página inicial.

## Organização

- [remote/index.html](remote/index.html) — interface responsiva preta e vermelha
- [remote/controller-core.js](remote/controller-core.js) — processamento local da Gamepad API
- [remote/tests/](remote/tests/) — testes automatizados
- [remote/README.md](remote/README.md) — requisitos, limitações e arquitetura futura
- [ps4-agent/](ps4-agent/) — PKG v0.21 de diagnóstico HTTPS (inalterado)
- [native-pair/](native-pair/) — novo aplicativo PS4 v0.12 de prova de vínculo HTTPS, separado e sem AutoRun, compatibilidade física ainda pendente
- [relay/](relay/) — servidor Node autenticado de controle e pareamento com console simulado (sem streaming)
- [docs/PAIRING-AND-REAL-PS4.md](docs/PAIRING-AND-REAL-PS4.md) — código temporário, aprovação e próximos passos com o PS4 físico
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

### Preparação de credenciais para teste físico

Há um gerador local que cria um par de configurações privadas para PS4 e backend, sem embutir segredos no aplicativo: [Guia da prova de vínculo](native-pair/README.md). Nenhuma chave é registrada no repositório e nenhum serviço remoto é implantado automaticamente.

### Primeiros testes físicos

Use o [roteiro de testes no PS4 e no iPhone/Mac](docs/FIRST-HARDWARE-TESTS.md) para testar primeiro o PKG de diagnóstico HTTPS e depois o PKG de pareamento experimental. A interface tem checklist e relatório local sem credenciais; nenhum vídeo do console foi transmitido ou validado ainda.

## Servidor BX-REMOTE-LINK experimental (Cloudflare)

Um Worker **separado** chamado `bx-remote-link` foi implantado no Cloudflare, com armazenamento durável para código de pareamento HTTP. O site agora sugere seu endereço automaticamente; o Worker não oferece controle remoto nem mídia. **Ainda não há credencial privada de console instalada no Worker**, portanto o pareamento permanece bloqueado até que o titular da conta configure o Secret `BX_RELAY_CONSOLE_TOKEN` e use o mesmo segredo no PKG PS4. Veja [cloudflare/README.md](cloudflare/README.md) para o passo manual; a URL pública ainda necessita de teste direto. O BX-HEN não foi alterado.

### Usar o servidor HTTPS para pareamento (ajuste de interface)

O formulário **Vincular PS4 — conexão experimental** agora já sugere a URL HTTPS do BX-REMOTE-LINK, em vez de um WSS inexistente. Além de mensagens claras sobre segredo não configurado, o Worker retorna HTTP 503 quando um código é solicitado sem o segredo do PS4 e bloqueia requisições HTTP em texto claro. O relay WSS simulado continua compatível. O serviço continua sem vídeo, áudio ou controle real: [procedimento do Cloudflare](cloudflare/README.md).

### Melhorias no primeiro pareamento (interface 0.8)

O painel de vínculo agora oferece um guia de três passos, consulta o servidor automaticamente uma vez quando aberto, aceita colar um PIN de oito dígitos com espaços ou hífens e mostra o tempo restante para a aprovação. A tela diferencia claramente servidor ainda sem segredo, código inválido e confirmação apenas HTTP. O backend limita também tentativas erradas distribuídas entre vários endereços. **Ainda não há serviço residente nem vídeo/áudio ou controle remoto real do PS4.**
