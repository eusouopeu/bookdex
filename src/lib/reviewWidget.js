/**
 * Ponte com o widget de tela inicial do Android (ReviewWidgetPlugin, nativo
 * em android/app/.../ReviewWidgetPlugin.java). Fora do Android nativo
 * (browser/PWA) o plugin simplesmente não existe — a chamada falha
 * silenciosamente, best-effort, igual ao padrão de notifications.js.
 */
import { registerPlugin } from "@capacitor/core";

const ReviewWidget = registerPlugin("ReviewWidget");

export async function updateReviewWidget(dueCount, headline) {
  try {
    await ReviewWidget.update({ dueCount: dueCount || 0, headline: headline || "" });
  } catch {
    /* plugin indisponível fora do Android nativo — sem problema */
  }
}
