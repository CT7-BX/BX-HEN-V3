# BX-REMOTE-PLAY — prova de vínculo NATIVA para PS4 (v0.18 experimental)

**Estado: pareamento HTTPS confirmado pelo usuário na v0.15, seguido de CE-34878-0 após alguns segundos. A v0.16 contornou o retorno de main; a v0.17 adicionou OTA experimental e a v0.18 inclui um ELF residente de diagnóstico, com execução e estabilidade ainda não verificadas em PS4 físico.** Este pacote não oferece Remote Play, streaming de vídeo/áudio, virtualização de controle, agente residente nem início automático.

## Por que outro PKG?

O pacote existente `ps4-agent/` v0.21 permanece intacto como diagnóstico HTTPS. Este projeto cria outro aplicativo e outro Title ID, `BRPM00001`, para testar o primeiro vínculo real entre um programa homebrew executado no PS4 e o backend do BX-REMOTE-PLAY.

## Fluxo de prova

1. O usuário inicia manualmente o aplicativo `BX Remote Play - Pair Test` no PS4 com GoldHEN já ativo.
2. O aplicativo lê, no próprio console, um arquivo de configuração privado contendo **somente** a origem HTTPS do seu servidor e um token de console diferente de todos os tokens dos jogadores.
3. Ele envia uma presença HTTPS ao relay, solicita um código de 8 dígitos e tenta exibi-lo por notificação na TV.
4. No navegador, o usuário abre **Vincular console (laboratório)** e insere o código e o endereço WSS do mesmo relay.
5. O PKG verifica solicitações por HTTPS e exige um aperto **novo** em X para aprovar ou O para negar. OPTIONS cancela.
6. Após a aprovação, o site confirma que o vínculo HTTP foi autorizado, mas **não inicia controles nem vídeo**, pois este aplicativo ainda não estabelece um WebSocket de console.
7. Depois da aprovação, o aplicativo permanece aberto por até dois minutos, ou até OPTIONS. Então revoga o vínculo, limpa os recursos e entra em estado ocioso, sem retornar de `main()`. Feche o aplicativo pelo menu do botão PS. Não há AutoRun, agente residente, mídia ou listener público. O relatório de diagnóstico local registra etapas da execução caso o CE-34878-0 persista.

## Novo serviço independente em segundo plano — v0.18 experimental

A versão v0.18 agora **embute um ELF separado dentro do PKG**: `bx-remote-service.elf`. Após abrir o app e validar a configuração privada, pressione **TRIÂNGULO** quando aparecer a notificação de preparação para copiar o serviço para `/data/payloads/bx-remote-service.elf`. X/O/OPTIONS ignoram a instalação.

**Atenção: preparar não é executar.** A cópia cria um arquivo local `/data/bx-remote-service.enabled`, mas **não** inicia o processo nem altera o AutoRun do GoldHEN. Para o primeiro teste, abra o menu do GoldHEN e use **Utilities → Payloader LaunchPad → bx-remote-service.elf**. Não ative o AutoRun antes de comprovar a estabilidade, o encerramento e o comportamento durante jogos na versão exata do seu console.

O ELF é executado fora do aplicativo e, se o GoldHEN realmente mantiver o processo, envia **somente heartbeats HTTPS** ao relay configurado, a cada 30 segundos após uma resposta bem-sucedida. Erros de rede produzem backoff de 1 a 60 segundos; não abre porta pública, não acessa jogos, não captura vídeo ou áudio, não injeta controles e **não mantém autorização permanente de jogador**. O relatório sem tokens fica em `/data/bx-remote-service-report.txt`. O serviço relê seu estado de ativação local e encerra quando um arquivo `/data/bx-remote-service.stop` existe, ou o arquivo `/data/bx-remote-service.enabled` deixa de existir. Desative o AutoRun, se você o ativou manualmente, antes de remover o ELF.

**Não está comprovado em hardware:** a compilação como ELF não valida sua execução pelo LaunchPad ou continuidade em segundo plano; essa etapa precisa de teste real. O serviço ainda não é uma implementação do protocolo Remote Play. A autorização de um dispositivo "uma vez para sempre" também depende de armazenamento e revogação seguros no backend, que ainda não existem. O PKG continua sendo necessário para obter um código na primeira ligação; o ELF não substitui o vínculo HTTPS atual.

## Atualização OTA experimental (v0.17)

