# BX Android Gateway — diagnóstico experimental v0.4

Este subprojeto Android nativo é o **primeiro teste de compatibilidade para aparelhos antigos**, preparado para Android 7 (API 24) ou superior. **Não é ainda um cliente Remote Play, um gateway WebRTC, nem um aplicativo que transmita jogos.** O BX atual continua sem o transporte PS4 → Android → iPhone.

## Interface v0.4 — três áreas nativas

O aplicativo apresenta três cartões: **Diagnóstico local**, **Central BX** e **Segurança e limites**. A análise usa um indicador de prontidão com descrição conservadora, separa os dados técnicos numa área de texto selecionável, permite copiar o relatório apenas após o usuário iniciar a verificação e mantém o resultado ao girar a tela. O esquema preto/vermelho usa componentes Android nativos e usa somente a permissão normal INTERNET para uma verificação HTTPS iniciada manualmente.

A nova interface não torna o APK um cliente Remote Play. A temperatura medida é uma leitura pontual, não um monitor automático de segurança para uso por 24 horas.

## Novo painel e conexão v0.4

A abertura tem cabeçalho gradiente, três cartões com ações de diagnóstico, conectividade e central BX. O teste HTTPS roda fora da thread de interface, tem tamanho máximo de resposta, bloqueia múltiplas tentativas simultâneas e cancela o resultado quando a tela é destruída. A falha de conexão não impede o relatório local; um servidor público disponível não comprova conexão com o PS4. O app não mantém conexões permanentemente nem representa uma sessão real Remote Play.

## O que a versão faz

- Exibe Android e modelo localmente, RAM aproximada e sinalização de baixa memória.
- Conta codecs H.264/AVC disponíveis; em Android 10+ consulta o que o fabricante declara como aceleração por hardware.
- Mostra RAM livre e pressão de memória no momento, nível e temperatura informada da bateria e, no Android 10+, estado térmico. As medições são **pontuais**, não um monitor que garante operação segura 24h.
- Preserva o relatório ao girar a tela, sem salvar arquivos, e só permite copiá-lo depois que a análise terminar.
- Identifica existência da API MediaProjection, mas **não pede permissão de gravação** nem inicia captura.
- Distingue a API de captura de áudio Android 10+ da compatibilidade real com outro aplicativo — alguns apps proíbem sua captura.
- Abre a página de compatibilidade do BX e copia um relatório local **apenas após ação explícita do usuário**.

O aplicativo declara somente `android.permission.INTERNET` para o botão **Testar conexão HTTPS**: faz um GET ao endpoint público `https://bx-remote-link.4rt949zpj8.workers.dev/health`, sem PIN, token, dados do dispositivo ou credenciais PSN, com limites de 5 segundos de conexão/leitura. A consulta pode ser vista pelo servidor como qualquer acesso HTTP (por exemplo, IP público). Não há rastreamento contínuo nem verificação de sessão de jogo. O relatório de hardware continua local e só sai do aparelho se você copiá-lo. Não há `RECORD_AUDIO`, câmera, captura de tela ou acesso FTP.

## Instalação e teste

A versão APK experimental é compilada pela workflow [BX Android Gateway — diagnóstico experimental](../.github/workflows/android-gateway-build.yml). Abra a execução concluída com sucesso, baixe o artefato `BX-Android-Gateway-Diagnostic-v0.4` e confira seu SHA-256. O APK contido é **debug**; não há distribuição estável nem função de Remote Play neste estágio.

O botão **Analisar dispositivo** mostra os dados localmente. Use **Copiar relatório local** se quiser compartilhá-los de forma voluntária, revisando antes o modelo do celular incluído no texto.

## Desenvolvimento

Android Gradle Plugin 8.7.3, Gradle 8.9, Java 17, compileSdk 35, minSdk 24. Sem dependências externas para streaming.

Com Android SDK e Gradle instalados:

```bash
gradle --project-dir android-gateway :app:assembleDebug
```

A compilação em CI valida apenas compilação e estrutura do APK. O desempenho real, permissões de tela e funcionamento em aparelhos Android 7–9 **não foram testados fisicamente**.

## Futuro Gateway

1. Testar no aparelho as limitações reais de memória, codecs, rede e reprodução do Remote Play.
2. Implementar uma sessão Remote Play autenticada capaz de acessar o PS4 — **capturar a tela de outro app isoladamente não resolve o encaminhamento dos controles para o jogo**.
3. Adicionar MediaProjection com autorização do dono, tratamento de revogação e foreground service de acordo com a versão Android; incluir captura de áudio somente quando o sistema e o app fonte a permitirem.
4. Integrar as trilhas reais a WebRTC, autenticação e retorno dos comandos, testes no iPhone, bitrate adaptativo, reconexão e parada segura.
5. Testar aquecimento, bateria e desligamento automático; não recomendar transmissão contínua 24h em aparelho antigo sem supervisionar condições de energia e temperatura.

A opção alternativa de **BX Native PS4 → iPhone** permanece um projeto paralelo.
