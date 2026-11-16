# BX-REMOTE-PLAY — primeira prova de IMAGEM REAL com P2P entre navegadores

**Versão piloto:** site 0.13. Não é vídeo direto do PKG, não é Remote Play implementado pelo BX, nem controle do PS4. A entrega temporária usa **um Mac com Chiaki funcionando** como fonte visual e o **iPhone com BX aberto** como receptor. Enquanto essa etapa é testada, o Mac precisa permanecer ligado. Nosso objetivo final de funcionar somente com o PS4 permanece pendente.

## Como testar sem inventar quadros de vídeo

1. Conecte Mac e PS4 na mesma rede Wi-Fi/LAN. Abra o [Chiaki-NG](https://chiaki-ng.github.io/chiaki-ng/setup/installation/) no Mac, registre seu PS4 pelo procedimento local e **confirme primeiro que o Chiaki já mostra a imagem e toca o áudio do jogo**. Não cole códigos de PSN, dados de conta ou PINs no BX/GitHub.
2. Abra a página oficial **[Transmitir janela do Chiaki](https://ct7-bx.github.io/BX-REMOTE-PLAY/remote/bridge.html)** no Chrome/Edge do Mac. Clique **Compartilhar janela**. O navegador exige autorização explícita de captura. Escolha somente a janela/aba do Chiaki; **não compartilhe sua área de trabalho inteira**.
3. O navegador solicita uma sala efêmera HTTPS no Worker `bx-remote-link`, com um código privado aleatório de 64 caracteres. Esse código concede acesso temporário ao fluxo e **não deve ser publicado**; não é o código de 8 dígitos de pareamento do PKG nem um PIN de Remote Play.
4. Copie o código de um dispositivo para o outro por um canal privado (por exemplo, área de transferência entre os seus dispositivos).
5. No Safari do iPhone, abra a página oficial **[Player BX](https://ct7-bx.github.io/BX-REMOTE-PLAY/remote/)**, encontre **Receber imagem do Mac — teste P2P real**, cole o código e toque **Receber imagem**. Espere os navegadores negociarem WebRTC. Em redes iguais, eles podem se conectar diretamente. A mídia é um `MediaStream` real anexado ao player; o site não inventa vídeo ou áudio.
6. Se existir trilha de áudio, toque **Ativar áudio** no iPhone (gesto exigido pelo Safari). Dependendo do Chrome/macOS e da fonte selecionada, o navegador **pode não fornecer áudio**. Capturar uma aba Chrome com áudio costuma ser mais viável do que capturar a janela de outro aplicativo; não há garantia.
7. Pare a transmissão no Mac quando terminar. O navegador interrompe as trilhas locais de captura e fecha a conexão P2P.

## Como o teste funciona

```text
PS4  ──Remote Play nativo──>  Chiaki no Mac
                                    │
                              janela/aba selecionada
                                    │ autorização explícita getDisplayMedia
                              navegador do Mac
                                    │ WebRTC E2E (vídeo e áudio disponíveis)
                         ┌──────────┴──────────┐
                         │  sinalização SDP    │
                         │  Cloudflare Worker  │
                         │ (somente metadados) │
                         └──────────┬──────────┘
                                    │
                           Safari do iPhone
                         BX-REMOTE-PLAY player
```

O Worker existente com Durable Object é reutilizado apenas para a **negociação SDP**: `POST /v1/media/offer`, `GET /v1/media/offer`, `POST /v1/media/answer`, `GET /v1/media/answer`, `POST /v1/media/close`. Um código de 256 bits é guardado **somente como SHA-256** no DO. O texto SDP pode incluir endereços de rede locais, por isso é temporário, não é exposto publicamente nem incluído em logs. Uma sala ativa por vez, janela de ingresso de três minutos, rejeição de novas sessões e rate limit. As chamadas são somente HTTPS com Origin `https://ct7-bx.github.io`, sem tokens em URLs, sem credenciais PSN, sem gravação de frames, sem exposição de FTP/GoldHEN.

A mídia vai diretamente de um navegador ao outro usando criptografia DTLS-SRTP. O serviço de sinalização **não** encaminha mídia e **não** remove limitações de NAT/CGNAT. A configuração STUN pública ajuda a descobrir caminhos diretos, mas **não há servidor TURN**. Em redes diferentes a conexão pode falhar; tente inicialmente na mesma rede Wi-Fi. O código expira após três minutos **para ingresso**, mas uma sessão já estabelecida continua até alguém fechá-la.

## Limites e próximo desenvolvimento

- O PKG v0.19 permanece **inalterado**. Seu menu nativo já foi confirmado no hardware, mas o payload ELF não captura imagens ou áudio. Não há instalação de novo PKG para este teste.
- O player do BX consegue reproduzir os tracks reais enviados pelo Mac. Não permite controle de jogos no Chiaki ou no PS4: seus botões ainda são uma interface separada.
- Para não depender do Mac em casa, precisamos implementar de verdade um transporte que conecte o Remote Play ao navegador a partir do PS4, ou um gateway de longa duração que consiga alcançar o console. Isso não se resolve simplesmente com um Worker ou com o painel gráfico do PKG.
- A fonte foi selecionada pelo usuário por um gesto explícito e sua execução física precisa ser testada em Chrome/macOS e Safari/iOS. Os testes automatizados validam estados, sinalização e limpeza, **não provam quadros vindos do PS4**.
- Não divulgue o código de sala; quem tiver o código durante sua validade pode tentar visualizar a janela escolhida. Evite capturar notificações ou dados pessoais.
- Não deixe o navegador transmitindo sem supervisão. Use Parar para interromper a sessão.

## Se não aparecer imagem

1. Confira se a imagem do jogo realmente aparece **no Chiaki no Mac**, antes de compartilhar.
2. Confira se o navegador recebeu permissão para capturar a janela/aba correta.
3. Se o Worker mostrar HTTP 404, **a rota de sinalização ainda não foi implantada**; publicar apenas o site não a ativa.
4. Se o código não funcionar, o ingresso pode ter expirado ou já ter sido usado; pare a transmissão e gere outro.
5. Se ambos se vinculam mas não há vídeo, pode ser falha ICE/DTLS. Teste mesma rede Wi-Fi, sem VPN e com firewall que permita conexão entre seus próprios dispositivos. Não exponha portas do GoldHEN ou FTP à internet.
6. Se existe imagem mas não som, confira a disponibilidade de áudio no compartilhamento de janela do navegador; é comum a fonte não trazer áudio em macOS.
