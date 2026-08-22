package com.pedroteles.tecnicadex;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Além de subir a WebView do Capacitor, esta Activity é o alvo de
 * compartilhamento do Android (ACTION_SEND, text/plain): selecionar um termo em
 * qualquer app e compartilhar com o Bookdex abre o app já buscando esse termo.
 *
 * O texto é repassado à WebView como o parâmetro `?shared=` da URL — é o
 * caminho mais direto sem depender do plugin @capacitor/app, e o próprio App.jsx
 * limpa o parâmetro depois de disparar a busca (senão recarregar a página
 * repetiria a busca).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleShare(getIntent());
    }

    /** launchMode="singleTask": com o app já aberto, o share chega por aqui. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        CharSequence shared = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (shared == null || shared.length() == 0) return;

        // Trecho longo (uma seleção de parágrafo inteiro) não vira busca útil e
        // ainda estoura a URL; o próprio JS corta de novo, isto é só o teto.
        String text = shared.toString().trim();
        if (text.length() > 300) text = text.substring(0, 300);

        final String url = getBridgeUrl(Uri.encode(text));
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(url));
    }

    private String getBridgeUrl(String encodedText) {
        String base = getBridge().getAppUrl();
        if (base == null || base.isEmpty()) base = "https://localhost";
        return base + (base.contains("?") ? "&" : "?") + "shared=" + encodedText;
    }
}
