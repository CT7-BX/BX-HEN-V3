# BX-REMOTE-PLAY v0.27 — matriz real de áudio, vídeo e controles

## O que é funcional agora

A integração **Mac navegador → iPhone navegador** pode transportar vídeo e áudio capturados com autorização explícita pelo WebRTC existente. O novo canal de dados `bx-gamepad-v1` permite que o iPhone envie estados reais do controle físico ou dos botões na tela ao **navegador do Mac**, que confirma a chegada via mensagens ACK. A recepção ainda não injeta comandos no Chiaki nem no PS4. Os testes automatizados verificam a troca de quadros; é necessário confirmar WebRTC e a imagem no hardware físico.

A página ativa o envio **somente após** conectar a sessão P2P com código privado e apertar **Iniciar teste de controles**. O fluxo contém número sequencial para rejeitar mensagens repetidas, limitações de tamanho, normalização de botões/analógicos e proteção de congestionamento. Há um watchdog de 450 ms para liberar todos os botões quando os pacotes param, além de envio neutro ao desligar. Sem gravação de PIN, tokens ou estado do controle no navegador.

A sessão é negociada pelo Worker Cloudflare já implantado, que armazena somente SDP temporário; não retransmite mídia. O RTCDataChannel utiliza a criptografia padrão DTLS/WebRTC.

## Matriz honesta dos quatro caminhos

| Modo | Vídeo | Áudio | Controles | O que falta |
| --- | --- | --- | --- | --- |
| **BX Native PS4 → iPhone** | Não integrado | Não integrado | Diagnóstico de porta apenas | Implementar cliente de protocolo Remote Play e ponte compatível com Safari; o navegador não abre conexões TCP/UDP arbitrárias |
| **PS4 → Android Gateway → iPhone** | Não integrado | Não integrado | Protocolo WebRTC de comandos preparado, sem receptor Android | Cliente Remote Play autenticado no Android, saída de mídia e aplicação dos comandos, permissões explícitas, segurança térmica |
| **PS4 → app externo iPhone** | Depende do cliente externo | Depende do cliente externo | Depende do cliente externo | Testar registro e compatibilidade do PS4 GoldHEN; o jogo não aparece no BX |
| **PS4 → Chiaki Mac → BX iPhone** | WebRTC pela captura consentida do Mac | WebRTC, se o navegador permitir áudio da janela | **iPhone → navegador Mac com ACK**; sem injeção no jogo | Adaptador local autorizado para injetar comandos no Chiaki e testes de interoperabilidade |

## Protocolo dos botões

```json
{"v":1,"type":"input","seq":1,"buttons":[0,7],"axes":[0.4,0,0,0],"triggers":[0,1]}
```

Os botões seguem índices 0–17 do módulo `controller-core.js`, com quatro eixos de -1 a 1 e dois gatilhos de 0 a 1. A resposta do receptor é `{"v":1,"type":"ack","seq":1}`. Quadros maiores que 512 caracteres, repetidos, malformados ou fora dos limites são ignorados. O canal é não ordenado e sem retransmissões para evitar atraso por pacotes antigos. O receptor não executa comandos arbitrários, scripts, operações de sistema ou acesso a portas.

## Próximos incrementos necessários

1. **Comprovar os dois lados em hardware:** Mac com Chiaki, Safari no iPhone, vídeo H.264 e áudio audível, ACK real de botões e retorno automático ao neutro em perda de rede.
2. **Adaptador de controle para o Remote Play:** o recebimento de estados no navegador do Mac não interage com a aplicação Chiaki. É preciso criar e autorizar um destino nativo de comandos com autenticação de sessão, limites de taxa e comportamento de falha seguro.
3. **Android de baixa memória:** acrescentar cliente de protocolo Remote Play e ligação de mídia real ao gateway. O APK diagnóstico v0.3 não solicita rede nem captura; não declarar streaming antes de integrar explicitamente permissões e codecs e validar compatibilidade.
4. **PS4 independente:** desenvolver ponte nativa protocolar e transporte binário apropriado, sem abrir serviços GoldHEN/FTP ao público. Manter PKG PS4 v0.22 intacto até existir teste de hardware seguro.
5. **Medição real de mídia:** taxa de quadros, áudio decodificado, perda de pacotes e tempo de reconexão de cada modo. Não confundir dados simulados/ACK com latência do PS4.

## Segurança e privacidade

Não compartilhe PIN de Remote Play, credenciais PSN, códigos secretos da sala P2P ou tokens do Worker. Para conexão pela internet, um túnel WebRTC pode precisar de TURN; STUN sozinho não garante conexão em redes diferentes. Não exponha FTP, binloader, payload ou portas internas do PS4 na internet.
