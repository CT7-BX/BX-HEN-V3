# BX-REMOTE-PLAY — relay de laboratório v0.2

**Estado:** demonstrador verificável do caminho navegador → servidor → console **simulado** → resposta. Não é Remote Play e não existe vídeo, áudio ou conexão nativa com o PS4.

## O que já funciona no protótipo

- Um servidor Node.js com duas conexões WebSocket, papéis `console` e `player`, cada um com token próprio.
- Pacotes de botões, quatro eixos dos analógicos e pressão dos gatilhos L2/R2 (0 a 1) limitados e validados, enviados do navegador ao console simulado.
- Resposta `ack` do simulador ao navegador para identificar perda de conexão.
- Autenticação por credencial fornecida **somente por variável de ambiente**, comparação em tempo constante, uma conexão por papel, rejeição de mensagens inválidas e proteção básica contra replay/volume.
- Restrição de `Origin`, recusa de URL com query string, limite de 4096 bytes por mensagem, compressão WebSocket desativada.
- Proteção contra botão preso: comando explícito `reset` para o console simulado em caso de desconexão do jogador, 450 ms sem atualizações ou nova sessão de console.
- Limite de fila de envio: conexões com mais de 64 KiB pendentes são encerradas em vez de acumular comandos de segundos atrás.
- Cliente do navegador reduz comandos idênticos para cerca de quatro atualizações por segundo e mantém envio rápido ao detectar mudanças.
- Nenhum token, IP particular ou credencial é versionado.

**Segurança:** este é um laboratório; não publique o servidor em internet aberta. Configuração segura de produção requer HTTPS/WSS com proxy confiável, controle adicional de acesso e limites de taxa na borda, revogação de tokens, mecanismos de pareamento no console e revisão de segurança. Não encaminha vídeo nem portas de rede.

## Testar em computador (apenas localhost)

Requer Node.js 24+.

```sh
cd relay
npm install
npm test

# Exemplo didático: os tokens precisam ser privados e diferentes
export BX_RELAY_CONSOLE_TOKEN="$(openssl rand -hex 32)"
export BX_RELAY_PLAYER_TOKEN="$(openssl rand -hex 32)"
export BX_RELAY_ALLOWED_ORIGINS="http://localhost:8080"
npm start
```

Em outro terminal, dentro de `relay`, com a variável `BX_RELAY_CONSOLE_TOKEN` do mesmo processo/ambiente:

```sh
npm run demo:console
```

Abra `http://localhost:8080/remote/relay-lab.html` com um servidor estático na raiz do projeto (ex.: `python3 -m http.server 8080`). Preencha:

- Endpoint: `ws://127.0.0.1:8765/v1/link`
- Token de jogador: o conteúdo de `BX_RELAY_PLAYER_TOKEN` do seu ambiente de teste.

O simulador confirma sequências de controle; **não controla o console de verdade**. Na versão publicada no GitHub Pages, o navegador só aceita `wss://` para servidores externos. A lista de origens permitidas precisa conter `https://ct7-bx.github.io` quando o relay estiver corretamente hospedado sob TLS.

Não coloque credenciais reais na URL, no repositório ou em capturas de tela. O formulário limpa o token após abrir a conexão; não utiliza `localStorage`.

## Integração planejada com o PS4

O navegador já consegue gerar mensagens de entrada. O passo seguinte é fazer um **agente de saída executado no PS4**, persistente durante os jogos, estabelecer conexão autenticada com um backend de confiança. Para ver a tela, será necessário conectar o protocolo **Remote Play nativo** (preferível) ou comprovar outro método de captura/codificação no console.

O relay atual suporta **somente mensagens de controle de pesquisa**. Ele não transporta TCP/UDP do Remote Play, não conhece pareamento, não instala GoldHEN e não deve ser conectado a portas do PS4 na internet.

### Por que não mandar vídeo pela conexão atual?

Remote Play possui transporte e formatos próprios; uma conexão WebSocket de mensagens JSON de 4 KiB não substitui canal de mídia com baixa latência nem proteção criptográfica apropriada. O caminho seguinte deverá ser um gateway de transporte para Remote Play ou WebRTC, com tráfego de vídeo/áudio distinto do controle.

### Referências técnicas

- [Chiaki-NG-Web](https://github.com/CSystem77/Chiaki-NG-Web), AGPL-3.0 — cliente Remote Play WebAssembly, proxy Node
- [Control4Free](https://github.com/MoHadiShibli/Control4Free), GPLv3 — serviço de controle virtual que persiste durante jogos
- [GoldHEN](https://github.com/GoldHEN/GoldHEN) — Remote Play Enabler
- [Gamepad API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API)

**Não copiamos código de terceiros para este relay.** Antes de integrar componentes externos, é necessário preservar os avisos, licenças e disponibilização de código quando exigido.

## Diagnóstico seguro da conexão local do PS4

Ao estar temporariamente na mesma rede do seu PS4, anote o IP do console em Configurações > Rede > Ver status da conexão. No MacBook ou computador com Node.js, execute:

```sh
cd relay
npm run probe:ps4 -- 192.168.1.20
```

Substitua o IP de exemplo pelo endereço privado real. O comando tenta **uma única conexão TCP** na porta 9295, sem varredura, credenciais nem escuta pública. Ele aceita somente IPv4 privado. `ACESSÍVEL` significa apenas que houve conexão TCP, **não que o PS4 foi identificado, pareado ou está transmitindo vídeo**. Em outra rede ou CGNAT, esse comando não faz a ligação remota. Não exponha as portas do GoldHEN ou do serviço de payload para executar esse teste.

### Semântica de segurança do controle

O evento JSON `{"type":"reset","reason":"stale_input"}` ou `player_disconnected` significa **soltar todos os botões, zerar eixos e gatilhos imediatamente** no simulador. O futuro agente nativo do PS4 precisará implementar a mesma proteção e também um timeout local independente, caso toda a conexão caia antes de receber o evento. **Nada disso comprova controle de um PS4 físico**.

## Descoberta local do PS4 (UDP 987)

Além do teste de porta TCP, há uma consulta **DDP de uma única máquina** que detecta respostas de um PS4 na mesma LAN. Não há varredura de endereços, comando de acordar console, abertura de portas nem conta PSN envolvida.

```bash
cd relay
npm run discover:ps4 -- 192.168.1.20
npm run probe:ps4 -- 192.168.1.20
```

Substitua pelo endereço privado correto do seu PS4. A descoberta pode indicar ligado/repouso, tipo e nome informado pelo console; por privacidade não apresenta o identificador de hardware `host-id`. **Ausência de resposta não significa necessariamente que não seja um PS4** (firewall, versões DDP ou configuração de descoberta podem interferir). Resposta DDP ou TCP 9295 **não equivale a pareamento nem transmissão de vídeo**. Os testes de integração desta ferramenta utilizam um dispositivo UDP simulado.
