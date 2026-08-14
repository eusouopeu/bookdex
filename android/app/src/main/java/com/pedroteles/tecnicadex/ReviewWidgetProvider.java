package com.pedroteles.tecnicadex;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** Widget de tela inicial: mostra quantos itens estão pendentes na revisão espaçada. */
public class ReviewWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(ReviewWidgetPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        int dueCount = prefs.getInt("dueCount", 0);
        String headline = prefs.getString("headline", "Abra o Bookdex para começar");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.review_widget);
        views.setTextViewText(R.id.widget_count, String.valueOf(dueCount));
        views.setTextViewText(R.id.widget_label, dueCount == 1 ? "revisão pendente" : "revisões pendentes");
        views.setTextViewText(R.id.widget_headline, headline);

        Intent launchIntent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
