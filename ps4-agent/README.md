# BX-REMOTE-PLAY — PKG de diagnóstico v0.20

## Estado: código de diagnóstico aprimorado; validação física ainda pendente

Nesta primeira entrega, o programa para PS4 faz **uma consulta HTTPS de saída** ao arquivo público
[`remote/ps4-probe.txt`](../remote/ps4-probe.txt) do mesmo projeto e verifica o conteúdo recebido.

O objetivo do teste é confirmar se um aplicativo homebrew do console consegue
chegar ao domínio publicado no GitHub Pages, **sem criar servidor, abrir portas
no roteador ou depender de um computador ligado em casa**.

**O programa ainda não transmite jogos, não captura imagem/áudio,
não injeta comandos, não faz pareamento, não roda como serviço em segundo plano e
não oferece Remote Play.** O PKG anterior v0.10 foi gerado com validação de hashes no CI. A versão v0.20 adiciona notificação de resultado e verificações extras de recursos do pacote; **instalação e execução no PS4 real ainda precisam de teste**.

### Pacote experimental do GitHub Actions

Na página [Build PS4 Probe](https://github.com/CT7-BX/BX-REMOTE-PLAY/actions/workflows/ps4-build.yml), abra uma execução concluída e consulte **Artifacts**. O item `bx-remote-play-ps4-probe-pkg-untested` contém o PKG de diagnóstico e o arquivo SHA-256. Artefatos podem expirar após sete dias.

**Não é o futuro aplicativo de jogo remoto**: este pacote fecha depois de uma única consulta HTTPS, sem imagem, áudio ou controle remoto. A validação do `pkg_validate` verifica integridade do pacote; não testa compatibilidade com o console.

### Operação prevista

- Executar o aplicativo uma vez no PS4 com homebrew habilitado.
- O programa inicializa rede, SSL e HTTP, faz **GET HTTPS** com verificação TLS padrão,
  lê o marcador de resposta (limite de 128 bytes) e encerra os recursos.
- Tenta exibir uma notificação do sistema com **HTTPS OK** ou o estágio/código de falha, via SysUtil do OpenOrbis. **A aparição da notificação ainda não foi confirmada no console físico**.
- Salva um diagnóstico textual em `/data/bx-remote-play-probe.txt`:
  `stage`, `result`, `error`, `error_hex`, `http_status`, `body_bytes`.
- `result=OK` significa **somente** que o aplicativo recebeu resposta HTTP 200
  com o marcador exato. Não comprova Remote Play, latência ou áudio/vídeo.
- Se não conseguir gravar o arquivo, a aplicação tenta escrever o diagnóstico
  em `stdout`; isso não garante que o console mostre uma tela visual. A notificação também é experimental.
- A mensagem `streaming=NOT_IMPLEMENTED` é intencional.

**Privacidade:** não lê PSN, identificadores de hardware, senhas, conteúdo de jogos
nem dados do controle. Faz apenas uma requisição GET pública ao arquivo do
próprio site. Não fornece porta de entrada e não expõe FTP, GoldHEN ou APIs locais.

### Dependências

- Ambiente de desenvolvimento OpenOrbis PS4 Toolchain com headers, bibliotecas,
  `clang`, `ld.lld`, `create-fself` e, para empacotamento, `PkgTool.Core`.
- `OO_PS4_TOOLCHAIN` apontando para a instalação **local** do SDK.
- Caso deseje gerar um PKG de teste, é necessário fornecer os ativos do projeto
  `sce_sys/icon0.png`, `sce_sys/about/right.sprx` e módulos
  `sce_module/libSceFios2.prx`, `sce_module/libc.prx` compatíveis com o SDK,
  obtidos legitimamente pelo próprio desenvolvedor. **Nenhum desses binários
  é incluído aqui**.
- Não copiar do console ou publicar arquivos privados do SDK de terceiros.

### Compilação (ambiente com OpenOrbis instalado)

```sh
cd ps4-agent
export OO_PS4_TOOLCHAIN=/caminho/para/openorbis
make eboot
# Resultado esperado apenas quando a toolchain estiver funcionando: eboot.bin
```

Se os ativos e as ferramentas de empacotamento estiverem disponíveis:

```sh
make pkg
# Pacote previsto: IV0000-BRPT00001_00-BXREMOTEPLAY0001.pkg
```

A receita segue a estrutura do exemplo `samples/net_http` da OpenOrbis.
O CI já compilou `eboot.bin`, gerou o PKG com OpenOrbis v0.5.4 e passou na
checagem de hashes com `PkgTool.Core pkg_validate`. **Isso não comprova que o
PKG instala ou executa no PS4.** O firmware/GoldHEN específico precisa de
verificação física. Nenhum PKG gerado por este Makefile foi testado no console
nesta conversa.

### Testes independentes do PS4

Com um compilador C no computador:

```sh
cc -std=c11 -Wall -Wextra -Werror -pedantic \
  ps4-agent/probe_contract.c ps4-agent/tests/probe_contract_test.c \
  -o /tmp/bx-ps4-probe-test
/tmp/bx-ps4-probe-test remote/ps4-probe.txt
```

Esse teste valida apenas o marcador de protocolo, não a execução do homebrew.

### Limitações a resolver

1. **Executar no console:** confirmar headers, link, assets, inicialização de rede
   e gravação de diagnóstico; ajustar de acordo com resultado real.
2. **Agente persistente:** estudar um serviço seguro que funcione com jogos em
   primeiro plano. Um aplicativo que fecha após um GET não resolve isso.
3. **Pareamento:** autenticação vinculada ao dono, aprovação no PS4 e tokens
   revogáveis, sem chave fixa distribuída no site ou PKG público.
4. **Mídia e comandos:** integrar ou compatibilizar o protocolo nativo Remote
   Play do PS4, ou implementar caminho demonstravelmente válido para captura,
   codificação e recepção de entrada. Não presumir que as APIs públicas
   de captura existam no OpenOrbis.
5. **Internet:** conexão autenticada de saída para backend/relay; GitHub Pages
   sozinho não pode fornecer servidores de sessão nem atravessar CGNAT.
6. **Teste real:** imagem, áudio e DualShock 4 em redes diferentes, medição de
   latência e reconexão, começando em rede local.

### Referências

- OpenOrbis PS4 Toolchain: https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain
- Exemplo de HTTP/HTTPS (OpenOrbis): https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain/tree/master/samples/net_http
- Recursos documentados do GoldHEN: https://github.com/GoldHEN/GoldHEN

O código desta pasta é original; não incorpora código nem bibliotecas
terceirizadas ao repositório.

## O que mudou na v0.20

- Notificação de conclusão ou erro `sceSysUtilSendSystemNotificationWithText(222, ...)`, com código e estágio, sem PSN, serial ou dados privados.
- Conferência dos retornos de configuração dos timeouts da API HTTP (antes ignorados).
- Registro do erro em decimal e hexadecimal, útil para diagnosticar problemas TLS, DNS e rede.
- Ícone BX original gerado no CI como PNG **512x512, RGB 24-bit sem alpha**, seguindo a exigência de empacotamento do OpenOrbis. O pacote anterior usava um ícone genérico da ferramenta.
- Metadados `APP_VER` e `VERSION` alinhados em `0.20`, mantendo `TITLE_ID BRPT00001` e `CONTENT_ID IV0000-BRPT00001_00-BXREMOTEPLAY0001` para permitir atualização da mesma aplicação.
- Validação do ícone, `param.sfo`, ID, título, versão, conteúdo e hash do PKG antes de disponibilizar o artefato.

### Como verificar a instalação no PS4

1. Use somente o **artefato de uma execução bem-sucedida** do workflow [Build PS4 Probe](https://github.com/CT7-BX/BX-REMOTE-PLAY/actions/workflows/ps4-build.yml); não confunda `eboot.bin` com PKG instalável.
2. Com o PS4 já configurado para executar homebrew, instale o PKG v0.20 como atualização do mesmo aplicativo, usando o procedimento de instalação de PKGs do seu console.
3. Ao abrir **BX Remote Play - Network Test**, o aplicativo faz um GET público e termina. A notificação pode mostrar `HTTPS OK` ou `falha <stage>, erro <código>, HTTP <status>`.
4. Verifique `/data/bx-remote-play-probe.txt`. Um resultado `OK` indica **apenas conectividade HTTPS com o site**, não vídeo/áudio.
5. Se aparecer erro ou o aplicativo fechar sem notificação, registre a **mensagem de erro que o PS4 mostrar** e os campos `stage`, `error_hex`, `http_status` do arquivo, caso ele exista. Não envie senhas, identificadores de conta ou dados privados.

Se o pacote apresentar falha de instalação, é preciso testar o arquivo exato no console e inspecionar o erro; **passar em `PkgTool.Core pkg_validate` não garante instalação nem abertura no firmware/GoldHEN atual**. O programa não ativa automaticamente um serviço, não mexe em AutoRun e não abre portas na rede.

### Fontes de empacotamento

- [OpenOrbis — Building Homebrew](https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain/blob/master/docs/MD/Building%20Homebrew.md)
- [OpenOrbis — SysUtil.h](https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain/blob/master/include/orbis/SysUtil.h)
