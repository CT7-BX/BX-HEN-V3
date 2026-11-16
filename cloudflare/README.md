# BX-REMOTE-LINK — Cloudflare Worker de vínculo real (backend v0.1)

Esta pasta implementa um **backend HTTPS de vínculo com código temporário**, projetado para ser utilizado pelo aplicativo PS4 `native-pair/` e pela página `remote/` do BX-REMOTE-PLAY.

**Não é ainda Remote Play:** este serviço não recebe vídeo, áudio ou comandos de controle e não abre portas no PS4. Mesmo quando o código for aprovado, o site apresentará **vínculo HTTP autorizado, sem streaming**.

## Comando independente PS4 ↔ navegador (v0.21)

Depois do vínculo temporário **aprovado** no console, o navegador pode enviar apenas `POST /v1/bridge/probe` com corpo JSON vazio e bearer de reivindicação. O Worker enfileira uma tarefa fixa, sem endereço, shell ou payload arbitrário. O console obtém `bridgeProbeId` via heartbeat autenticado (token privado de console), verifica `127.0.0.1:9295` localmente e devolve `POST /v1/bridge/probe-result` com `id` de 64 dígitos hexadecimais e `tcp9295:true|false|null`. O navegador lê `GET /v1/bridge/probe`, restrito ao mesmo vínculo.

A fila limita-se a uma tarefa ativa e expira em 90 segundos ou ao revogar/iniciar novo vínculo. Essa API não é uma conexão TCP/UDP, gateway de mídia, vídeo ou controle de jogos. Segurança validada por testes offline do Durable Object. Detalhes: [NATIVE-BRIDGE-RESEARCH.md](../docs/NATIVE-BRIDGE-RESEARCH.md).

## Resultado nativo restrito Remote Play — v0.20

O ELF residente v0.20 envia o campo opcional `remotePlayTcp9295` com `true`, `false` ou `null` em `POST /v1/pair/heartbeat`. A requisição exige o token privado de console já configurado. O Worker guarda apenas o resultado da tentativa local `127.0.0.1:9295` e timestamp, sem número IP, credenciais, imagens ou mídia. `GET /v1/pair/status` acrescenta `remotePlayProbe.loopbackTcp9295` **somente ao navegador de vínculo temporário aprovado**, e somente enquanto o resultado tiver menos de 90 segundos. `/health` não revela o teste nem indica transmissão. `controlAvailable:false` e `video:false` continuam corretos. Veja [o plano de arquitetura PS4 sem computador](../docs/PS4-ONLY-VIDEO-BRIDGE.md).

## Sinalização P2P para primeira imagem real (experimental)

A nova API `/v1/media/{offer,answer,close}` utiliza **o Durable Object existente** com uma sala efêmera de ingresso de três minutos. Ela permite que um Mac, com o Chiaki já conectado a um PS4, compartilhe uma janela/aba com um iPhone executando o player BX; o vídeo e o áudio disponíveis seguem por WebRTC diretamente entre os navegadores. O Worker armazena apenas SDP temporário (pode conter candidatos de IP privado), nunca vídeo, áudio, credenciais PSN ou controles. A sala exige um token de 256 bits que não entra em URLs; origin restrita e proteção contra excesso de novas salas.

**Isso não faz o PS4 enviar vídeo diretamente ao Worker.** A mídia depende do Mac e do Chrome/Edge terem permissão de captura de janela/aba. Não há TURN para redes diferentes nem controle remoto do jogo. Documentação: [Piloto real de vídeo P2P](../docs/P2P-REAL-VIDEO-PILOT.md).

## Arquitetura

- Um Worker exclusivo chamado `bx-remote-link`, separado do host `bx-hen`.
- Um Durable Object **SQLite-backed** com armazenamento persistente de um único console de teste.
- Uma credencial aleatória de console armazenada como **Workers secret** `BX_RELAY_CONSOLE_TOKEN` e no arquivo privado do próprio PS4; nunca no GitHub.
- Site GitHub Pages `https://ct7-bx.github.io`, único Origin CORS autorizado.
- Solicitações vindas do PS4 sem cabeçalho Origin, autenticadas com `Authorization: Bearer`.

## Fluxo de primeiros testes

1. O PS4 inicia o `Pair Test` com arquivo privado em `/user/data/bx-remote-pair.cfg`, contendo `relay_base` e `console_token` (ambos precisam corresponder ao backend).
2. O aplicativo chama `/v1/pair/heartbeat`, depois `/v1/pair/start`. O Worker gera oito dígitos e só devolve o código **ao console autenticado**, válido por 120 segundos.
3. O usuário abre o site, informa diretamente `https://bx-remote-link.4rt949zpj8.workers.dev` no formulário, digita o código e faz a solicitação.
4. O aplicativo consulta `/v1/pair/pending` e o dono escolhe X para aprovar ou O para negar na TV.
5. O navegador consulta `/v1/pair/status`, recebe `approved` e `controlAvailable:false`. Isso significa somente que o PS4 aprovou o vínculo HTTP; **não existe canal de comandos**.
6. O aplicativo encerra e faz `POST /v1/pair/revoke`, invalidando a solicitação. Não existe AutoRun.

## Segurança

