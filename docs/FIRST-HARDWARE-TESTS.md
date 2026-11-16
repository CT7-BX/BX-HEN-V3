# BX-REMOTE-PLAY — Primeiro teste físico (roteiro v0.12)

Este guia organiza os **primeiros testes no PS4, iPhone e Mac**, sem prometer transmissão de jogo. Os PKGs compilam no OpenOrbis, mas **ainda não temos confirmação de instalação ou funcionamento no seu PS4 físico**. O primeiro objetivo é obter evidência de rede/pareamento, não uma sessão de vídeo.

## 1. Antes de instalar

- PS4 com GoldHEN já ativado e acesso à rede; use somente o console que você controla.
- Um computador temporário com Node.js 24+ para configurar o **relay de laboratório**, um domínio próprio com HTTPS/WSS válido e um servidor com acesso autorizado. **O site GitHub Pages sozinho não hospeda o relay**.
- iPhone/Mac com navegador atualizado. O modo de controles virtuais funciona na interface, mas ainda não controla jogos.
- Faça backup das configurações privadas do seu laboratório e **não compartilhe** o arquivo `bx-remote-pair.cfg`, tokens nem os códigos temporários.

**Dois aplicativos diferentes:**

| Aplicativo | Identificador | Finalidade |
| --- | --- | --- |
| BX Remote Play - Network Test v0.21 | `BRPT00001` | Verificar HTTPS com GitHub Pages, sem relay de pareamento |
| BX Remote Play - Pair Test v0.13 | `BRPM00001` | Testar código de vínculo e aprovação X/O via seu backend HTTPS |

O Pair Test v0.12 não sobrescreve o Network Test v0.21. Nenhum deles recebe vídeo/áudio ou injeta comandos no console. **Não ativa AutoRun nem precisa instalar payload persistente.**

## 2. Verificação do navegador

