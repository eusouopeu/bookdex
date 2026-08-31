/**
 * Persistência do contador de uso e do teto mensal do módulo Sinergia. A
 * lógica pura (formato do estado, soma de chamadas, custo) mora em
 * `../../../lib/usageCore` — compartilhada com o Cognidex, que persiste no
 * próprio namespace (`tecnicadex:` vs `efeitosdex:`).
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
} from "../../../lib/usageCore";

export { emptyBucket, emptyUsage, monthKey, normalizeUsage, recordCall, costOfByModel, totalsOf, monthSpend, BudgetExceededError };

/* ------------------------------------------------------------- persistência */

export async function getUsageStats() {
  return normalizeUsage(await getJSON(KEYS.usageStats, null));
}

/** Zera o acumulado visível, mas preserva o histórico mensal (ver ../../../lib/usageCore). */
export async function resetUsageStats() {
  const current = await getUsageStats();
  await setJSON(KEYS.usageStats, { since: Date.now(), byModel: {}, months: current.months });
}

export async function trackUsage(model: string, usage: any) {
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