- Código de oito dígitos e tokens de 256 bits gerados por Web Crypto; hashes SHA-256 de códigos e tokens temporários no Durable Object.
- O segredo do console só existe em Workers Secrets e no PS4, não no JavaScript público.
- HTTPS obrigatório no PKG; recusa de URL com query string, origem externa ou credenciais em URL.
- Máximo de oito tentativas de código por minuto/endereço de origem, com armazenamento limitado a 512 hashes temporários; um abuso distribuído ainda requer WAF/Turnstile e revisão.
- Corpo JSON limitado a 1 KiB, respostas `no-store`, estado `waiting → pending_confirmation → approved/denied`, com expiração e revogação.
- Token de sessão de controle **nunca é entregue**, porque o controle de PS4 ainda não foi implementado.
- O Worker é **para testes pessoais**, não atende múltiplas contas/consoles e não deve ser apresentado como plataforma de produção.

## Testes

~~~sh
node --test cloudflare/tests/*.test.mjs
~~~

Os testes usam um Durable Object com armazenamento simulado em memória e verificam confirmação, restrições de origem, token, expiração de solicitação, revogação, negação, limite por IP e ausência de vídeo.

## Implantação

A implantação deve manter o código no GitHub, mas o token privado é gerado fora do repositório. O Worker exige a migração `new_sqlite_classes: ["BXPairingRoom"]` e a binding de Durable Object `PAIRING_ROOM`. Configure também a variável secreta `BX_RELAY_CONSOLE_TOKEN` com um hexadecimal aleatório de 64 caracteres e habilite o subdomínio Workers somente para `bx-remote-link`.

**A publicação do site GitHub Pages não executa nem implanta este Worker.** O backend necessita de implantação própria e configuração privada do PKG. Em nenhum caso publicar tokens, logs com segredos ou arquivo `.cfg` em commits/issue.

Documentação adicional: [Primeiros testes](../docs/FIRST-HARDWARE-TESTS.md), [Prova de vínculo nativa](../native-pair/README.md).

## Implantação desta instância — 15/11/2026

Uma instância separada do projeto BX-HEN foi publicada pelo conector Cloudflare:

- Worker: `bx-remote-link`
- Endpoint HTTPS planejado: `https://bx-remote-link.4rt949zpj8.workers.dev`
- URL a informar na interface: `https://bx-remote-link.4rt949zpj8.workers.dev`. Endereços WSS legados do simulador ainda são reconhecidos, mas **não existe WebSocket /v1/link nesse Worker**.
- Armazenamento: binding `PAIRING_ROOM` para Durable Object SQLite `BXPairingRoom`.
- A instalação do Worker e o subdomínio foram confirmados pela API do Cloudflare. **A URL pública não pôde ser testada externamente com sucesso nesta sessão**, por isso não afirmar que respondeu ao navegador.
- **A configuração secreta do console ainda precisa ser realizada.** O endpoint de saúde permite descobrir isso com `configured: false`.

### Passo manual necessário para habilitar vínculo de verdade

A configuração da chave secreta através da conexão Cloudflare foi bloqueada. Por segurança, nenhuma chave foi embutida no Worker ou enviada ao GitHub. A pessoa responsável pela conta precisa concluir **uma vez**:

1. Em um computador com Node.js, na raiz do repositório, crie os arquivos privados (o nome do diretório deve ser novo):

   ~~~sh
   node native-pair/tools/generate_setup.mjs --origin https://bx-remote-link.4rt949zpj8.workers.dev --out /tmp/bx-remote-segredos
   ~~~

2. Abra seu painel Cloudflare, entre em **Workers & Pages → bx-remote-link → Settings → Variables and Secrets**, adicione uma variável do tipo **Secret** com o nome exato `BX_RELAY_CONSOLE_TOKEN` e copie o valor `console_token` que está **no arquivo privado local** `/tmp/bx-remote-segredos/bx-remote-pair.cfg`. Nunca envie esse valor no chat nem em um commit.
3. Copie **privadamente** esse mesmo arquivo `bx-remote-pair.cfg` para o caminho `/user/data/bx-remote-pair.cfg` no PS4 de teste, mantendo o token fora do GitHub e de mensagens públicas.
4. Confirme que **Testar servidor** no site informa o backend configurado. A partir daí, instale/abra manualmente o **Pair Test v0.12** no PS4 para verificar um código real e a aprovação X/O. Esse pacote ainda não foi testado fisicamente.
5. Após o primeiro teste, revogue/rotacione a chave pelo painel se houver suspeita de exposição. O arquivo `relay-private.env` gerado no computador serve apenas ao **antigo relay Node**; não precisa ser enviado ao Cloudflare nem ao PS4.

**Não há login PSN, persistência de console vinculado, transmissão do jogo ou suporte multiusuário nesta versão.** O segredo é específico desta instância de prova, e o vínculo HTTP é revogado quando o aplicativo de teste PS4 encerra.

### Melhorias de validação e estado

O frontend agora utiliza diretamente HTTPS para o pareamento, sem apresentar o endpoint WebSocket inexistente como requisito. O Worker recusa pedidos HTTP em texto claro e devolve `BACKEND_NOT_CONFIGURED` (HTTP 503) quando tentam solicitar código sem um segredo de console válido; o site traduz esse erro em uma orientação, sem expor chaves. Testes incluem pedidos malformados, vínculo somente HTTP, compatibilidade com relay WSS simulado e ausência de falsas promessas de streaming.

### Limite global de tentativas do código de teste

Além de oito tentativas por endereço durante um minuto, o backend encerra novas tentativas de um PIN depois de 32 erros distribuídos entre redes diferentes. O PS4 autenticado pode gerar um novo código. Esse mecanismo reduz adivinhação distribuída, mas não substitui proteção de borda/WAF e pode ser alvo de bloqueio intencional por terceiros; a janela de código curta evita bloqueio permanente. Não publicar o segredo do console.
