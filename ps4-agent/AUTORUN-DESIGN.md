# BX-REMOTE-PLAY — início automático após GoldHEN

**Situação atual: planejamento. Nenhum payload residente foi gerado ou instalado.** O PKG existente é apenas o teste HTTPS de execução única.

## Por que payload e não plugin de jogo?

O Control4Free é uma referência pública de um serviço residente. A documentação explica que o GoldHEN recente possui **Payloader LaunchPad / AutoRun** para carregar um arquivo ELF depois de ativar o HEN. Plugins tradicionais são injetados em processos de jogos e não servem bem para operar na Home, no login e durante a troca de jogos.

Fontes: [instalação e AutoRun](https://github.com/MoHadiShibli/Control4Free/blob/main/docs/installation.md); [por que um payload](https://github.com/MoHadiShibli/Control4Free/blob/main/docs/how-it-works.md).

## Design proposto (sem executar no console)

1. Produzir um ELF residente do BX-REMOTE-PLAY, independente do PKG de diagnóstico.
2. Iniciar **uma única instância** depois do HEN; aguardar a rede sem bloquear a interface do console.
3. Exigir pareamento local, confirmação do dono e token revogável antes de qualquer controle remoto.
4. Conectar somente **de saída** a um endpoint autenticado por TLS, com reconexão progressiva, sem abrir porta pública de FTP, GoldHEN ou payload.
5. Oferecer botão explícito de ativar/desativar AutoRun e mecanismo de desligamento, desligado por padrão.
6. Testar com jogos em primeiro plano, repouso e reconexão antes de integrar à inicialização.

### Formato de referência do AutoRun — NÃO aplicar agora

O GoldHEN mantém a fila em /data/GoldHEN/payloads.ini. Exemplo puramente documental do formato:

    [AutoRun]
    /user/data/payloads/bx_remote_play.elf = 1

**Esse ELF ainda não existe. Não adicione essa entrada ao PS4.** Uma referência inexistente ou um serviço não validado pode causar erro. O AutoRun só opera depois que o HEN estiver ativo; ele não desbloqueia o console.

## Componente já codificado

O módulo resident/lifecycle.c é uma **máquina de estados portátil**, sem chamada a rede, kernel, SDK ou GoldHEN. Implementa início idempotente, reconexão entre 1 e 60 segundos e parada explícita. É testado no CI, mas **ainda não foi integrado a um ELF residente PS4**.

Antes de instalar qualquer versão: verificar compatibilidade do GoldHEN e firmware, executar ensaio físico de inicialização e parada, garantir revogação de acesso, limite de logs e uma forma de desabilitar serviço sem o navegador.
