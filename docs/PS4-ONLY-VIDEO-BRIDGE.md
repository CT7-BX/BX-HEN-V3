# BX-REMOTE-PLAY — caminho para vídeo independente (PS4 + celular)

## Objetivo que precisa ser validado

Somente um **PS4 com GoldHEN** e um **celular com o navegador BX**, sem Mac/PC ligado em casa. O PKG de configuração deve poder ser fechado quando um jogo começa. O console deve executar um serviço residente separado, com controle de autorização, encerramento e restrições de rede adequados.

**Situação v0.20:** a interface do PKG já foi confirmada em PS4 pelo usuário. O serviço ELF possui heartbeat HTTPS e, nesta versão, uma **sonda TCP de loopback para a porta 9295**. Isso ainda não captura, decodifica ou retransmite nenhum quadro de vídeo/áudio, e não envia comandos a um jogo. O gateway WHEP e o P2P via Mac são outros testes, não representam a solução independente.

## O que o protocolo real exige

O protocolo Remote Play do PS4 usa conexão TCP (9295 para negociação) e canais UDP (9296/9297 para mídia). Os detalhes de sessão, registro/autorização, criptografia, codecs, estado de botões, interrupções e gestão de fluxo precisam ser implementados e validados. Abrir a porta 9295 **não prova** que uma sessão seja possível. As referências de arquitetura para o cliente WebAssembly são:

- [Chiaki-NG-Web (AGPL-3.0)](https://github.com/CSystem77/Chiaki-NG-Web) usa código Chiaki compilado para WebAssembly e um proxy Node.js que retransmite operações TCP/UDP do navegador. Esse proxy exige uma máquina de rede que alcance o console, portanto **não** satisfaz nosso objetivo final sozinho.
- [GoldHEN](https://github.com/GoldHEN/GoldHEN) oferece o recurso Remote Play Enabler, mas não transforma um heartbeat HTTPS em transporte de mídia.

Não copie o código AGPL de um projeto sem cumprir licença, autoria e requisitos de disponibilização de fonte. Também será necessária validação no Safari/iOS: a implementação web existente se concentra em browsers com WebCodecs, SharedArrayBuffer, COOP/COEP e threads WASM, e não comprova suporte no Safari de iPhone.

## O que foi implementado agora

### 1. Verificação nativa, com o PKG fechado

O arquivo `native-pair/remoteplay_probe.c` tenta conexão a **127.0.0.1:9295** usando `sceNetSocket` e `sceNetConnect`. Fecha imediatamente o socket; não envia dados, não usa multicast/UDP, não abre porta, não altera firewall e não toca em jogos. Um resultado falso pode significar que o serviço não escuta loopback.

O `resident_service.c` envia `{"remotePlayTcp9295":true|false|null}` no heartbeat HTTPS ao Worker de vínculo, sem endereço IP privado, conta nem PIN. A sonda só é executada depois que o dono preparou/ativou o ELF e o serviço está em execução. Se o ELF estiver fechado, não há diagnósticos novos.

### 2. Worker Cloudflare com privacidade

O Durable Object armazena somente `tcp9295` e `checkedAt` e revela essa informação apenas ao **requerente com vínculo temporário aprovado pelo console**, através de `GET /v1/pair/status`. Os resultados expiram da UI depois de 90 segundos; `/health` não expõe o diagnóstico, e `controlAvailable` e `video` continuam `false`. A mensagem do site distingue claramente porta aberta, fechada e erro. O Worker não recebe RTP nem faz túnel UDP.

### 3. Atualização do ELF opt-in v0.20

O PKG oferece **TRIÂNGULO** para substituir um ELF antigo por v0.20. O marcador local `/data/bx-remote-service.version` impede a pergunta repetida em cada abertura depois de uma instalação bem-sucedida. Não liga AutoRun nem inicia ou encerra outro payload automaticamente. Antes de substituir o arquivo, encerre manualmente a instância antiga; depois inicie a nova versão pelo GoldHEN LaunchPad. Teste em hardware é obrigatório.

## Próximas etapas necessárias para a imagem real (não implementadas)

1. **Validar rede Remote Play em hardware:** confirmar no PS4 o estado da porta 9295 e se o serviço permanece ativo durante um jogo. Testar se a conexão de loopback é aceita; caso contrário, investigar um endpoint LAN local seguro sem abrir o console à internet.
2. **Transporte restrito PS4 → nuvem:** um serviço residente autentica e inicia conexões de saída criptografadas para um gateway. Ele só pode encaminhar as operações necessárias do Remote Play a destinos locais fixos e autorizados, sem criar proxy genérico, shell, FTP público ou portas expostas no roteador. Suporte a TCP e UDP, limites de taxa/memória, autorização e revogação são indispensáveis.
3. **Cliente Remote Play no navegador:** executar a sessão real de registro, autenticação, controle e decodificação de vídeo/áudio. Reutilização de implementações de terceiros só com licença e compatibilidade verificadas. O site precisa dos cabeçalhos de isolamento exigidos pela implementação WASM, ou de outra tecnologia compatível com iOS.
4. **Comandos e áudio:** envio autenticado de estados do controle, transição segura ao perder conexão, buffers para áudio e vídeo e reconexão. Controle do jogo não é fornecido pelo relay WSS experimental existente.
5. **Testes ponta a ponta:** em PS4 físico, fechar PKG, abrir jogo, iniciar sessão no celular, confirmar vídeo em movimento e áudio audível, usar comandos, desconectar e reconectar sem travamento e sem Mac.

**Nunca rotule a etapa 1 ou um heartbeat como prova da etapa 5.** A etapa 5 é o critério para dizer que o BX está independente.

## Como usar o diagnóstico v0.20

1. Instale o PKG v0.20, mantenha a configuração HTTPS privada do PS4 (não envie tokens pelo chat).
2. No PKG, pressione TRIÂNGULO quando oferecer atualização do serviço; feche o PKG após isso. Se o ELF anterior estiver em execução, encerre-o antes de substituir.
3. Com o GoldHEN, carregue manualmente o serviço `/data/payloads/bx-remote-service.elf`. Verifique o resultado local em `/data/bx-remote-service-report.txt` com FTP de sua própria rede.
4. Para mostrar o diagnóstico no site, abra o PKG para o vínculo de oito dígitos, aprove no console e leia o estado no campo de pareamento do BX. A autorização continua temporária; não concede acesso permanente nem transmite mídia.
5. Se houver erro, traga apenas o nome do estado do relatório, sem IPs, credenciais ou arquivos de configuração.

A verificação da porta pode falhar por motivo técnico mesmo com Uso remoto habilitado. **Não é recomendável abrir portas ou expor os serviços do GoldHEN à internet apenas para fazê-la passar.**
