# BX Native Transport — PKG, payload e navegador

Objetivo: PS4 → iPhone/Android na LAN e pela internet, sem PC/Mac ou celular
em casa como ponte. O PKG instala um processo separado que encaminha o
Remote Play nativo do console. Não captura a GPU nem altera BX-HEN.

## Implementação e evidência

- Ponte C binária interoperável com Chiaki-NG-Web, restrita a loopback TCP
  9295 e UDP 9295/9296/9297. Sem listener TCP, destinos LAN, DNS ou shell.
- Payload OpenOrbis com HTTPS de saída e envelopes sequenciados/idempotentes.
- Relay separado `bx-native-stream`, chaves distintas para console/jogador,
  ticket WebSocket de uso único e sessão de até uma hora.
- Cliente Chiaki WASM de revisão fixada, licença AGPL e fonte correspondente.
  Player BX com registro, H.264/WebCodecs, PCM/Web Audio e toque/gamepad.
- Instalador **BRPM00002**, separado do Pair Test BRPM00001. Copia apenas
  `/data/payloads/bx-rp-transport.elf`, sem AutoRun ou início automático.

Passaram testes de TCP/UDP reais em localhost, framing, destinos proibidos,
backpressure, envio parcial, repetição HTTPS sem duplicação, autenticação e
mapeamento de controles. O PKG/ELF e o cliente WASM compilaram no CI.
O player carregou em navegador e o teste no relay público transportou bytes
sintéticos WebSocket ↔ HTTPS ↔ ponte C ↔ TCP/UDP de eco no computador.
**Esse teste não usou PS4 nem comprova jogo, som ou controles no console.**

Em datas atuais do Cloudflare, mensagens binárias têm padrão Blob. O relay
fixa `binaryType='arraybuffer'` antes de accept; há regressão para esse caso.
O teste público detectou a falha antes dessa correção.

Firmware 13.52/GoldHEN é informação do usuário, não validação de compatibilidade.
Permanência do ELF durante jogos, registro local, áudio audível, Safari,
latência, recuperação e CE-34878-0 continuam dependendo de teste físico.
O transporte por lotes HTTPS pode ser limitado por RTT, banda e quotas do relay.
Nenhum plano Cloudflare foi alterado. Fonte de referência:
https://developers.cloudflare.com/workers/runtime-apis/websockets/#binary-messages

## Instalação para teste físico

1. Copiar a configuração privada `bx-rp-transport.cfg` para
   `/user/data/bx-rp-transport.cfg` no PS4. Não substituir `bx-remote-pair.cfg`.
2. Encerrar qualquer instância anterior do novo payload; instalar e abrir o
   novo PKG BRPM00002. Fechar o PKG pelo menu PS depois da notificação.
3. Iniciar `/data/payloads/bx-rp-transport.elf` manualmente no GoldHEN LaunchPad.
   Configuração local mais lançamento explícito autorizam o transporte.
4. Abrir https://bx-native-stream.4rt949zpj8.workers.dev/ no celular e usar
   a chave de jogador do pacote privado. Não usar a chave do console no player.
5. No PS4, habilitar Uso remoto e obter o PIN em Configurações → Configurações
   de conexão do Uso remoto → Adicionar dispositivo. Registrar no player com
   esse PIN e o Account-ID Base64 da conta local. O código de vínculo BX é outro.
6. O instalador tenta mostrar esse Account-ID e gravá-lo somente em
   `/user/data/bx-rp-account-id.txt`. Não ativa ou modifica contas PS4.
7. Salvar o registro no próprio celular, iniciar a sessão e confirmar imagem
   exclusiva do PS4 em movimento, som audível e ação dos controles. Testar
   primeiro na LAN e depois com o celular em outra rede.

A arquitetura usa HTTPS de saída e não exige encaminhamento de portas do
roteador. A operação real nas redes do usuário ainda precisa ser validada.
O PS4 deve continuar ligado com o payload ativo; suspensão/wake não estão
implementados no transporte atual.

## Parada e recuperação

“Desconectar” encerra a sessão do relay e fecha os sockets. Para parar o processo
local, criar `/data/bx-rp-transport.stop`. Depois de fechar os recursos, o processo
fica ocioso para evitar o caminho libc de saída ainda não validado. Remover `.stop`
antes de iniciar outra instância, após encerrar a antiga.

`/data/bx-rp-transport.running` impede duas instâncias e bloqueia sobrescrever
um ELF ativo. Após reinício/crash, remover o marcador antigo somente depois de
confirmar que não existe instância rodando. Não encerrar payloads de outros projetos.

Relatório de etapa: `/data/bx-rp-transport-report.txt`, sem pacotes, chaves,
contas, PINs ou endereços privados. Revisar antes de compartilhar.

## Fonte e implantação

`wasm-client/upstream.json` fixa revisão e Emscripten; `patch-auth.py` adiciona
somente autenticação via subprotocolo. Artefatos incluem fonte modificada,
submódulos e COPYING. A licença/atribuições originais são mantidas.

