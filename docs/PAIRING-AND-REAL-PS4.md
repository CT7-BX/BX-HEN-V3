# BX-REMOTE-PLAY — Vínculo seguro (laboratório v0.3)

## Estado real

Implementado e testável: navegador → relay Node → **console simulado**. Este módulo ainda não conecta ao PS4 físico e não transmite vídeo ou áudio. O PKG v0.21 segue apenas como diagnóstico HTTPS.

## Como funciona

1. Um console autenticado solicita um código aleatório de 8 dígitos válido por 120 segundos.
2. O jogador digita o código no site; a solicitação não concede acesso sem aprovação.
3. O console recebe o pedido e precisa aprovar explicitamente.
4. O navegador recebe credencial de sessão temporária de 15 minutos, só depois da aprovação.
5. A credencial autentica o WebSocket existente para transmitir apenas comandos ao **simulador**.
6. Negação, expiração, desconexão ou revogação invalidam o vínculo.

Os tokens ficam só na memória durante esse teste, não no GitHub, URLs, cookies ou armazenamento do navegador. Rate limit por IP e Origin restrita são proteções básicas, insuficientes para implantação pública sem outras camadas.

## Teste local com computador temporário

Requer Node.js 24+, npm, Python 3 e acesso ao repositório local. Em um terminal, na pasta relay, execute:

~~~sh
npm install --ignore-scripts --no-audit
export BX_RELAY_CONSOLE_TOKEN="$(openssl rand -hex 32)"
export BX_RELAY_PLAYER_TOKEN="$(openssl rand -hex 32)"
export BX_RELAY_ALLOWED_ORIGINS="http://localhost:8080"
npm start
~~~

Em outro terminal na pasta relay, mantendo o **mesmo** BX_RELAY_CONSOLE_TOKEN, execute:

~~~sh
npm run demo:pair
~~~

Em um terceiro terminal, na raiz do repositório, execute:

~~~sh
python3 -m http.server 8080 --bind 127.0.0.1
~~~

Abra http://localhost:8080/remote/ e expanda **Vincular console (laboratório)**. Digite o endereço ws://127.0.0.1:8765/v1/link e o código de oito números exibido pelo console simulado. O terminal do simulador pedirá a aprovação SIM. Se aprovar, a interface liga os comandos automaticamente ao relay. Nenhum PS4 físico é controlado.

**Não compartilhe tokens de console, credenciais do relay ou dados de conta.** O endereço WS sem TLS só é permitido localmente. No GitHub Pages, o formulário exige WSS em servidor protegido; não há backend público já implantado.

## Endpoints HTTP do laboratório

| Endpoint | Quem usa | Função |
| --- | --- | --- |
| POST /v1/pair/start | Console autenticado | Gerar código |
| POST /v1/pair/claim | Navegador | Solicitar vínculo |
| GET /v1/pair/pending | Console autenticado | Consultar pedido |
| POST /v1/pair/decide | Console autenticado | Aprovar ou negar |
| GET /v1/pair/status | Navegador autenticado | Aguardar aprovação |
| POST /v1/pair/revoke | Console autenticado | Revogar vínculo |

Os endpoints protegidos usam Authorization: Bearer. A aplicação só aceita origens configuradas, recusa tokens em URLs e impõe limites de corpo e tentativas.

## Para funcionar com o PS4 real

1. Validar a instalação e o diagnóstico HTTPS do PKG v0.21 no console físico.
2. Desenvolver e testar um agente PS4 residente com tela de aprovação, TLS, pareamento revogável e conexão de saída; ainda não há ELF residente funcional.
3. Criar PKG gerenciador que inicie/pare o agente e só habilite AutoRun depois de validação física.
4. Integrar registro nativo Remote Play e streaming de mídia via gateway Chiaki-NG-Web, com respeito à licença AGPL-3.0. O código BX de vínculo não substitui o código oficial de registro do Remote Play.
5. Validar conexão local e depois internet externa/CGNAT com gateway protegido, controle de banda, privacidade e medição real da latência.

Referências: https://github.com/CSystem77/Chiaki-NG-Web , https://github.com/MoHadiShibli/Control4Free e https://github.com/GoldHEN/GoldHEN .

Este laboratório ainda requer computador para simular console e executar backend. O objetivo final segue sendo PS4 ligado em casa, sem computador adicional.

## Próxima etapa implementada: prova HTTP no PS4 (experimental)

A pasta [native-pair/](../native-pair/) contém um aplicativo próprio que poderá ser executado manualmente no PS4. Usa HTTPS com configuração privada no console, envia presença por tempo limitado, mostra código e pede decisão pelos botões X/O. É um **vínculo inicial**, não uma sessão de jogo ou um serviço residente. Enquanto não houver WebSocket de console e gateway de mídia, o navegador mostra a aprovação HTTP sem liberar controles. O PKG diagnóstico v0.21 continua intacto.

Há um workflow dedicado para compilar o novo aplicativo; não confundir sucesso de compilação com funcionamento no PS4 físico. Consulte [native-pair/README.md](../native-pair/README.md).
