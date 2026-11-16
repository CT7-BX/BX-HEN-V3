# BX-REMOTE-PLAY — teste real de vídeo e áudio do PS4

**Estado (16/11/2026):** menu nativo do PKG v0.19 confirmado pelo usuário em PS4 físico. A aprovação de vínculo BX por HTTPS **não é** uma sessão Remote Play. O ELF residente existente só transmite heartbeats e **não** transporta imagem, som ou botões.

## Objetivo da primeira prova

Comprovar que a implementação de Remote Play do próprio PS4 fornece **vídeo de jogo em movimento e áudio audível**, enquanto o PKG BX está fechado. Usar um cliente Remote Play existente, antes de tentar adaptar o fluxo ao navegador BX. Não gerar imagens falsas, nem classificar um WebSocket ou código de pareamento como stream.

### Teste A — Mac/computador e PS4 na mesma rede (mais verificável)

1. Feche o PKG BX pelo menu do botão PS. Deixe o GoldHEN ativo, se estiver usando seus recursos, e o PS4 ligado.
2. No PS4, entre em **Configurações > Configurações de conexão do Uso remoto** e habilite o Uso remoto. Verifique o recurso **Remote Play Enabler** do GoldHEN somente se necessário e disponível no seu firmware.
3. Abra **Adicionar dispositivo** no mesmo menu do PS4. O código de Remote Play **não é** o código de oito dígitos do vínculo HTTPS BX.
4. No Mac ou computador na mesma rede, use um cliente de Remote Play compatível. Para Mac Apple Silicon com macOS 15 ou posterior, o [Chiaki-NG](https://chiaki-ng.github.io/chiaki-ng/setup/installation/) oferece aplicativo nativo. A documentação oficial mostra o comando `brew install --cask streetpea/streetpea/chiaki-ng`, mas pode-se baixar o pacote diretamente dos [releases oficiais do Chiaki-NG](https://github.com/chiaki-ng/chiaki-ng/releases). Consulte a [configuração/registro do console](https://chiaki-ng.github.io/chiaki-ng/setup/configuration/). Outras plataformas podem usar as opções disponíveis no mesmo guia.
5. Registre o PS4 usando o PIN temporário exibido na TV e os dados de conta exigidos pelo **cliente instalado localmente**. Não insira PINs, chaves, tokens, IDs de conta nem IP privado em issues, capturas de tela, GitHub Pages ou no chat.
6. Inicie um jogo no PS4 **com o PKG BX fechado**. No cliente, confira movimento contínuo, áudio realmente audível e atraso de resposta. Depois desconecte normalmente.

**Critérios de aprovação:** vídeo não congelado, áudio reproduzido pelo cliente, sessão mantida enquanto um jogo está aberto e encerramento sem travar o PS4. Se faltar vídeo, anote somente a mensagem de erro genérica; se faltar áudio, confira volume, saída de som e configuração do cliente. Nunca cole credenciais.

### Teste B — Chiaki-NG-Web no próprio navegador

O projeto [Chiaki-NG-Web](https://github.com/CSystem77/Chiaki-NG-Web) traz WebAssembly (decodificação H.264/H.265), AudioWorklet, controles e proxy Node. Para testar na rede local, o **proxy precisa estar em uma máquina que alcance o PS4 por TCP/UDP**. O site público do projeto não consegue se conectar automaticamente a um IP `192.168.x.x` da sua residência; ele não é um substituto para o proxy local.

O projeto requer [dependências e build WASM](https://github.com/CSystem77/Chiaki-NG-Web#build-web-wasm) ou usa sua edição Electron, se disponível na plataforma. Para desktop, o Teste A costuma ser o primeiro passo mais simples. O Chiaki-NG-Web oferece também compartilhamento de sessões via WebRTC, mas isso é **outro cliente**, não o endpoint WHEP do BX. Ao utilizar aplicativos de terceiros, confira sua procedência e use sua própria instância sempre que possível para proteger informações de registro.

### Validação auxiliar sem mídia

Há um diagnóstico por IP privado no repositório:

```sh
cd relay
npm run discover:ps4 -- 192.168.1.20
npm run probe:ps4 -- 192.168.1.20
```

Substitua o IP **somente no seu computador local**. Os resultados indicam descoberta UDP/987 e acessibilidade TCP/9295 — **não** provam autenticação, áudio ou vídeo. Não publique essas portas para a internet e não exponha FTP, GoldHEN ou a porta de payload.

## Teste de receptor no site BX

A página `remote/` possui um receptor **WHEP/WebRTC** que exige URL HTTPS de um gateway de mídia já configurado com uma fonte real. As métricas mostram:
- `videoFramesDecoded`: quadros realmente decodificados pelo navegador;
- `videoBytesReceived`: dados recebidos em RTP para vídeo;
- `audioBytesReceived` e `audioPacketsReceived`: dados RTP de áudio recebidos;
- resolução e pacotes perdidos, quando reportados.

Esses dados vêm de `RTCPeerConnection.getStats()`. Eles **não identificam** a origem como PS4, não garantem som audível e não tornam o Worker de pareamento em servidor WHEP. Os números só aparecem se um gateway válido fornecer tráfego. O site não usa imagem ou áudio simulados.

## Próxima implementação após confirmar mídia real pelo cliente

Criar o componente que conecte uma sessão de Remote Play a uma origem de mídia interoperável para o navegador. Há duas possibilidades técnicas diferentes: integrar um cliente Chiaki compatível com o fluxo do BX (observando AGPL-3.0), ou transformar uma sessão efetiva de Remote Play em publicação WebRTC por um gateway. Ambos precisam de runtime capaz de alcançar o PS4; GitHub Pages sozinho não fornece transporte UDP/9296/9297. O payload `bx-remote-service.elf` ainda não é esse gateway e não se deve anunciar vídeo/áudio no PKG sem prova física.

## Registros seguros a trazer do teste

Informe apenas: (a) se o cliente detectou o console, (b) se conectou, (c) se houve imagem em movimento, (d) se o áudio foi ouvido e (e) a mensagem genérica de erro, caso haja. Evite enviar PINs, tokens, endereços e IDs privados.
