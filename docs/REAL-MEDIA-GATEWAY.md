# BX-REMOTE-PLAY — primeira integração real de mídia WebRTC/WHEP

## Estado verificável

O frontend agora possui um **receptor de mídia real** usando a API `RTCPeerConnection` e o protocolo [WHEP (WebRTC-HTTP Egress)](https://www.ietf.org/archive/id/draft-ietf-wish-whep-01.html). Ele negocia SDP por HTTPS, solicita áudio e vídeo em modo `recvonly`, aceita trilhas reais em `MediaStream` e as envia para o player de vídeo existente. Não gera frames ou áudio falsos. O token é mantido somente durante a sessão, não vai para o Worker de pareamento, não aparece na URL e não é salvo no navegador.

**Isso ainda não liga automaticamente a câmera/tela do PS4 ao BX.** Para ver os jogos é necessário um servidor de mídia WHEP que efetivamente receba o sinal do Remote Play. O PKG Pair Test v0.17 é somente um cliente de vínculo HTTPS; não captura telas ou som, não roda um servidor WHEP e não encaminha comandos dos jogos.

## Dois caminhos distintos

**Caminho A — usar hoje um cliente Remote Play Web já desenvolvido:** [Chiaki-NG-Web](https://github.com/CSystem77/Chiaki-NG-Web) utiliza Chiaki/chiaki-lib em WebAssembly e um proxy Node.js que encaminha as conexões TCP/UDP de Remote Play. É um aplicativo **independente do BX**, com própria interface, login e controles. Pode ser aberto pelo link na seção Vídeo e áudio do site. Ele *não* expõe um endpoint WHEP pronto. O BX não acessa suas sessões nem seus dados.

Para usar o Chiaki-NG-Web diretamente, é necessário registrar seu próprio PS4 e permitir que o proxy Chiaki tenha acesso à rede do console. A versão web não resolve automaticamente CGNAT, não faz PSN hole punching e não funciona apenas copiando arquivos para o GitHub Pages. O site público de terceiros é uma opção externa; se preferir privacidade, siga a documentação do projeto e hospede sua própria instância. Nunca envie credenciais, identificadores de conta, códigos de registro ou configuração privada do console ao BX.

**Caminho B — usar a tela BX com mídia real:** configure um gateway **que ofereça WHEP** e tenha uma fonte de vídeo/áudio do PS4. No painel lateral, informe o endpoint HTTPS WHEP (não a URL de um site Chiaki, nem o Worker de pareamento), digite um token de mídia separado se necessário e selecione **Conectar vídeo**. O navegador envia um offer SDP, recebe answer SDP, negocia WebRTC e reproduz as trilhas que chegarem. O botão **Ativar áudio** permite repetir a reprodução com gesto explícito no Safari. O botão **Desconectar** fecha a sessão e solicita DELETE do recurso WHEP.

Não há, neste repositório, um **gateway Chiaki → WHEP implantado**, nem uma fonte de PS4 ligada ao receptor. Portanto, apontar o BX para o Worker atual exibirá erro de WHEP, corretamente. Para usar um servidor WHEP comum, é indispensável configurar uma aplicação adicional que faça a sessão de Remote Play e publique as trilhas nesse gateway. O frontend não transforma por si só o proxy Chiaki em WHEP.

## Requisitos do servidor WHEP

- HTTPS válido (HTTP sem TLS somente em `localhost`), URL de sessão WHEP sem senha/código na query.
- `POST` com `Content-Type: application/sdp`, resposta `201 Created`, `Content-Type: application/sdp`, header `Location` para um recurso **na mesma origem HTTPS** e body contendo answer SDP.
- ICE negociável sem trickle: o navegador envia offer **depois de completar o gathering**. Por ora, servidores que exigem ICE PATCH, link dinâmico de TURN ou renegociação não são compatíveis.
- `DELETE` para encerrar sessão e liberar recursos; token Bearer opcional no cabeçalho de requests de sessão.
- CORS: permitir a origem `https://ct7-bx.github.io`, métodos `OPTIONS, POST, DELETE`, cabeçalhos `Authorization, Content-Type, Accept`, e expor `Location, Content-Type` ao navegador. Somente domínios configurados pelo operador devem ser aceitos.
- O servidor precisa ver o PS4 na rede dele, diretamente ou por um **túnel privado autenticado** apropriado para TCP/UDP. Não exponha GoldHEN, FTP, payload loader ou controle do PS4 em portas públicas.

## Limites atuais do receptor

O receptor verifica origem HTTPS, bloqueia redirecionamentos HTTP, aceita `Location` apenas da mesma origem e limpa estado ao desconectar. É implementada negociação inicial, não recuperação de rede, TURN automático ou WebRTC escalável. O indicador de mídia confirma apenas **trilha e reprodução vinda do gateway**; não é prova de que a origem seja um PS4. Os comandos DualShock da interface BX continuam separados do Remote Play real: o WHEP é **recepção somente**.

Para a arquitetura definitiva **sem computador em casa**, ainda falta desenvolver e validar no PS4 um agente residente seguro com saída TCP/UDP autenticada, fazer o gateway remoto alcançar a sessão de Remote Play e integrar os comandos de jogo à mesma sessão. Sem esse caminho de mídia, não é tecnicamente possível entregar vídeo real simplesmente apertando Conectar no site.

## Testes automatizados

```sh
node --check remote/media-whep.js
node --check remote/media-controls.js
node --test remote/tests/media-whep.test.cjs
```

Os testes substituem o peer e o HTTP por implementações simuladas para testar a sinalização, validação de HTTPS, autenticação restrita, eventos de trilha, limpeza por DELETE e rejeição de destinos cruzados. **Eles não substituem uma sessão física de PS4**. Depois de implantar um backend WHEP real, é indispensável testar Safari no iPhone, Chrome/Firefox, compatibilidade WebRTC e latência real de vídeo/áudio. Não copie código de Chiaki para o BX sem observar a licença AGPL-3.0.
