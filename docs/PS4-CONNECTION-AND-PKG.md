# BX-REMOTE-PLAY — ligação com PS4 e arquitetura do PKG

Atualização: 15/11/2026. Este documento descreve a **implementação-alvo** e os testes que podemos executar sem fingir que o console já foi conectado.

## Resultado da pesquisa

- **Vídeo e áudio:** aproveitar o serviço nativo de Remote Play do PS4 é mais viável do que criar um capturador e codificador independente. O [Chiaki-NG-Web](https://github.com/CSystem77/Chiaki-NG-Web) já executa uma parte do cliente em WebAssembly, mas depende de um proxy Node capaz de alcançar as portas TCP/UDP do console. O seu front-end usa AGPL-3.0; qualquer integração precisa preservar suas obrigações.
- **Controles:** a referência [Control4Free](https://github.com/MoHadiShibli/Control4Free) mostra um payload GoldHEN residente e um PKG de gerenciamento. Ele controla o console, mas **não transmite vídeo**. A organização dos botões no site foi inspirada no PS Remote Play oficial, sem reutilizar imagens ou código de terceiros.
- **AutoRun:** em versões recentes do GoldHEN, o gerenciador de payloads pode iniciar um ELF após a ativação do HEN. A compatibilidade depende da versão exata do GoldHEN e firmware; não presumimos que a implementação de referência já funciona no nosso console.
- **Internet externa:** o Chiaki-NG-Web não oferece automaticamente PSN hole-punching no navegador. Mesmo que o iPhone esteja conectado a 5G, um servidor com acesso a uma conexão segura ao PS4 é obrigatório. **O GitHub Pages não oferece esse serviço**.

## Fluxo pretendido

### Mesma rede Wi-Fi/LAN

1. Ativar as opções de Remote Play no PS4 que estiverem disponíveis; confirmar conectividade de rede.
2. Usar o IP privado do PS4 para diagnosticar **somente TCP 9295**, com `relay/tools/ps4-lan-probe.mjs`, executado em um computador temporariamente na LAN. Um resultado acessível só verifica abertura TCP, **não** a identidade do console, registro, vídeo ou comandos.
3. Confirmar pareamento de Remote Play em um cliente compatível, localmente, antes de integrar à interface BX-REMOTE-PLAY. O menu do PS4 normalmente usa *Configurações > Configurações de conexão do Uso remoto > Adicionar dispositivo*; códigos de pareamento e identificadores de conta **nunca** devem ir para o GitHub ou logs públicos.
4. Integrar o componente de vídeo/áudio do protocolo nativo ao navegador e verificar latência de ponta a ponta.

### Outra rede / 5G / CGNAT

1. O **serviço residente PS4** abre uma conexão **de saída**, cifrada e autenticada, para um gateway externo. Não é necessário publicar diretamente FTP/GoldHEN.
2. O iPhone/Mac se autentica no mesmo gateway por HTTPS; o gateway faz o transporte dos fluxos de Remote Play TCP/UDP ou mídia interoperável.
3. Priorizar rota direta quando as duas pontas tiverem conectividade confiável; usar relay quando exigido. CGNAT não desaparece com site estático.
4. Medir perda de pacotes, jitter, codificação e latência real. O RTT atual do laboratório é só navegador ↔ relay.

### Arquitetura desejada

```text
iPhone / MacBook
  ├─ Browser BX-REMOTE-PLAY (vídeo, som, controles físicos ou virtuais)
  └─ sessão autenticada HTTPS/WSS/WebRTC
                  |
             Gateway remoto
          sinalização + mídia
                  |
         conexão PS4 iniciada de saída
                  |
           Payload residente
        (ativado após GoldHEN)
                  |
        Remote Play nativo PS4
```

## Plano do PKG

O PKG atualmente disponível é um **diagnóstico HTTPS de execução única**; foi compilado e validado estruturalmente em CI, não testado no hardware. O futuro PKG será um *gerenciador*, não um substituto do Remote Play nativo.

| Componente | Função | Situação |
|---|---|---|
| `eboot.bin` do PKG | Interface local: status, emparelhamento e iniciar/parar serviço | Não implementado |
| `bx_remote_agent.elf` | Serviço residente em segundo plano após HEN | Modelo de ciclo de vida em C; sem ELF residente funcional |
| Gestão AutoRun GoldHEN | Ativar/desativar início automático, somente mediante escolha do dono | Projeto documentado, não ativado |
| Autenticação | Código de vinculação de curta duração, confirmação no PS4, revogação | Não implementado |
| Transporte de mídia | Encaminhamento UDP/TCP ou gateway WebRTC com Remote Play | Não implementado |
| Geração de PKG | OpenOrbis, artefatos auditáveis, hash SHA-256 | Funciona apenas para PKG de diagnóstico |

**Ordem de entrega com critérios de aceite:**

1. **Prova LAN:** comprovar que a porta de Remote Play está acessível, o cliente registra e vídeo/áudio funcionam em um teste real.
2. **Serviço PS4 mínimo:** criar ELF residente seguro que se conecte e responda a um servidor de testes, sem acesso a vídeo. Validar início, parada, reconexão e comportamento com jogo aberto. **Não habilitar AutoRun antes disso**.
3. **PKG gerenciador:** encapsular ELF validado, exibir sessão, QR de pareamento e opção explícita para AutoRun com remoção segura.
4. **Gateway de mídia:** integrar Chiaki/WebAssembly ou solução interoperável; nunca expor diretamente a porta de payload ou FTP.
5. **Internet externa:** primeiro outra rede comum; depois CGNAT, com TLS, tokens por dispositivo, revogação e medições reais de desempenho.

## Limitações e segurança

- O projeto **não exige outro computador ligado em casa** como objetivo final. A rede local pode precisar de um computador **temporariamente** para a fase de diagnóstico.
- Não oferecer controle remoto aberto sem pareamento e autenticação, nem salvar tokens de console no HTML público.
- Não copiar códigos de terceiros sem verificação de autoria e licenças (Chiaki-NG-Web AGPL-3.0; Control4Free GPLv3).
- Não afirmar suporte para firmware não testado, que toda rede permita conexão externa ou que um PKG estruturalmente válido já funcione no console.
- Alguns perfis de vídeo, como 1080p/60, podem não existir em todos os modelos de PS4.

## Referências

- [Documentação oficial PS Remote Play para PS4](https://remoteplay.dl.playstation.net/remoteplay/lang/en/1100009.html)
- [Chiaki-ng: registro manual e PIN no PS4](https://chiaki-ng.github.io/chiaki-ng/setup/configuration/)
- [Chiaki-NG-Web: WASM e proxy Node](https://github.com/CSystem77/Chiaki-NG-Web)
- [Control4Free: instalação, PKG e AutoRun](https://github.com/MoHadiShibli/Control4Free/blob/main/docs/installation.md)
- [OpenOrbis: exemplo de HTTP e empacotamento](https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain/blob/master/samples/net_http/README.md)
