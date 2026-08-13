/**
 * Lembrete local de revisão espaçada (@capacitor/local-notifications).
 * Best-effort: em ambientes sem suporte (browser sem permissão, etc.) as
 * chamadas falham silenciosamente — a revisão continua funcionando via badge
 * no header, a notificação é só um reforço.
 */
import { LocalNotifications } from "@capacitor/local-notifications";

const REVIEW_NOTIFICATION_ID = 9001;
const REMINDER_HOUR = 9;

export async function hasNotificationPermission() {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === "granted";
  } catch {
    return false;
  }
}

export async function requestNotificationPermission() {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === "granted";
  } catch {
    return false;
  }
}

function nextReminderTime(now = Date.now()) {
  const d = new Date(now);
  d.setHours(REMINDER_HOUR, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d;
}

export async function scheduleReviewReminder(dueCount) {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REVIEW_NOTIFICATION_ID }] });
    if (!dueCount || dueCount <= 0) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REVIEW_NOTIFICATION_ID,
          title: "Hora de revisar! 🔴",
          body: `Você tem ${dueCount} item${dueCount === 1 ? "" : "s"} pendente${dueCount === 1 ? "" : "s"} na revisão espaçada.`,
          schedule: { at: nextReminderTime() },
        },
      ],
    });
  } catch {
    /* plataforma sem suporte a notificações locais */
  }
}

export async function cancelReviewReminder() {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REVIEW_NOTIFICATION_ID }] });
  } catch {
    /* nada a cancelar */
  }
}