Depois de instalar esta versão **manualmente uma vez**, o PKG verifica o manifesto público em cada inicialização com configuração privada válida e internet. Quando há versão nova, ele tenta baixar automaticamente o pacote de GitHub Releases para `/data/pkg/`, limitando o tamanho a 64 MiB, seguindo somente URLs HTTPS de ativos oficiais do GitHub e calculando SHA-256 durante a transferência. Um download incompleto ou com hash divergente é descartado. O segredo do console NÃO é enviado ao GitHub.

Depois de verificar a integridade, a notificação da TV solicita **X para instalar** ou **O/OPTIONS para ignorar**. A instalação não ocorre sem um novo pressionamento de X; o usuário tem até 30 segundos para decidir. O programa valida o Title ID `BRPM00001` usando `sceAppInstUtilGetTitleIdFromPkg`, tenta preparar a substituição e só então solicita a instalação. Caso o console recuse, a versão instalada permanece e o PKG verificado continua em `/data/pkg/` para uso com o Package Installer do GoldHEN.

**Limitações importantes:** o instalador autônomo ainda não foi validado em PS4 físico e pode exigir permissões adicionais que o aplicativo não tem; instalações sobre o próprio aplicativo podem falhar ou gerar problemas em determinados firmwares. Não faz escalonamento de privilégios nem contorna falhas de autorização. Esta função é experimental e exige confirmação. Não equivale a uma instalação silenciosa garantida. Se ocorrer falha, utilize o Package Installer para recuperar a versão estável. O arquivo `/data/bx-remote-pairing-report.txt` registra as etapas de atualização e encerramento, sem chaves secretas.

A automação de GitHub Actions publica o PKG somente depois de build e validação bem-sucedidos, gera o hash SHA-256 e atualiza o canal público somente após a criação do release. A v0.16 não sabe baixar/instalar atualizações; ela precisa ser substituída manualmente pela v0.17 para ativar esse fluxo nas próximas versões.

## Gerador automático de configuração privada (novo)

Em um computador com Node.js 20 ou superior, é possível criar **offline**, de uma só vez, a configuração do PS4 e as variáveis do relay, usando o mesmo segredo de console e outro segredo separado para o jogador:

~~~bash
node native-pair/tools/generate_setup.mjs --origin https://relay.seudominio.com --out /tmp/bx-pair-private
~~~

O domínio é apenas um exemplo: você precisará ter **seu próprio servidor HTTPS/WSS** funcionando. O comando não publica o servidor nem instala arquivos no PS4. Ele cria uma pasta privada **fora do repositório Git** com dois arquivos:

- `bx-remote-pair.cfg`: copie de forma privada para `/user/data/bx-remote-pair.cfg` no PS4 antes de iniciar o aplicativo.
- `relay-private.env`: carregue **somente no servidor**, com `source /tmp/bx-pair-private/relay-private.env`, no mesmo terminal onde vai iniciar o relay Node.

O gerador usa tokens aleatórios distintos, não imprime credenciais, aplica permissões de proprietário (0700 na pasta, 0600 nos arquivos, em sistemas Unix), recusa diretórios de saída já existentes e **recusa escrever dentro do repositório**, para evitar publicação acidental. Escolha um caminho diferente se o diretório já existir. Nunca envie esses arquivos para GitHub, links públicos ou mensagens.

**Atenção:** é um auxílio local para laboratório. Não cria conta, não ativa AutoRun, não configura seu roteador e não substitui um backend público protegido.

## Configuração privada — NÃO publicar no GitHub

Este PKG não possui credenciais embutidas. Antes de iniciar, um arquivo local deve existir em `/user/data/bx-remote-pair.cfg` ou `/data/bx-remote-pair.cfg` no próprio console, com exatamente estas duas chaves:

~~~ini
relay_base=https://relay.exemplo.com
console_token=COLOQUE_AQUI_64_CARACTERES_HEXADECIMAIS_MINUSCULOS
~~~

O endereço acima é fictício e o valor mostrado **não é uma chave funcional**. O servidor precisa ser HTTPS válido e acessível, com a mesma chave secreta definida em `BX_RELAY_CONSOLE_TOKEN` no backend. Nunca envie a chave em screenshots, issues, commits ou mensagens. O projeto não instala nem cria esse arquivo sozinho. A implementação rejeita URL HTTP, caminhos adicionais, URL com senhas, tokens malformados ou chaves extras.

