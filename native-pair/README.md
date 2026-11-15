# BX-REMOTE-PLAY — prova de vínculo NATIVA para PS4 (v0.10 experimental)

**Estado: implementação separada e NÃO testada em um PS4 físico.** Este pacote não oferece Remote Play, streaming de vídeo/áudio, virtualização de controle, agente residente nem início automático.

## Por que outro PKG?

O pacote existente `ps4-agent/` v0.21 permanece intacto como diagnóstico HTTPS. Este projeto cria outro aplicativo e outro Title ID, `BRPM00001`, para testar o primeiro vínculo real entre um programa homebrew executado no PS4 e o backend do BX-REMOTE-PLAY.

## Fluxo de prova

1. O usuário inicia manualmente o aplicativo `BX Remote Play - Pair Test` no PS4 com GoldHEN já ativo.
2. O aplicativo lê, no próprio console, um arquivo de configuração privado contendo **somente** a origem HTTPS do seu servidor e um token de console diferente de todos os tokens dos jogadores.
3. Ele envia uma presença HTTPS ao relay, solicita um código de 8 dígitos e tenta exibi-lo por notificação na TV.
4. No navegador, o usuário abre **Vincular console (laboratório)** e insere o código e o endereço WSS do mesmo relay.
5. O PKG verifica solicitações por HTTPS e exige um aperto **novo** em X para aprovar ou O para negar. OPTIONS cancela.
6. Após a aprovação, o site confirma que o vínculo HTTP foi autorizado, mas **não inicia controles nem vídeo**, pois este aplicativo ainda não estabelece um WebSocket de console.
7. O aplicativo revoga o vínculo de teste e sai. Sem AutoRun e sem listener público no PS4.

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
