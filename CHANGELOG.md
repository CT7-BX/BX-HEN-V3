# Histórico de atualizações — BX-REMOTE-PLAY

## 2026-11-15 — Vínculo com consentimento, laboratório v0.5

- Relay Node com código aleatório de oito dígitos, expiração curta, limitação de tentativas e confirmação explícita no console simulado.
- Formulário de vínculo na interface e autenticação automática com token temporário após aprovação.
- Rotas HTTP para iniciar, solicitar, aprovar, consultar, negar e revogar; tokens somente em memória.
- Console de teste por terminal, com aprovação SIM, e testes unitários e de integração.
- **Sem PS4 físico vinculado, sem agente residente e sem vídeo/áudio.** O PKG v0.21 continua sendo diagnóstico HTTPS.

## 2026-11-15 — Terceira revisão do PKG v0.21

- Confirmada a integração anterior v0.20 ao repositório principal.
- Adicionada segunda tentativa apenas para falhas transitórias de conectividade ou HTTP 502/503/504.
- Notificação mantida em tela com breve espera de saída; comportamento real depende de teste físico.
- Relatório com dica e contagem de tentativas; caminho alternativo `/user/data/` se `/data/` não permitir escrita.
- Regras de retentativa e diagnóstico separadas em módulo C portável com novos testes.
- Versão do pacote/APP_VER 0.21 e IDs mantidos para atualização.
- **Ainda não é um PKG de Remote Play funcional**.

## 2026-11-15 — Correções PKG de diagnóstico v0.20

- Adicionada notificação no PS4 com resultado HTTPS ou estágio/código da falha (ainda sem teste físico).
- Erro da API HTTP em hexadecimal/decimal, checagem de configuração de timeout.
- Ícone original BX-REMOTE-PLAY 512x512 RGB 24-bit, gerado e testado automaticamente.
- Metadados APP_VER e VERSION 0.20; TITLE_ID e CONTENT_ID anteriores preservados.
- Pré-validação do SFO e do PNG e geração do pacote com OpenOrbis em CI.
- Continua sendo teste de rede, **não é serviço residente ou streaming**.

## 2026-11-15 — Segunda verificação: publicação e descoberta na LAN

- O site do GitHub Pages passa a publicar somente os arquivos estáticos necessários.
- Os testes impedem que fontes do relay e do PS4 entrem no artefato público do Pages.
- O build recusa pasta de saída não vazia para evitar conteúdo antigo.
- Consulta DDP UDP 987 para **um endereço privado** com resposta simulada em CI.
- O diagnóstico TCP 9295 existente foi mantido; nenhuma sessão real do PS4 foi aberta.
- Ainda faltam payload residente, pareamento e transporte de vídeo/áudio.

## 2026-11-15 — Primeira verificação de segurança do relay
- Envio de `reset` ao console simulado se o navegador cair ou os comandos pararem de chegar por 450 ms.
- Proteção de fila de saída para não acumular controles atrasados.
- Filtro de query string em conexões WebSocket e novos testes de desconexão e inatividade.
- Limpeza de ponteiros multitoque ao perder foco e deduplicação de estados enviados.
- Ainda sem sessão PS4 real e sem canal de vídeo/áudio.

## 2026-11-15 — Interface 0.4 e início dos diagnósticos LAN

- Refino visual do controle de toque, com referência de organização no PS Remote Play oficial, mas estilos próprios.
- Botões translúcidos circulares, D-pad, analógicos, ombros e controles centrais adaptados para retrato e paisagem.
- Ajustes de transparência e tamanho na interface e gesto de toque duplo para L3/R3.
- Ferramenta Node de teste de alcance TCP 9295 para um único IPv4 privado do PS4, com testes automatizados.
- Plano técnico separado para pareamento, vídeo/áudio via Remote Play, gateway, PKG gerenciador e payload residente.
- **Ainda não houve pareamento com PS4 físico, streaming, ELF residente ou PKG novo.**

## 2026-11-15 — Interface 0.3 e projeto do payload AutoRun

- Tela de jogo redesenhada com prioridade para imagem, botões virtuais sobrepostos e controles físicos.
- Modo automático para exibir controles no celular sem gamepad; suporte a multitoque, analógicos, gatilhos, L3/R3, PS e Options.
- Tela cheia com fallback imersivo CSS no iPhone e suporte a aplicativo pela Tela de Início.
- Metas de qualidade e modo de rede local/remota, ainda sem mídia real.
- Entrada autenticada para relay **simulado**, RTT apenas até o relay.
- Modelo em C de ciclo de vida do futuro payload: início idempotente, reconexão progressiva e parada. **Sem ELF residente nem AutoRun ativado**.
- Testes automatizados para controles virtuais, entrada do relay, interface e ciclo de vida.
- Pesquisa específica de latência e limitações do Safari, sem afirmar compatibilidade física.

## 2026-11-15 — Ajuste do controle físico

- Preservado o valor analógico de L2 e R2 no protocolo do relay e no laboratório do navegador.
- Adicionados testes de valores válidos e fora da faixa permitida.
- Ainda sem envio a PS4 real.

## 2026-11-15 — Pesquisa e relay experimental 0.2

- Pesquisados GoldHEN Remote Play, Control4Free, Chiaki-ng e Chiaki-NG-Web.
- Criado estudo comparando quatro arquiteturas, com limitações de CGNAT, vídeo e licenças.
- Adicionado servidor relay Node com autenticação separada para navegador e console simulado.
- Implementada interface de laboratório para enviar botões e analógicos do DualShock 4.
- Testes de autenticação, origem e comandos inválidos; **sem PS4 físico, vídeo ou áudio**.

## 2026-11-15 — Compilação e empacotamento PS4

- GitHub Actions compilou o `eboot.bin` com OpenOrbis v0.5.4 fixado por SHA-256.
- Gerado PKG experimental de diagnóstico `IV0000-BRPT00001_00-BXREMOTEPLAY0001.pkg`.
- `PkgTool.Core pkg_validate` passou na checagem de integridade do pacote.
- Arquivos disponibilizados temporariamente como artefatos do workflow.
- **Sem teste físico; sem transmissão de vídeo, áudio ou comandos.**

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
