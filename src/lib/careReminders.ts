/**
 * Lembretes de cuidado das plantas (água/fertilização) via notificação local.
 *
 * `planCareReminders` é puro: lê o cronograma de cada planta salva (ver
 * `CareSchedule` em lib/plants.ts) e devolve UM lembrete por tarefa ligada,
 * às 9h do dia em que ela vence. Tarefa já atrasada vira lembrete no próximo
 * 9h — como o plano é recalculado sempre que `saved` muda (e a cada abertura
 * do app), isso dá no máximo um aviso por dia enquanto ninguém marcar "Feito
 * hoje". Tarefa nunca feita (`lastDoneAt: null`) não gera aviso: sem data de
 * partida, qualquer vencimento seria inventado.
 *
 * `scheduleCareReminders` é a parte com efeito colateral: só em nativo
 * (`@capacitor/local-notifications`), debounced como o espelho .md, e sempre
 * substitui o conjunto inteiro (cancela os pendentes desta origem e agenda
 * de novo) — mais simples e sem estado do que diffar contra o que já existe.
 */
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { CARE_TASKS, type CareTaskState } from "./plants";
import { groupItems, itemKind, itemLabel, type SavedState } from "./savedModel";

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_HOUR = 9;
const DEBOUNCE_MS = 3000;
const SOURCE = "care";

export interface CareReminder {
  id: number;
  at: number;
  title: string;
  body: string;
  subjectKey: string;
  itemId: string;
  taskId: string;
}

/** Hash estável e positivo (32 bits com sinal) — id de notificação precisa ser int no Android. */
function stableId(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

/** Próximo horário `REMINDER_HOUR`:00 no dia de `dueAt`, ou o próximo 9h depois de `now` se já passou. */
function reminderTime(dueAt: number, now: number) {
  const d = new Date(dueAt);
  d.setHours(REMINDER_HOUR, 0, 0, 0);
  if (d.getTime() > now) return d.getTime();
  const next = new Date(now);
  next.setHours(REMINDER_HOUR, 0, 0, 0);
  if (next.getTime() <= now) next.setDate(next.getDate() + 1);
  return next.getTime();
}

const TASK_VERB: Record<string, string> = { water: "regar", fertilize: "adubar" };

export function planCareReminders(saved: SavedState, now = Date.now()): CareReminder[] {
  const out: CareReminder[] = [];
  for (const [subjectKey, group] of Object.entries(saved || {})) {
    for (const item of groupItems(group)) {
      if (item.archived || itemKind(item, group) !== "plant") continue;
      const care = (item as any).care as Record<string, CareTaskState> | undefined;
      if (!care) continue;
      for (const task of CARE_TASKS) {
        const state = care[task.id];
        if (!state?.enabled || state.lastDoneAt == null || !(state.intervalDays > 0)) continue;
        const label = itemLabel(item) || "sua planta";
        out.push({
          id: stableId(`${subjectKey}:${item.id}:${task.id}`),
          at: reminderTime(state.lastDoneAt + state.intervalDays * DAY_MS, now),
          title: `Hora de ${TASK_VERB[task.id] || task.label.toLowerCase()}`,
          body: `${label}: ${task.label.toLowerCase()} a cada ${state.intervalDays} dia(s). Toque "Feito hoje" no card ao terminar.`,
          subjectKey,
          itemId: item.id,
          taskId: task.id,
        });
      }
    }
  }
  return out;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let permission: "granted" | "denied" | null = null;

async function ensurePermission() {
  if (permission) return permission === "granted";
  let { display } = await LocalNotifications.checkPermissions();
  if (display === "prompt" || display === "prompt-with-rationale") {
    ({ display } = await LocalNotifications.requestPermissions());
  }
  permission = display === "granted" ? "granted" : "denied";
  return permission === "granted";
}

async function syncNow(saved: SavedState) {
  try {
    const plan = planCareReminders(saved);
    const { notifications: pending } = await LocalNotifications.getPending();
    const ours = pending.filter((n) => n.extra?.source === SOURCE);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    // Só pede permissão quando há algo pra avisar — não incomoda quem nunca configurou cronograma.
    if (!plan.length || !(await ensurePermission())) return;
    await LocalNotifications.schedule({
      notifications: plan.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        schedule: { at: new Date(r.at), allowWhileIdle: true },
        extra: { source: SOURCE, subjectKey: r.subjectKey, itemId: r.itemId, taskId: r.taskId },
      })),
    });
  } catch (e) {
    console.warn("[careReminders] falha ao agendar lembretes", e);
  }
}

export function scheduleCareReminders(saved: SavedState) {
  if (!Capacitor.isNativePlatform()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncNow(saved);
  }, DEBOUNCE_MS);
}
