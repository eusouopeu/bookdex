package com.pedroteles.tecnicadex;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte JS -> widget de tela inicial: o app chama update() sempre que a fila
 * de revisão espaçada muda, isso grava em SharedPreferences próprio (não
 * compartilhado com o @capacitor/preferences do resto do app) e força o
 * ReviewWidgetProvider a redesenhar todas as instâncias do widget.
 */
@CapacitorPlugin(name = "ReviewWidget")
public class ReviewWidgetPlugin extends Plugin {

    public static final String PREFS_NAME = "com.pedroteles.tecnicadex.widget";

    @PluginMethod
    public void update(PluginCall call) {
        int dueCount = call.getInt("dueCount", 0);
        String headline = call.getString("headline", "");

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putInt("dueCount", dueCount).putString("headline", headline).apply();

        AppWidgetManager manager = AppWidgetManager.getInstance(context.getApplicationContext());
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ReviewWidgetProvider.class));
        if (ids.length > 0) {
            Intent intent = new Intent(context, ReviewWidgetProvider.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(intent);
        }

        call.resolve();
    }
}