O GitHub Pages **não hospeda um relay Node**. O backend necessário deve estar implantado separadamente por você sob TLS/HTTPS e WSS, com proteção adicional de acesso e monitoramento. Não publique a versão de laboratório na internet aberta sem revisão de segurança.

## Controles locais

- **X**: aprovar uma solicitação pendente.
- **O**: rejeitar uma solicitação pendente.
- **OPTIONS**: encerrar a prova.
- O código expira em aproximadamente dois minutos. Há notificações periódicas, mas a apresentação na TV depende de execução física e pode variar com o firmware.

## Compilação e validação

A workflow `native-pair-build.yml` compila com a versão fixada do OpenOrbis, executa testes portáveis de configuração/JSON, valida identificador e ícone do PKG e executa `PkgTool.Core pkg_validate`. Artefatos do GitHub Actions expiram, conforme retenção.

O Title ID é `BRPM00001`, diferente do diagnóstico `BRPT00001`; portanto, instalar esta prova não sobrescreve o diagnóstico.

Os seguintes pontos **não estão validados em hardware**: leitura de config em `/user/data`, acesso TLS do console ao seu servidor, inicialização `UserService`/`Pad`, notificações de código, instalação/abertura PKG e permissões dos arquivos.

## O que ainda falta depois da prova

1. Testar o PKG fisicamente e capturar o relatório local de erro/sucesso sem compartilhar chaves.
2. Desenvolver **agente PS4 residente** com conexão cifrada de saída e WebSocket (ou outro canal próprio) que possa permanecer ativo durante jogos, com revogação e proteção contra controles presos.
3. Integrar **protocolo Remote Play nativo** ao gateway do Chiaki para vídeo/áudio e registro real; o vínculo BX não substitui esse pareamento de mídia.
4. Medir latência local; depois executar testes externos/CGNAT com relay de mídia e autenticação.
5. Só então considerar PKG gerenciador e AutoRun após GoldHEN, com instalação e remoção explícitas.

Documentos complementares: `docs/PAIRING-AND-REAL-PS4.md`, `docs/LOW-LATENCY-AND-NETWORK.md`.

Referência OpenOrbis: https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain .

## Primeira execução e correção do encerramento — v0.13

O teste no PS4 físico com **Pair Test v0.12** confirmou que o aplicativo inicia e notifica **"Falta configurar servidor HTTPS e token privado"**. Em seguida, o aplicativo fechava com erro na interface do PS4. A investigação revelou que o código saía com status `return 2` após cinco segundos (e `return 3` para falha de biblioteca HTTPS), mesmo sendo falhas esperadas de configuração. Não há prova de que isso seja a única causa do erro do shell sem seu código CE-xxxx.

A versão **v0.13** tenta recuperar a situação sem reinstalar o PKG:

1. Quando a configuração está ausente ou inválida, mostra o caminho do arquivo e deixa o aplicativo aberto por até **2 minutos**.
2. Pode copiar o arquivo privado via FTP para `/user/data/bx-remote-pair.cfg` (ou `/data/bx-remote-pair.cfg`) enquanto o aplicativo aguarda.
3. Aperte **X** no controle para testar o arquivo novamente. Se passar, o mesmo aplicativo continua para o HTTPS, sem reiniciar.
4. Aperte **OPTIONS** para sair. Após o limite de espera, a ausência de configuração e falhas normais de rede são registradas e encerradas com status `0` em vez de sinalizar um erro de processo ao sistema.

Em cada caso, o relatório permanece em `/data/bx-remote-pairing-report.txt` (ou `/user/data/bx-remote-pairing-report.txt`). Não compartilhe o `console_token` ou o arquivo `.cfg` com ninguém. Se o PS4 ainda mostrar um erro CE-, registre **apenas o código do erro e o estágio do relatório** (sem credenciais), pois ainda pode haver uma causa de execução nativa diferente.

## Preparação para os primeiros testes — v0.12

O novo guia [FIRST-HARDWARE-TESTS.md](../docs/FIRST-HARDWARE-TESTS.md) descreve os testes no PS4 e navegador, como verificar o relatório e quais informações podem ser compartilhadas sem expor credenciais.

