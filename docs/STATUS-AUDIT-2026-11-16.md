# Auditoria BX-REMOTE-PLAY — 16/11/2026

Base inspecionada: `06d41ceaccb7e17442fda70e26694253718dd2f2` (`main`).
Os nove itens solicitados são escopo pendente de comprovação. Nenhuma caixa
marcada no chat foi usada como evidência de funcionamento.

## Resultado por item

| Escopo | Implementação e evidência encontrada | Estado verificável / falta |
|---|---|---|
| CE-34878-0 | `native-pair/main.c` mantém o processo ocioso em vez de retornar de `main`, registra revogação e teardown; README nativo relata vínculo na v0.15 seguido do erro. | Causa raiz não confirmada. Sem novo teste físico, não há comprovação de correção. O comentário que atribui o crash ao caminho libc é hipótese, não diagnóstico definitivo. |
| Vídeo PS4 → celular | `remote/media-whep.js` negocia recepção WebRTC e mede quadros; `bridge-p2p.js` compartilha fonte escolhida no Mac. `remoteplay_probe.c` só abre TCP de loopback. | Não existe captura/transmissão de jogos no PKG ou Android. Mock de trilha/contador não prova origem PS4. Corrigida espera ilimitada pelo corpo SDP. |
| Áudio PS4 → celular | Receptor WHEP negocia áudio; P2P depende da fonte e da autorização do navegador. | Nenhuma prova física de áudio do PS4. É necessário verificar som audível, sincronização e recuperação após interrupção. |
| Controle do PS4 | Gamepad/toque, relay simulado, DataChannel com ACK e watchdog; ponte nativa de diagnóstico. | Não há injeção de comandos em jogos. ACK do peer e resposta HTTP não comprovam ação no PS4. Testes de liberação e sessão passam. |
| Sem PC/Mac | PKG e ELF fazem vínculo/heartbeat/diagnóstico HTTPS; Android mede prontidão. | Sessão de jogo autônoma ainda não implementada. Piloto P2P usa Mac; Android não é gateway de mídia. |
| LAN e internet | Sondas de porta/DDP, sinalização HTTPS e negociação WebRTC; P2P configura STUN. | Testes locais/simulados passam. Sem sessão PS4 física na LAN ou em outra rede; sem comprovação de travessia de CGNAT/TURN. |
| Estabilidade PKG/web/Android | Backoff limitado, diagnósticos e limpezas; builds remotos anteriores passaram. | Corrigidos dois caminhos de espera e ampliado gatilho de CI. SDKs PS4/Android e JVM não estão disponíveis localmente; nenhum novo PKG/APK foi compilado nesta auditoria. |
| GitHub Actions | Execuções recentes de main e builds v0.25/v0.5 aprovadas; logs de falha anterior inspecionados. | Falha 43993038701 era expectativa `command-center.js?v=0.29`, já corrigida na main. Novo teste OTA entra no workflow nativo; dependências compartilhadas passam a acioná-lo. A execução remota destas alterações deve ser conferida no PR. |
| Atualização | Parser de título/versão/URL, download com SHA-256 e publicação atômica, instalador AppInstUtil sob consentimento. | Manifesto público v0.25 coincide com digest do asset informado pelo GitHub. Isso não equivale a baixar/recalcular o binário ou instalar no PS4. Adicionado timeout de recebimento ao download; instalação física segue pendente. |

## Correções desta auditoria

1. **WHEP:** o timeout do POST terminava ao chegar o cabeçalho. Um servidor que
   respondia 201 e não terminava o corpo SDP deixava `start()` pendente. Agora a
   leitura tem limite próprio e reage a cancelamento, mesmo com leitor simulado
   que ignora AbortSignal. O erro fecha o peer e solicita DELETE da sessão uma
   vez. O limite é por etapa; não constitui um prazo global de toda a negociação.
   O recurso recebeu nova versão na URL do script para atualização do navegador.
2. **OTA nativo:** faltava `sceHttpSetRecvTimeOut` antes do envio. Agora aplica
   sete segundos e interrompe a operação caso a API recuse o limite; request e
   conexão são liberados. Timeout de recebimento não é prazo global do download.
3. **CI:** o PKG depende de `ps4-agent/resident`, do gerador de ícone e de testes
   compartilhados. Esses caminhos agora acionam o workflow nativo em push/PR.
   O novo teste executa o downloader de produção com HTTP e filesystem simulados.

Não houve alteração em BX-HEN, host de desbloqueio, firmware, credenciais,
serviço implantado, releases existentes ou manifesto público. Não foi removida
nenhuma função de mídia, controle, pareamento ou atualização.

## Testes e limites

- Antes das mudanças: 130 testes Node de web/Worker/configuração passaram e 30
  verificações Python nativas passaram. Isso não detectava os dois problemas.
- Regressão WHEP antes da correção: teste ficou pendente na leitura do corpo;
  execução interrompida. Depois: timeout e cancelamento passaram.