`relay/worker.mjs` é independente de `cloudflare/pairing-worker.mjs`. Secrets
novos ficam na configuração privada do serviço, nunca no Git. O arquivo
`relay/assets.mjs` versionado é um placeholder: `build-assets.py` gera os assets
públicos do cliente compilado para upload via API, sem incluir credenciais.

## Correção de inicialização do LaunchPad

Na inspeção FTP do PS4 do usuário, a configuração e o ELF eram iguais aos
entregues, mas não havia relatório nem marcador de execução. “Carregou” no
LaunchPad não confirmou entrada em main(). O ELF anterior usava o CRT de app
OpenOrbis. O serviço agora usa ps4-payload-sdk v0.9 com CRT fixado em
573b4a0d0d5fa8695cfeee5f5e2f0447c550035d, que inclui suporte 13.52. O PKG
continua OpenOrbis. Apenas as declarações orbis são reutilizadas no payload;
libc, entrada, resolvedor e link são do SDK de payloads. O artefato inclui a
licença GPL e a fonte do SDK. A mudança ainda exige teste físico de inicialização.
Referência: https://github.com/ps4-payload-dev/sdk/tree/573b4a0d0d5fa8695cfeee5f5e2f0447c550035d

### Physical diagnostic v04 candidate

v03 reached `sceHttpSendRequest` on the user's PS4 but returned `0x8095f006` (invalid SSL ID), before any HTTP status. v04 links HTTP first and the modern `libSceSsl2` backend rather than SSL1, keeping all certificate verification enabled. This addresses a suspected SSL context/backend mismatch; the cause and connection fix require confirmation on that console. It does not establish registration or gameplay. The report includes the build/backend to distinguish old copies.

### Physical diagnostic v05 candidate

v04 replaced the previous invalid-ID error with `0x8095f00c` during send. v05 explicitly loads official ISRG Root X1/X2 into each HTTP context, before creating its template, and fails closed if loading fails. Both anchors were obtained from Let's Encrypt over verified HTTPS; their DER fingerprints are pinned in `tls_roots.h`. A desktop TLS connection to the configured public BX host succeeded using only those roots and hostname validation. That is not PS4 TLS validation. No certificate-ignore callback or verification-disable call is added. Report SSL detail fields are numeric and contain no credentials. Retesting the PS4 is required.

### v06 certificate-format compatibility candidate

v05 physically entered but `sceHttpsLoadCert` returned `0x8095f006`; no authenticated relay exchange occurred. v06 preserves the official pinned roots and uses CRLF PEM line endings, following the hardware-compatible serialization documented in Xyhlo/SSPI `app/NativeHttp.cs` (read-only reference; no application code copied). It reports the numeric owned SSL/HTTP context IDs and `relay_idle` after a successful no-session HTTP 200. Whether formatting causes the v05 error remains unconfirmed until hardware retest. No keys, identities or packet contents enter the report.

### v07 isolated HTTPS client

v06 physically returned invalid-ID from native `sceHttpsLoadCert` even with CRLF PEM (SSL ID 263, HTTP ID 894). v07 switches the exchange to bounded libcurl/OpenSSL from payload PacBrew v0.3.3. Native SCE HTTP code remains behind the non-default build path for diagnosis; default ELF must not import SCE HTTP/SSL. Socket bridging and BX-HEN remain unchanged.

The isolated client verifies certificates and hostname with the embedded official roots, permits HTTPS only, disables redirects/proxy discovery, limits the response to 256 KiB, and has a five-second request deadline. It resets request pointers and frees authentication headers after each poll while retaining libcurl's connection cache. Never enable verbose logging. Protocol sequence/retry handling remains in the existing transport.

`tls-dependencies.json` pins the prebuilt test bundle and its exact dependency sources. This is an experimental candidate, not a claim that these package versions have completed a production dependency/security review. CI includes the source/license archives and package recipes. Host TLS tests use synthetic data and temporary certificates: binary roundtrip, wrong CA, wrong hostname, no redirect, oversized response and header injection rejection. Hardware confirmation still required.

### v08 registration loopback wire-order correction

Physical v07 report confirms `session_active`, HTTP 200, no transport error. The player reports R01 while preparing registration search. A regression test using the actual WASM client's `sin_addr.s_addr` wire bytes (`7f 00 00 01`) reproduces a local bridge rejection before the fix. The bridge had treated a network-order address as a host-order number and accepted the reversed octets instead.

v08 requires numeric wire value `0x0100007f`, corrects DNS reply bytes and socket name/data push addresses, and rejects reversed `01 00 00 7f` as well as LAN destinations. The adapter itself still connects only to the console loopback. Updated host TCP/UDP tests derive address fields from `inet_aton` and verify return addresses. This fixes the reproduced interoperability defect; real PS4 registration remains pending.