- Janela de confirmação pelo DualShock ampliada de aproximadamente 2 para 8 segundos por solicitação, permitindo mais tempo para apertar X (aprovar) ou O (recusar).
- Depois de aprovar, a notificação permanece solicitada por cerca de 20 segundos antes da revogação do vínculo experimental, para o navegador ter mais tempo de consultar o estado.
- Relatório do PS4 agora preserva o **código real da falha HTTP/nativa** em `result_code`, inclusive quando a resposta JSON é inválida. Antes, erros diferentes podiam aparecer todos como -1.
- Esse intervalo não é sessão persistente: o aplicativo continua sendo apenas uma prova de vínculo em primeiro plano, sem AutoRun nem vídeo.

## Robustez da versão 0.11

- Endereços de servidor agora passam por validação mais rigorosa de domínio HTTPS e porta TCP válida.
- O analisador das respostas JSON verifica o objeto inteiro, bloqueia chaves duplicadas, campos aninhados inesperados e respostas malformadas. Não modifica códigos ou identificadores anteriores se a resposta for inválida.
- O site tem botão **Testar servidor** que consulta `/health` com tempo limite, sem enviar código ou token.
- Nenhum acesso ao console físico foi comprovado nesta versão; o novo PKG é experimental e diferente do PKG de diagnóstico v0.21.

## Melhorias do Pair Test v0.14 (prova HTTPS; não transmite jogos)

- **Arquivo via FTP detectado automaticamente**: na tela inicial de configuração, o PS4 verifica `/user/data/bx-remote-pair.cfg` e o caminho alternativo `/data/bx-remote-pair.cfg` a cada **5 segundos** por até **2 minutos**. X força uma nova leitura; OPTIONS encerra normalmente. O navegador/PS4 não guarda seu segredo fora do arquivo privado.
- **Erros de arquivo separados**: `config_missing` para ausente e `config_invalid` para inválido; nunca inclui o conteúdo ou segredo no relatório.
- **Compatibilidade com editores**: aceita marca BOM UTF-8 e linhas vazias do Windows (CRLF), sem aceitar HTTP, token incorreto, duplicações ou chaves inesperadas.
- **HTTPS mais claro**: notificações distintas em HTTP **401** (chave diferente), **403** (acesso negado) e **503** (servidor indisponível). O relatório `/data/bx-remote-pairing-report.txt` continua preservando estágio/código/HTTP.
- **Estabilidade do controle**: só finaliza o serviço de usuário se sua inicialização realmente ocorreu, inclusive em falhas parciais. Não ativa serviços residentes nem acesso remoto sem autorização.
- O PKG usa o mesmo Title ID `BRPM00001` das versões anteriores, atualizando o teste existente. A compilação e a validação estrutural não substituem teste no console físico.

Após copiar a configuração, aguarde a notificação **Config OK. Conectando HTTPS...**, ou aperte X. Para vincular, o site usa **Servidor HTTPS de vinculação**, não **Servidor WSS** (este pertence ao simulador). Se houver falha, informe o texto da notificação e o estágio do relatório; **nunca envie o `console_token`**.

## Atualizações automáticas: primeira etapa (v0.15)

Ao abrir o **Pair Test v0.15**, depois de ler a configuração privada e iniciar as bibliotecas HTTPS, o aplicativo consulta automaticamente **uma vez**:

`https://ct7-bx.github.io/BX-REMOTE-PLAY/remote/update.txt`

O arquivo público de versões tem um identificador de título fixo (`BRPM00001`), versão numérica e o SHA-256/URL de um PKG publicado na conta oficial. O app valida os campos e compara as versões numericamente (0.10 é posterior a 0.9). Quando existe uma versão maior, exibe uma notificação na TV indicando a versão e a página de *GitHub Releases*. A consulta não usa o token privado do console, não envia dados de pareamento e, se a internet estiver indisponível, **não bloqueia o teste de vínculo**.

**Limite importante:** a v0.15 **detecta atualizações automaticamente, mas não baixa, substitui ou instala o PKG sozinha**. A instalação automática ainda exige um componente de instalação com permissões BGFT/AppInstUtil e testes físicos específicos antes de ser habilitada para evitar corromper instalações do PS4. Por enquanto, baixar e instalar o novo `.pkg` continua manual; a v0.14 não possui esse verificador, então precisa de uma última atualização manual para v0.15.

A consulta ocorre **após** uma configuração privada válida, não quando o console está aguardando o arquivo `.cfg` pelo FTP. O manifesto é atualizado pela publicação de Releases verificados no GitHub, e não fica incorporado ao binário.

O arquivo público é apenas aviso; mesmo com TLS e SHA-256 publicado, ele **não autoriza execução ou instalação automática**. Nunca inclua chaves privadas em `update.txt`.