- Regressão OTA antes da correção: falhou em `received_timeout == 1`. Depois:
  passou nos cenários de timeout configurado e API de timeout recusada.
- Validação final: **152 testes Node** de web/Worker/relay; **4 testes Node** do
  gerador de configuração; **31 testes Python** (30 nativos + 1 ícone);
  **10 executáveis de teste C** (7 nativos + 3 ps4-agent). Todos passaram.
- C compilado no host com `-std=c11 -Wall -Wextra -Werror -pedantic`.
  O mock Http.h não valida assinatura/ABI OpenOrbis; o build real no CI é necessário.
- Os testes do relay precisaram de permissão para escutar somente em localhost.
  A primeira tentativa restrita falhou com EPERM e foi repetida com sucesso.
- JVM local ausente: teste Java e build APK não executados aqui. OpenOrbis
  ausente: build PKG não executado aqui. Não há validação nova em PS4/celular.

Reprodução a partir da raiz, com Node 24+, Python 3 e compilador C:

```sh
node --test remote/tests/*.test.cjs cloudflare/tests/*.test.mjs
node --test native-pair/tests/generate_setup.test.mjs
python3 -m unittest discover -s native-pair/tests -p 'test_*.py' -v
python3 -m unittest discover -s ps4-agent/tests -p 'test_*.py' -v
cc -std=c11 -Wall -Wextra -Werror -pedantic \
  -Inative-pair/tests/stubs -Dmkdir=bx_test_mkdir -Dremove=bx_test_remove \
  native-pair/ota_download.c native-pair/sha256.c native-pair/tests/ota_timeout_test.c \
  -o /tmp/bx-ota-timeout
/tmp/bx-ota-timeout
```

Para relay, instalar sua dependência fixa `ws@8.23.0` sem scripts e executar
`node --test relay/tests/*.test.mjs`. Os demais comandos C estão nos workflows
`native-pair-build.yml` e `ps4-agent-tests.yml`.

## Branches, releases e Actions

Foram inventariadas as 61 branches remotas e as 21 releases retornadas pela API.
Comparações de conteúdo das áreas nativa/Android entre main e
`feat/native-v025-android-v05-connection-stability` não mostraram diferenças;
o histórico usa commits de integração, portanto branch não ancestral por si só
não prova funcionalidade faltante. A branch antiga de crash e a de piloto P2P
têm conteúdo anterior a main; não foram mescladas indiscriminadamente.
A inspeção de conteúdo foi dirigida às branches relevantes, não uma revisão
linha a linha de todas as branches.

- [Main inspecionada](https://github.com/CT7-BX/BX-REMOTE-PLAY/tree/06d41ceaccb7e17442fda70e26694253718dd2f2)
- [Testes main aprovados](https://github.com/CT7-BX/BX-REMOTE-PLAY/actions/runs/43993198355)
- [Falha anterior analisada](https://github.com/CT7-BX/BX-REMOTE-PLAY/actions/runs/43993038701)
- [Build PKG anterior aprovado](https://github.com/CT7-BX/BX-REMOTE-PLAY/actions/runs/43992715459)
- [Build Android anterior aprovado](https://github.com/CT7-BX/BX-REMOTE-PLAY/actions/runs/43992715467)
- [Release PS4 v0.25, experimental](https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/tag/pair-test-v0.25)

Digest informado pelo GitHub para o PKG v0.25 e presente em `remote/update.txt`:
`775a446f344d4210872fcd73646f8d6cfe1a64c72eba9438fd149ef09d6f3cf1`.
O Android está distribuído como artefato debug do Actions, não release estável.

## Evidência física necessária

Para investigar o crash, registrar firmware, versão GoldHEN, versão/hash do PKG,
passos exatos e tempo até o erro. Reproduzir separadamente: sem configuração;
configuração válida e rede indisponível; rejeição do vínculo; aprovação;
OPTIONS e espera de dois minutos; fechamento pelo menu PS. Coletar o último
checkpoint de `/data/bx-remote-pairing-report.txt` e, se disponível, crash dump
com endereço de falha. Revisar o arquivo antes de compartilhar; nunca enviar
`.cfg`, token, PIN ou credenciais PSN. Um checkpoint indica onde investigar,
não comprova sozinho qual API causou a falha.

Somente depois de existir transporte real, validar PS4 → celular com PC/Mac
desligado, movimento exclusivo do jogo, áudio audível e ação de botões no jogo;
registrar versão, fonte, métricas e vídeo de evidência. Repetir em LAN e celular
em outra rede, incluindo perda/retorno de rede e soltura dos controles. Usar
os roteiros `REAL-AV-TEST-PLAN.md` e `PS4-ONLY-VIDEO-BRIDGE.md` como base.

**Os nove itens permanecem abertos até suas respectivas evidências.** A entrega
atual corrige falhas reproduzíveis e organiza a verificação; não implementa uma
sessão Remote Play autônoma completa nem comprova estabilidade no hardware.
