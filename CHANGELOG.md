# Histórico de atualizações — BX-REMOTE-PLAY

## 2026-11-15 — Integração inicial PS4 e renomeação

- Repositório renomeado para `CT7-BX/BX-REMOTE-PLAY`.
- Adicionado código-fonte de teste HTTPS para PS4 em `ps4-agent/`, sem PKG validado.
- Criado marcador estático no próprio site para testar a comunicação.
- CI testa o contrato do marcador, sem afirmar compilação nem compatibilidade do console.
- Permanecem pendentes sessão, vídeo, áudio e comandos remotos.

## 2026-11-15 — Foco exclusivo no Remote Play

- O repositório BX-HEN-V3 passou a ter o **BX-HEN Remote Play** como projeto principal.
- A página inicial agora encaminha para `remote/` e mantém o endereço anterior funcionando.
- O README esclarece os recursos realmente implementados e separa o host de desbloqueio.
- Sem exclusão do histórico ou alteração do repositório de desbloqueio.
- Esta mudança **não** implementa conexão remota, streaming ou agente PS4.

## 2026-11-15 — Protótipo de controles 0.1

- Interface preta e vermelha em `remote/`.
- Detecção local de controle físico pela Gamepad API.
- Exibição de botões, gatilhos e eixos dos analógicos.
- Botões virtuais demonstrativos, sem conexão ao console.
- CI com testes do módulo de controles.

## 2026-11-05 — Publicação inicial do antigo BX-HEN V3

- Criada a base experimental com visual neutro e layout responsivo.
- Incluído acesso à área experimental externa.
- Removidos botões GoldHEN e PS4HEN sem integração validada.
- Configurado o GitHub Pages e histórico de atualizações.

> O código e o histórico anterior permanecem rastreáveis no GitHub, mas a página inicial agora é dedicada ao BX-HEN Remote.
