package com.ct7bx.gateway;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.BatteryManager;
import android.os.PowerManager;
import android.media.MediaCodecInfo;
import android.media.MediaCodecList;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.os.SystemClock;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.net.URL;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import javax.net.ssl.SSLHandshakeException;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.Locale;

/**
 * Lightweight, read-only compatibility diagnostic for a future Android gateway.
 *
 * On-demand HTTPS /health request uses INTERNET (normal permission) only.
 * Never sends a device identifier, PSN token, Remote Play key or private data.
 * No background service, screen/audio capture, game streaming or input control.
 * Hardware report remains local unless explicitly copied by the user.
 */
public final class MainActivity extends Activity {
    private static final int RED = Color.rgb(239, 54, 83);
    private static final int BACKGROUND = Color.rgb(11, 12, 17);
    private static final int CARD = Color.rgb(24, 24, 32);
    private static final int WHITE = Color.rgb(247, 244, 246);
    private static final int MUTED = Color.rgb(189, 181, 194);

    private LinearLayout layout;
    private LinearLayout rootLayout;
    private TextView readinessBanner;
    private TextView diagnostics;
    private String report = "";
    private Button copyButton;
    private TextView copyStatus;
    private static final String STATE_REPORT = "bx_diagnostic_report";
    private static final String HEALTH_URL =
        "https://bx-remote-link.4rt949zpj8.workers.dev/health";
    private TextView networkStatus;
    private Button networkButton;
    private volatile boolean checkingNetwork;
    private volatile boolean destroyed;
    private Thread networkThread;
    private volatile HttpURLConnection activeHealthConnection;
    private TextView networkSummary;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BACKGROUND);
        rootLayout = new LinearLayout(this);
        rootLayout.setOrientation(LinearLayout.VERTICAL);
        rootLayout.setPadding(dp(15), dp(16), dp(15), dp(30));
        layout = rootLayout;
        scroll.addView(rootLayout);
        setContentView(scroll);

        LinearLayout hero = new LinearLayout(this);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setPadding(dp(18), dp(20), dp(18), dp(18));
        GradientDrawable heroBackground = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[] {Color.rgb(95, 28, 53), Color.rgb(34, 23, 36),
                Color.rgb(18, 20, 29)});
        heroBackground.setCornerRadius(dp(23));
        heroBackground.setStroke(dp(1), Color.rgb(154, 68, 93));
        hero.setBackground(heroBackground);
        LinearLayout.LayoutParams heroParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        heroParams.bottomMargin = dp(16);
        rootLayout.addView(hero, heroParams);
        layout = hero;
        label("BX   /   MOBILE SYSTEMS", 12, Color.rgb(255, 170, 190),
            Typeface.BOLD, 9);
        label("ANDROID GATEWAY", 29, WHITE, Typeface.BOLD, 8);
        label("Painel de diagnóstico   •   versão 0.5",
            14, Color.rgb(234, 208, 222), Typeface.NORMAL, 18);
        label("Seu Android. Sua rede. Uma futura ponte para o PS4.",
            15, WHITE, Typeface.BOLD, 9);
        label("Testes locais e HTTPS. O gateway de vídeo, áudio e controles " +
            "ainda não está implementado.", 12, Color.rgb(219, 189, 204),
            Typeface.NORMAL, 0);
        layout = rootLayout;

        /* Compact local-only link status; never equate server reachability
           with an active Remote Play session or a PS4 online signal. */
        LinearLayout badges = new LinearLayout(this);
        badges.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        badgeParams.bottomMargin = dp(16);
        rootLayout.addView(badges, badgeParams);
        networkSummary = statusBadge(badges, "HTTPS", "NÃO TESTADO", true);
        statusBadge(badges, "PS4", "NÃO VERIFICADO", false);
        statusBadge(badges, "MÍDIA", "NÃO INTEGRADA", false);

        startCard("01   /   SISTEMA E DESEMPENHO");
        label("Compatibilidade do dispositivo", 19, WHITE, Typeface.BOLD, 10);
        label("Analise memória, H.264, bateria e temperatura. " +
            "Nenhuma captura de vídeo é iniciada.", 13, MUTED, Typeface.NORMAL, 11);
        readinessBanner = label("PRONTO PARA ANALISAR   •   execução local",
            12, Color.rgb(255, 204, 215), Typeface.BOLD, 14);
        readinessBanner.setBackground(roundRect(Color.rgb(66, 34, 47),
            Color.rgb(147, 74, 100), 11));
        readinessBanner.setPadding(dp(12), dp(12), dp(12), dp(12));
        Button inspect = button("Analisar dispositivo", true);
        inspect.setOnClickListener(v -> inspectDevice());
        diagnostics = label("As informações técnicas aparecerão aqui.",
            13, WHITE, Typeface.NORMAL, 13);
        diagnostics.setTextIsSelectable(true);
        diagnostics.setTypeface(Typeface.MONOSPACE);
        diagnostics.setBackground(roundRect(Color.rgb(13, 16, 23),
            Color.rgb(65, 54, 68), 13));
        diagnostics.setPadding(dp(13), dp(14), dp(13), dp(14));
        copyButton = button("Copiar relatório local", false);
        copyButton.setEnabled(false);
        copyStatus = label("", 12, MUTED, Typeface.NORMAL, 2);
        copyButton.setOnClickListener(v -> {
            if (report.isEmpty()) {
                copyStatus.setText("Execute a análise antes de copiar.");
                return;
            }
            ClipboardManager cb = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cb != null) {
                cb.setPrimaryClip(ClipData.newPlainText("BX Gateway compatibility", report));
                copyStatus.setText("Relatório copiado. Revise antes de compartilhar.");
            }
        });
        endCard();

        startCard("02   /   CONECTIVIDADE HTTPS");
        label("Verificar servidor BX", 19, WHITE, Typeface.BOLD, 8);
        label("Teste HTTPS manual com reconexão curta para falhas temporárias. " +
            "Não acessa o PS4, não usa token e não fica monitorando em segundo plano.",
            13, MUTED, Typeface.NORMAL, 12);
        networkStatus = label("NÃO VERIFICADO  •  toque para testar",
            13, Color.rgb(255, 207, 216), Typeface.BOLD, 13);
        networkStatus.setBackground(roundRect(Color.rgb(39, 34, 47),
            Color.rgb(116, 82, 104), 11));
        networkStatus.setPadding(dp(12), dp(12), dp(12), dp(12));
        networkButton = button("Testar conexão HTTPS", true);
        networkButton.setOnClickListener(v -> checkPublicServer());
        endCard();

        startCard("03   /   PRÓXIMOS PASSOS");
        label("Preparar a ponte Android", 19, WHITE, Typeface.BOLD, 8);
        label("Use a central web para acompanhar a integração. " +
            "A resposta do servidor prova apenas alcance HTTPS, não transmissão de jogos.",
            13, MUTED, Typeface.NORMAL, 13);
        Button web = button("Abrir BX Command Center", false);
        web.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://ct7-bx.github.io/BX-REMOTE-PLAY/remote/#bxCommandCenter"));
            try { startActivity(intent); }
            catch (Exception error) {
                copyStatus.setText("Não foi possível abrir o navegador.");
            }
        });
        label("SEGURANÇA   /   leituras pontuais, sem serviço permanente",
            11, RED, Typeface.BOLD, 8);
        label("Não deixe um celular antigo superaquecendo ou carregando sem " +
            "supervisão por períodos prolongados. " +
            "A conexão HTTP de teste é encerrada após cada tentativa.",
            12, MUTED, Typeface.NORMAL, 3);
        endCard();

        if (savedInstanceState != null) {
            String restored = savedInstanceState.getString(STATE_REPORT, "");
            if (!restored.isEmpty()) {
                report = restored;
                diagnostics.setText(report);
                copyButton.setEnabled(true);
                readinessBanner.setText("ANÁLISE LOCAL  •  relatório restaurado");
            }
        }
    }

    private void checkPublicServer() {
        if (checkingNetwork || destroyed) return;
        checkingNetwork = true;
        networkButton.setEnabled(false);
        networkStatus.setText("TESTANDO HTTPS  •  até três tentativas controladas");
        networkSummary.setText("VERIFICANDO");
        networkThread = new Thread(() -> {
            String outcome = "Falha ao verificar o servidor HTTPS.";
            boolean reachable = false;
            long start = SystemClock.elapsedRealtime();
            for (int attempt = 1; attempt <= NetworkResilience.MAX_ATTEMPTS; attempt++) {
                if (destroyed || Thread.currentThread().isInterrupted()) break;
                HttpURLConnection conn = null;
                int statusCode = 0;
                Exception failure = null;
                try {
                    conn = (HttpURLConnection) new URL(HEALTH_URL).openConnection();
                    activeHealthConnection = conn;
                    if (destroyed || Thread.currentThread().isInterrupted()) break;
                    conn.setRequestMethod("GET");
                    conn.setConnectTimeout(4000);
                    conn.setReadTimeout(4000);
                    conn.setUseCaches(false);
                    conn.setInstanceFollowRedirects(false);
                    conn.setRequestProperty("Accept", "application/json");
                    statusCode = conn.getResponseCode();
                    if (statusCode == 200) {
                        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                        try (InputStream input = conn.getInputStream()) {
                            byte[] block = new byte[512];
                            int n;
                            while ((n = input.read(block)) != -1) {
                                if (bytes.size() + n > 4096)
                                    throw new IOException("health response too large");
                                bytes.write(block, 0, n);
                            }
                        }
                        JSONObject json = new JSONObject(bytes.toString("UTF-8"));
                        if ("ok".equals(json.optString("status")) &&
                            "control-prototype".equals(json.optString("mode")) &&
                            json.optBoolean("pairing", false)) {
                            long elapsed = SystemClock.elapsedRealtime() - start;
                            reachable = true;
                            outcome = "SERVIDOR HTTPS RESPONDEU   •   " + elapsed +
                                " ms em " + attempt + " tentativa(s)\n" +
                                (json.optBoolean("configured", false)
                                ? "Serviço público de vínculo configurado."
                                : "Servidor responde, mas vínculo ainda não configurado.") +
                                "\nO PS4 NÃO foi testado.";
                        } else {
                            outcome = "Servidor respondeu com formato desconhecido. PS4 não verificado.";
                        }
                        break;
                    }
                    outcome = "HTTP " + statusCode +
                        ". Verifique a internet e o estado do servidor HTTPS.";
                } catch (SSLHandshakeException error) {
                    outcome = "Falha TLS. Confira data, hora e certificados do Android.";
                    break; // Never hide a TLS/certificate error by retrying.
                } catch (SocketTimeoutException error) {
                    failure = error;
                    outcome = "Tempo esgotado. Verifique o Wi-Fi e o sinal da rede.";
                } catch (IOException error) {
                    failure = error;
                    outcome = "Não foi possível alcançar o servidor HTTPS público.";
                } catch (Exception error) {
                    outcome = "Resposta não reconhecida. Verifique o servidor BX.";
                    break;
                } finally {
                    if (conn != null) conn.disconnect();
                    if (activeHealthConnection == conn) activeHealthConnection = null;
                }
                if (!NetworkResilience.canRetry(attempt, statusCode, failure)) break;
                final int next = attempt + 1;
                runOnUiThread(() -> {
                    if (!destroyed) networkStatus.setText("RECONEXÃO LIMITADA  •  tentativa " +
                        next + " de " + NetworkResilience.MAX_ATTEMPTS);
                });
                try {
                    Thread.sleep(NetworkResilience.delayMs(attempt));
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            final String result = outcome;
            final boolean verified = reachable;
            runOnUiThread(() -> {
                if (destroyed) return;
                checkingNetwork = false;
                networkButton.setEnabled(true);
                networkStatus.setText(result);
                networkSummary.setText(verified ? "RESPONDEU" : "SEM RESPOSTA");
                networkSummary.setTextColor(verified ?
                    Color.rgb(141, 232, 181) : Color.rgb(255, 192, 158));
            });
        }, "bx-health-on-demand");
        networkThread.start();
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        HttpURLConnection conn = activeHealthConnection;
        if (conn != null) conn.disconnect();
        if (networkThread != null) networkThread.interrupt();
        super.onDestroy();
    }

    private TextView statusBadge(LinearLayout parent, String title,
                                 String status, boolean highlight) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setPadding(dp(9), dp(12), dp(7), dp(12));
        item.setBackground(roundRect(
            highlight ? Color.rgb(47, 29, 42) : Color.rgb(24, 25, 33),
            highlight ? Color.rgb(141, 77, 102) : Color.rgb(66, 55, 68), 13));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(77), 1f);
        params.setMargins(dp(2), 0, dp(2), 0);
        parent.addView(item, params);
        LinearLayout previous = layout;
        layout = item;
        label(title, 11, Color.rgb(255, 160, 183), Typeface.BOLD, 7);
        TextView value = label(status, 10, WHITE, Typeface.BOLD, 0);
        layout = previous;
        return value;
    }

    private GradientDrawable roundRect(int background, int border, int radius) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(background);
        shape.setCornerRadius(dp(radius));
        shape.setStroke(dp(1), border);
        return shape;
    }

    private void startCard(String sectionTitle) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(15), dp(18), dp(15), dp(15));
        card.setBackground(roundRect(CARD, Color.rgb(100, 67, 83), 17));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(14);
        rootLayout.addView(card, params);
        layout = card;
        label(sectionTitle, 12, RED, Typeface.BOLD, 13);
    }

    private void endCard() {
        layout = rootLayout;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        outState.putString(STATE_REPORT, report);
        super.onSaveInstanceState(outState);
    }

    private void inspectDevice() {
        copyStatus.setText("");
        StringBuilder result = new StringBuilder(600);
        result.append("BX Android Gateway — diagnóstico v0.5.0\n");
        result.append("Sistema: Android ").append(Build.VERSION.RELEASE).append("\n");
        result.append("API: ").append(Build.VERSION.SDK_INT).append("\n");
        result.append("Modelo (relatório local): ").append(Build.MANUFACTURER).append(" ")
            .append(Build.MODEL).append("\n");

        ActivityManager manager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
        long ramBytes = 0L;
        boolean lowRam = false;
        if (manager != null) {
            manager.getMemoryInfo(memory);
            ramBytes = memory.totalMem;
            lowRam = manager.isLowRamDevice();
        }
        if (ramBytes > 0) {
            String gib = String.format(Locale.US, "%.2f",
                ((double) ramBytes) / (1024.0 * 1024.0 * 1024.0));
            result.append("RAM física aproximada: ").append(gib).append(" GiB\n");
        } else result.append("RAM física: indisponível\n");
        result.append("Aparelho de baixa RAM (Android): ")
            .append(lowRam ? "sim" : "não informado como baixo").append("\n");
        if (manager != null && memory.availMem > 0) {
            result.append("RAM disponível no momento: ").append(
                String.format(Locale.US, "%.2f", ((double) memory.availMem) /
                    (1024.0 * 1024.0 * 1024.0))).append(" GiB\n");
            result.append("Pressão de memória no momento: ")
                .append(memory.lowMemory ? "alta" : "não sinalizada").append("\n");
        }

        int decoders = 0;
        int encoders = 0;
        boolean hardwareDecoder = false;
        boolean hardwareEncoder = false;
        try {
            MediaCodecList list = new MediaCodecList(MediaCodecList.ALL_CODECS);
            for (MediaCodecInfo info : list.getCodecInfos()) {
                for (String type : info.getSupportedTypes()) {
                    if (!"video/avc".equalsIgnoreCase(type)) continue;
                    if (info.isEncoder()) {
                        encoders++;
                        if (Build.VERSION.SDK_INT >= 29 && info.isHardwareAccelerated())
                            hardwareEncoder = true;
                    } else {
                        decoders++;
                        if (Build.VERSION.SDK_INT >= 29 && info.isHardwareAccelerated())
                            hardwareDecoder = true;
                    }
                    break;
                }
            }
        } catch (RuntimeException unavailable) {
            // Invalid vendor codec metadata should not crash old devices.
            result.append("Codecs do fabricante: não foi possível consultar todos\n");
        }
        result.append("Decodificadores H.264 detectados: ").append(decoders).append("\n");
        result.append("Codificadores H.264 detectados: ").append(encoders).append("\n");
        if (Build.VERSION.SDK_INT >= 29) {
            result.append("H.264 por hardware (decodificação): ")
                .append(hardwareDecoder ? "detectado" : "não confirmado").append("\n");
            result.append("H.264 por hardware (codificação): ")
                .append(hardwareEncoder ? "detectado" : "não confirmado").append("\n");
        } else result.append("Aceleração por hardware: não identificável com segurança nesta API\n");

        MediaProjectionManager screenManager = (MediaProjectionManager)
            getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        result.append("API de projeção de tela: ")
            .append(screenManager != null ? "disponível, não autorizada" : "indisponível")
            .append("\n");
        result.append("Captura de áudio de outro app: ")
            .append(Build.VERSION.SDK_INT >= 29 ?
                "API Android 10+ (depende da política do app)" :
                "indisponível antes do Android 10").append("\n");

        // Sticky battery broadcast is read locally: no permission and no
        // background polling. It is only a snapshot, NOT a 24h safety monitor.
        try {
            Intent battery = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (battery != null) {
                int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                if (level >= 0 && scale > 0)
                    result.append("Bateria no momento: ")
                        .append(Math.round((100f * level) / scale)).append("%\n");
                int batteryStatus = battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                result.append("Carregamento: ")
                    .append(batteryStatus == BatteryManager.BATTERY_STATUS_CHARGING ||
                            batteryStatus == BatteryManager.BATTERY_STATUS_FULL ?
                            "conectado/concluído" : "não confirmado").append("\n");
                int temp = battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1);
                if (temp > 0) {
                    result.append("Temperatura informada da bateria: ")
                        .append(String.format(Locale.US, "%.1f", temp / 10.0f))
                        .append(" °C (somente leitura atual)\n");
                    if (temp >= 420)
                        result.append("Atenção: bateria quente. Não usar como gateway contínuo nessas condições.\n");
                }
            } else result.append("Bateria: informação não disponível\n");
        } catch (RuntimeException error) {
            result.append("Bateria: não foi possível consultar neste Android\n");
        }
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    int state = pm.getCurrentThermalStatus();
                    result.append("Estado térmico Android: ").append(state)
                        .append(" (0=normal; 3+=sob pressão, varia conforme fabricante)\n");
                    if (state >= PowerManager.THERMAL_STATUS_SEVERE)
                        result.append("Atenção: pressão térmica elevada. Interrompa testes exigentes.\n");
                }
            } catch (RuntimeException error) {
                result.append("Estado térmico: não disponível neste aparelho\n");
            }
        } else result.append("Estado térmico do sistema: API não disponível antes do Android 10\n");

        String profile;
        if (lowRam || (ramBytes > 0 && ramBytes < 1600L * 1024L * 1024L))
            profile = "Muito limitado: começar com testes visuais leves; 480p pode falhar.";
        else if (ramBytes > 0 && ramBytes < 3000L * 1024L * 1024L)
            profile = "Modesto: iniciar futuros testes em 480p; sem garantia de 30 FPS.";
        else profile = "Recursos não garantidos: codecs e desempenho exigem teste físico.";
        result.append("Orientação: ").append(profile).append("\n");
        result.append("Nota: bateria, memória e estado térmico são leituras pontuais, não monitoramento contínuo.\n");
        result.append("Streaming PS4 integrado ao BX: NÃO IMPLEMENTADO\n");
        result.append("Dados enviados no teste de hardware: NENHUM; teste HTTPS apenas GET público sob pedido\n");

        report = result.toString();
        diagnostics.setText(report);
        copyButton.setEnabled(true);
        readinessBanner.setText(lowRam
            ? "LIMITADO  ·  memória baixa; teste apenas funções leves"
            : "ANÁLISE CONCLUÍDA  ·  desempenho do gateway não comprovado");
    }

    private TextView label(String value, int sp, int color, int style, int bottom) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setTypeface(Typeface.DEFAULT, style);
        view.setLineSpacing(dp(2), 1.0f);
        LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        layoutParams.bottomMargin = dp(bottom);
        layout.addView(view, layoutParams);
        return view;
    }

    private Button button(String value, boolean primary) {
        Button button = new Button(this);
        button.setText(value);
        button.setTextColor(WHITE);
        button.setAllCaps(false);
        button.setTextSize(15);
        button.setGravity(Gravity.CENTER);
        GradientDrawable background = new GradientDrawable();
        background.setColor(primary ? RED : CARD);
        background.setCornerRadius(dp(12));
        background.setStroke(dp(1), primary ? RED : Color.rgb(110, 60, 77));
        button.setBackground(background);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(50));
        params.bottomMargin = dp(12);
        layout.addView(button, params);
        return button;
    }

    private int dp(int size) {
        return Math.round(size * getResources().getDisplayMetrics().density);
    }
}
