# BX-REMOTE-PLAY — protótipo 0.1

## O que foi desenvolvido

A interface em `remote/index.html` é uma **página estática de diagnóstico do controle**, com layout preto e vermelho, preparada para iPhone e MacBook:

- Detecta controles expostos pela **Gamepad API** no navegador.
- Prefere o controle físico com mapeamento `standard`, quando disponível.
- Exibe botões, direcional, gatilhos analógicos e os dois sticks.
- Inclui botões de toque para demonstrar a futura interface alternativa.
- Não envia telemetria e não registra endereços, senhas ou contas PSN.
- Não modifica o host de desbloqueio e não acessa o PS4.

**Ainda não transmite vídeo/áudio nem envia comandos ao console.** O botão de iniciar jogo está desativado de propósito. Não é um recurso de streaming simulado.

## Abrir localmente

```sh
python3 -m http.server 8080
# Acesse http://localhost:8080/remote/
```

No GitHub Pages, o caminho esperado após mesclar a branch e publicar é `/BX-REMOTE-PLAY/remote/`. A branch de desenvolvimento por si só não significa que a página esteja publicada.

## Testes

```sh
node --test remote/tests/controller-core.test.cjs
```

Checklist de validação física:

1. No MacBook, conectar o DualShock 4 por Bluetooth ou cabo, abrir a página no navegador, pressionar um botão e clicar em **Verificar controle**.
2. Conferir Cruz, Círculo, Quadrado, Triângulo, D-pad, L1/R1, L2/R2, Share, Options e eixos dos analógicos. Alguns mapeamentos variam por browser.
3. Desconectar e reconectar o controle: o estado deve refletir a mudança.
4. No iPhone, parear o controle em Ajustes > Bluetooth, abrir a página em Safari por **HTTPS** e pressionar um botão; verificar suporte real da Gamepad API e eventos.
5. Tocar simultaneamente em botões virtuais e confirmar que não há comandos enviados para uma sessão de PS4.
6. Conferir layout em retrato/paisagem, acessibilidade, toque e zoom.

Os testes automatizados verificam apenas o processamento de dados da Gamepad API; não substituem testes em um controle real.

## Arquitetura-alvo para jogar pela internet

```text
PS4 desbloqueado com agente homebrew
   └── conexão de saída autenticada (a validar no hardware)
         └── serviço de sinalização + relay/TURN (servidor próprio)
               └── navegador Safari no iPhone / navegador no MacBook
                     └── WebRTC vídeo/áudio + Gamepad API
```

A página estática pode apresentar e controlar a experiência, mas **GitHub Pages não executa um relay**. Um PS4 atrás de CGNAT não fica acessível pela internet apenas publicando um site. Um agente que faça conexão de saída e transporte mídia/controle é uma possível solução, mas exige:

1. **Prova no PS4 real:** identificar interfaces legítimas de captura de áudio/vídeo, codificação em tempo real e entrada de controle. Avaliar impacto no desempenho e compatibilidade com firmware/GoldHEN. Não assumir que o protocolo Remote Play nativo oferece uma API simples para navegador.
2. **Transporte de mídia:** desenhar sessão com DTLS-SRTP/WebRTC (ou gateway interoperável). Testar latência, bitrate, congestionamento, quedas e compatibilidade Safari.
3. **Pareamento seguro:** cada console vinculado ao usuário mediante aprovação local, tokens curtos e revogáveis, autenticação no backend, limites de tentativas, expiração de sessão e autenticação mútua entre console e serviço. Nunca expor FTP, painel GoldHEN, WebKit ou APIs de depuração pela internet.
4. **Infraestrutura:** backend separado, autenticação e relay para conexões sem acesso direto. Pode haver custo de banda considerável. Monitorar consumo e limitar sessões simultâneas.
5. **Experiência de jogo:** priorizar DualShock 4, oferecer controles virtuais opcionais, remapear botões não padronizados e medir latência de ponta a ponta. Testar PS4 em casa e iPhone em 4G/5G.

## Marcos de aceite

- **0.1 (esta proposta):** interface + leitura local do controle e testes de unidade. Sem sessão PS4.
- **0.2:** estudo e prova de captura de vídeo/áudio e recepção de comandos em PS4 de teste, sem internet pública.
- **0.3:** primeira sessão remota autenticada com vídeo/áudio e controle físico, em rede local.
- **0.4:** sessão fora da rede doméstica com relay, incluindo cenário CGNAT.
- **1.0:** reconexão, métricas de latência, integração visual, acessibilidade e testes em iPhone e Mac.

A arquitetura e a compatibilidade com GoldHEN dependem de testes físicos. Nenhuma dessas etapas futuras foi concluída.

## Organização

```text
remote/
  index.html
  controller-core.js
  tests/
    controller-core.test.cjs
  README.md
```

O caminho `remote/` é independente dos arquivos de desbloqueio e não altera o fluxo atual de publicação.

## Aplicativo experimental PS4

O código-fonte do teste HTTPS de saída fica em [ps4-agent/](../ps4-agent/). O endpoint público de diagnóstico desta página é `ps4-probe.txt`; nenhuma informação do console é transmitida. Um teste positivo valida apenas a consulta HTTPS, **não** streaming, controles ou pareamento.

## Laboratório de relay 0.2

A página [relay-lab.html](relay-lab.html) pode testar um **controle físico** contra o servidor de laboratório em [relay/](../relay/), com console **simulado**. Ela só envia comandos após autenticação e não recebe imagem ou áudio. O relay exige um servidor Node executado separadamente; GitHub Pages só hospeda a página estática. Veja o [estudo técnico](../docs/REMOTE-PLAY-RESEARCH-2026-11-15.md).
