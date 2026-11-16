# BX Android Gateway — diagnóstico experimental v0.1

Este subprojeto Android nativo é o **primeiro teste de compatibilidade para aparelhos antigos**, preparado para Android 7 (API 24) ou superior. **Não é ainda um cliente Remote Play, um gateway WebRTC, nem um aplicativo que transmita jogos.** O BX atual continua sem o transporte PS4 → Android → iPhone.

## O que a versão faz

- Exibe Android e modelo localmente, RAM aproximada e sinalização de baixa memória.
- Conta codecs H.264/AVC disponíveis; em Android 10+ consulta o que o fabricante declara como aceleração por hardware.
- Identifica existência da API MediaProjection, mas **não pede permissão de gravação** nem inicia captura.
- Distingue a API de captura de áudio Android 10+ da compatibilidade real com outro aplicativo — alguns apps proíbem sua captura.
- Abre a página de compatibilidade do BX e copia um relatório local **apenas após ação explícita do usuário**.

O aplicativo **não pede nenhuma permissão**, não contém `INTERNET` ou `RECORD_AUDIO`, não usa dados PSN, não acessa FTP, não roda em segundo plano e não envia informações ao GitHub ou à Cloudflare.

## Instalação e teste

A versão APK experimental é compilada pela workflow [BX Android Gateway — diagnóstico experimental](../.github/workflows/android-gateway-build.yml). Abra a execução concluída com sucesso, baixe o artefato `BX-Android-Gateway-Diagnostic-v0.1` e confira seu SHA-256. O APK contido é **debug**; não há distribuição estável nem função de Remote Play neste estágio.

O botão **Analisar aparelho** mostra os dados localmente. Use **Copiar relatório local** se quiser compartilhá-los de forma voluntária, revisando antes o modelo do celular incluído no texto.

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
