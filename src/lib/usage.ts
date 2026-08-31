/**
 * Persistência do contador de uso e do teto mensal do Cognidex. A lógica pura
 * (formato do estado, soma de chamadas, custo) mora em `./usageCore` —
 * compartilhada com o módulo Sinergia, que persiste no próprio namespace.
 */
import { getJSON, setJSON, KEYS } from "./storage";
import {
  emptyBucket,
  emptyUsage,
  monthKey,
  normalizeUsage,
  recordCall,
  costOfByModel,
  totalsOf,
  monthSpend,
  BudgetExceededError,
  type UsageBucket,
  type UsageByModel,
  type MonthEntry,
  type UsageState,
} from "./usageCore";

export {
  emptyBucket,
  emptyUsage,
  monthKey,
  normalizeUsage,
  recordCall,
  costOfByModel,
  totalsOf,
  monthSpend,
  BudgetExceededError,
};
export type { UsageBucket, UsageByModel, MonthEntry, UsageState };

/* ------------------------------------------------------------- persistência */

export async function getUsageStats() {
  return normalizeUsage(await getJSON(KEYS.usageStats, null));
}

/** Zera o acumulado visível, mas preserva o histórico mensal (ver ./usageCore). */
export async function resetUsageStats() {
  const current = await getUsageStats();
  await setJSON(KEYS.usageStats, { since: Date.now(), byModel: {}, months: current.months });
}

export async function trackUsage(model, usage) {
  if (!usage) return;
  const current = await getUsageStats();
  await setJSON(KEYS.usageStats, recordCall(current, model, usage));
}

/* ------------------------------------------------------------- teto mensal */

/** Teto em USD por mês; 0 significa desligado. */
export async function getMonthlyBudget() {
  const value = await getJSON(KEYS.monthlyBudget, 0);
  return typeof value === "number" && value > 0 ? value : 0;
}

export async function setMonthlyBudget(usd: number | string) {
  const value = Number(usd);
  await setJSON(KEYS.monthlyBudget, Number.isFinite(value) && value > 0 ? value : 0);
}

/** Lança `BudgetExceededError` se o mês corrente já estourou o teto. */
export async function assertWithinBudget() {
  const limit = await getMonthlyBudget();
  if (!limit) return;
  const spent = monthSpend(await getUsageStats());
  if (spent >= limit) throw new BudgetExceededError(limit, spent);
}
