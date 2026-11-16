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
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.Locale;

/**
 * Lightweight, read-only compatibility diagnostic for a future Android gateway.
 *
 * No INTERNET, SCREEN_CAPTURE, RECORD_AUDIO or filesystem permissions.
 * No PSN, Remote Play session, background service, streaming or input control.
 * The user must explicitly copy the text; it never leaves the phone itself.
 */
public final class MainActivity extends Activity {
    private static final int RED = Color.rgb(239, 54, 83);
    private static final int BACKGROUND = Color.rgb(11, 12, 17);
    private static final int CARD = Color.rgb(24, 24, 32);
    private static final int WHITE = Color.rgb(247, 244, 246);
    private static final int MUTED = Color.rgb(189, 181, 194);

    private LinearLayout layout;
    private TextView diagnostics;
    private String report = "";
    private Button copyButton;
    private TextView copyStatus;
    private static final String STATE_REPORT = "bx_diagnostic_report";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BACKGROUND);
        layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(18), dp(26), dp(18), dp(34));
        scroll.addView(layout);
        setContentView(scroll);

        label("BX-REMOTE-PLAY", 14, RED, Typeface.BOLD, 6);
        label("ANDROID GATEWAY", 26, WHITE, Typeface.BOLD, 9);
        label("Compatibilidade do aparelho", 18, WHITE, Typeface.NORMAL, 10);

        label("Primeira etapa: descobrir se este Android pode servir como ponte. " +
            "O aplicativo ainda NÃO recebe Remote Play, nem transmite imagem, áudio ou comandos.", 14, MUTED, Typeface.NORMAL, 20);

        Button inspect = button("Analisar aparelho", true);
        inspect.setOnClickListener(v -> inspectDevice());

        copyButton = button("Copiar relatório local", false);
        copyButton.setEnabled(false);
        copyButton.setOnClickListener(v -> {
            if (report.isEmpty()) {
                diagnostics.setText("Execute a análise antes de copiar.");
                return;
            }
            ClipboardManager cb = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cb != null) {
                cb.setPrimaryClip(ClipData.newPlainText("BX Gateway compatibility", report));
                copyStatus.setText("Relatório copiado. Você controla se deseja compartilhá-lo.");
            }
        });
        Button web = button("Abrir central BX no navegador", false);
        web.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://ct7-bx.github.io/BX-REMOTE-PLAY/remote/gateway.html"));
            try { startActivity(intent); }
            catch (Exception error) {
                diagnostics.setText("Nenhum navegador disponível para abrir a central.");
            }
        });

        diagnostics = label("Nenhum teste executado. Não há comunicação com PS4 nesta versão.",
            14, WHITE, Typeface.NORMAL, 12);
        diagnostics.setTextIsSelectable(true);
        copyStatus = label("", 13, MUTED, Typeface.NORMAL, 12);
        if (savedInstanceState != null) {
            String restored = savedInstanceState.getString(STATE_REPORT, "");
            if (!restored.isEmpty()) {
                report = restored;
                diagnostics.setText(report);
                copyButton.setEnabled(true);
            }
        }
        label("Privacidade: o APK não solicita permissão de internet, câmera, " +
            "microfone, mídia ou armazenamento. Não coleta contas ou PINs, " +
            "e não inicia serviço em segundo plano.", 12, MUTED, Typeface.NORMAL, 22);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        outState.putString(STATE_REPORT, report);
        super.onSaveInstanceState(outState);
    }

    private void inspectDevice() {
        copyStatus.setText("");
        StringBuilder result = new StringBuilder(600);
        result.append("BX Android Gateway — diagnóstico v0.1.0\n");
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
        result.append("Dados enviados ao BX: NENHUM\n");

        report = result.toString();
        diagnostics.setText(report);
        copyButton.setEnabled(true);
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
