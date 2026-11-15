# BX-REMOTE-PLAY

Projeto de **acesso remoto ao PS4**, desenvolvido por **CT7-BX**. Este repositório é dedicado ao **BX-REMOTE-PLAY**; não é o host de desbloqueio do console.

🌐 **[Abrir BX-REMOTE-PLAY](https://ct7-bx.github.io/BX-REMOTE-PLAY/)**

## Objetivo

Permitir futuramente jogar e controlar um PS4 em casa por meio de um iPhone ou MacBook em outra rede, com prioridade para o **DualShock 4 físico** e controles virtuais opcionais.

## Situação real

**Protótipo 0.1 — diagnóstico de controle.** A interface em [remote/](remote/) identifica e exibe entradas da Gamepad API do navegador e demonstra botões virtuais.

**O componente PS4 já compilou em OpenOrbis no GitHub Actions e gerou um PKG experimental de diagnóstico, com validação de hashes; não foi testado em console.**

**Não funciona ainda como Remote Play:** não transmite vídeo/áudio, não envia comandos ao PS4, não tem agente de transmissão funcional, pareamento, autenticação ou servidor relay. Nenhuma conexão remota com o console foi comprovada.

A raiz do site redireciona para `remote/`; mantemos esse caminho para evitar quebrar links anteriores. O código original da página experimental anterior permanece no histórico do GitHub, sem ser a página inicial.

## Organização

- [remote/index.html](remote/index.html) — interface responsiva preta e vermelha
- [remote/controller-core.js](remote/controller-core.js) — processamento local da Gamepad API
- [remote/tests/](remote/tests/) — testes automatizados
- [remote/README.md](remote/README.md) — requisitos, limitações e arquitetura futura
- [ps4-agent/](ps4-agent/) — prova HTTPS para PS4 e PKG experimental gerado em CI, ainda sem validação no console
- [.github/workflows/remote-tests.yml](.github/workflows/remote-tests.yml) — CI para controles e navegação

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