1. Abra [BX-REMOTE-PLAY](https://ct7-bx.github.io/BX-REMOTE-PLAY/remote/) no iPhone ou Mac.
2. Expanda **Primeiros testes — checklist e diagnóstico**.
3. Clique em **Verificar navegador** para examinar HTTPS, Gamepad API, controle físico conectado, toque e disponibilidade de tela cheia.
4. Teste os botões virtuais e/ou DualShock 4 e marque apenas os itens que você comprovou.
5. Para enviar informações de erro, escolha **Copiar diagnóstico**. O relatório omite código de vínculo, URL/IP do relay, tokens e identificadores de conta.

## 3. Preparar backend privado e configuração PS4

Existe agora um Worker experimental separado no Cloudflare para simplificar o primeiro teste HTTP. Sua instalação foi confirmada pela API, mas **a chave secreta não foi configurada automaticamente** e o acesso público ainda não foi verificado em navegador real. Para continuar, siga [cloudflare/README.md](../cloudflare/README.md) e configure o secret de console diretamente no painel Cloudflare; o gerador offline cria o mesmo segredo para o arquivo privado do PS4. O Worker só aceita pareamento, nunca vídeo/áudio ou controle nativo.

#### Alternativa: relay Node local de laboratório

O backend Node do repositório é **laboratório**, não um serviço de produção. Use apenas uma instância **sob HTTPS/WSS, autenticada e protegida contra tentativas indevidas**. Não publique diretamente o serviço HTTP, FTP, as portas de GoldHEN ou credenciais. Sem backend confiável implantado, o teste com Pair Test termina em erro de rede; isso não demonstra problema no PS4.

Para gerar um par de credenciais correspondente **fora do repositório**, em seu computador:

~~~sh
node native-pair/tools/generate_setup.mjs --origin https://relay.seudominio.com --out /tmp/bx-pair-privado
~~~

Esse domínio é apenas exemplo. O utilitário cria dois arquivos privados com tokens aleatórios independentes:

- `/tmp/bx-pair-privado/bx-remote-pair.cfg`: copie **de forma privada** para `/user/data/bx-remote-pair.cfg` no PS4 (ou `/data/bx-remote-pair.cfg` como alternativa).
- `/tmp/bx-pair-privado/relay-private.env`: use somente no computador/servidor do relay. No terminal que iniciará o Node, carregue as variáveis com `source /tmp/bx-pair-privado/relay-private.env`.

O backend deve ser iniciado com `cd relay && npm install --ignore-scripts && npm start` **por trás de um reverse proxy TLS/WSS confiável**. O processo Node fica por padrão em loopback `127.0.0.1:8765` e não deve ser publicado diretamente na internet. A origem `https://ct7-bx.github.io` já está incluída na configuração privada gerada; se testar o HTML no localhost, permita também essa origem no backend.

Na página **Vincular PS4 — conexão experimental**, configure `https://relay.seudominio.com`, clique em **Testar servidor** e verifique se aparece `Relay acessível`. Isso confirma somente a resposta HTTP `/health`, **não** o PS4.

## 4. Instalar e testar no console

1. Comece pelo **Network Test v0.21**. Se abrir e o log contiver `result=OK`, sabemos que o PS4 conseguiu acessar o marcador público HTTPS. Procure `/data/bx-remote-play-probe.txt` (ou caminho alternativo documentado).
2. Depois instale **Pair Test v0.12**, que usa outro identificador, preservando o diagnóstico.
3. Abra o Pair Test com a configuração privada presente. O aplicativo tentará exibir um código de oito números por notificação. **Notificações do sistema e leitura de DualShock ainda dependem de teste real.**
4. Digite esse código no site, escolha **Solicitar vínculo** e, quando o aplicativo exibir a solicitação na TV, aperte **X** para aprovar, **O** para recusar ou **OPTIONS** para cancelar.
5. O site deve indicar vínculo HTTPS aprovado, **sem vídeo ou controle de jogo**. A prova é curta e o aplicativo revoga o vínculo ao sair.
6. Se o aplicativo fechar sem resultado, colete o relatório em `/data/bx-remote-pairing-report.txt` (alternativamente `/user/data/bx-remote-pairing-report.txt`).

## 5. Interpretação rápida dos erros

| Campo/etapa do relatório | O que verificar |
| --- | --- |
| `missing_or_invalid_config` | O arquivo privado existe no caminho esperado? A URL é HTTPS e o token tem 64 caracteres hexadecimais? Não envie o token |
| `network_init_failed` | Inicialização das bibliotecas do PS4; confirme versão do console/GoldHEN e o erro que apareceu na TV |
| `no_local_controller` | DualShock 4 associado a um usuário local do PS4; a API do controle precisa ser validada no hardware |
| `heartbeat_failed` ou `start_http_failed` | DNS, HTTPS/TLS, reverse proxy, `http_status` e `result_code` |
| HTTP `401` | Segredo do console não corresponde ao servidor ou credencial ausente |
| HTTP `403` | Configuração de autorização/origem ou bloqueio pelo servidor |
| HTTP `404` | Reverse proxy não encaminhou `/v1/pair/*` corretamente |
| `start_response_invalid` | Servidor respondeu JSON incompatível com protocolo BX |
| `pending_http_failed` | Falha ao consultar aprovação no backend |
| `timeout` | Código não foi solicitado/aprovado enquanto ainda válido; gere um novo |
| `approved_pairing_only` | Vínculo HTTP aprovado; não significa Remote Play funcionando |

## 6. O que compartilhar para corrigirmos

Copie somente: versão do PKG, `stage`, `result_code`, `http_status` do relatório, o texto de **Copiar diagnóstico** do site e se apareceu a notificação na TV. Não envie fotos que mostrem tokens, nomes de usuário/contas, códigos de pareamento válidos, endereços privados ou o arquivo de configuração.

**Limite atual:** não há agente residente nem gateway de vídeo/áudio. Próximo marco depois da prova: validar serviço PS4 contínuo e uma sessão Remote Play local real; só depois testar outra rede/CGNAT. Esses passos dependem do console real e de uma infraestrutura de mídia apropriada.

## Atualização: endereço correto do BX-REMOTE-LINK

Para o backend Cloudflare, informe **`https://bx-remote-link.4rt949zpj8.workers.dev`**, não `wss://...`. Esse Worker só aceita as rotas de vínculo por HTTPS. No site, **Testar servidor** avisará se o Worker está online mas sem a chave privada `BX_RELAY_CONSOLE_TOKEN`. Isso requer uma configuração manual privada no Cloudflare e o arquivo correspondente no PS4; a chave não deve ser enviada ao ChatGPT ou publicada.

Em testes locais com o relay Node antigo, `ws://localhost:8765/v1/link` ainda funciona; em qualquer servidor externo só se aceita HTTPS/WSS com TLS válido. A etapa de vídeo e controles reais permanece pendente.

## Atualização — primeira execução da v0.13

Quando o arquivo `bx-remote-pair.cfg` não existe ou é inválido, o Pair Test v0.13 não deve mais encerrar imediatamente como erro. A notificação informa o caminho; copie o arquivo por FTP enquanto a aplicação está aberta e aperte **X** para revalidar. **OPTIONS** encerra, ou o app termina normalmente após no máximo dois minutos. Se houver erro CE-, anote o código exato e o estágio do relatório, sem compartilhar o token.
