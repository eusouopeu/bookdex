/**
 * Contador de uso da API e o teto mensal opcional.
 *
 *   {
 *     since: 1730000000000,
 *     byModel: { "claude-sonnet-5": { calls, inputTokens, outputTokens } },
 *     months:  { "2026-08": { byModel: { ... } } }
 *   }
 *
 * `byModel` é o acumulado desde `since` (o que "zerar contador" reinicia);
 * `months` é o histórico usado pelo teto mensal, e sobrevive ao zerar —
 * senão o teto seria contornável com um toque.
 */
import { getJSON, setJSON, KEYS } from "./storage";
import { costOf, MODELS } from "./models";

export function emptyBucket() {
  return { calls: 0, inputTokens: 0, outputTokens: 0 };
}

export function emptyUsage() {
  return { since: null as number | null, byModel: {} as Record<string, any>, months: {} as Record<string, any> };
}

/** "2026-08" no fuso local — o mês que o usuário enxerga na fatura mental dele. */
export function monthKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function normalizeUsage(raw: any) {
  if (!raw || typeof raw !== "object") return emptyUsage();
  if (raw.byModel || raw.months) {
    return { since: raw.since ?? null, byModel: raw.byModel || {}, months: raw.months || {} };
  }
  return { ...emptyUsage(), since: raw.since ?? null };
}

function addTo(bucket: any, usage: any) {
  return {
    calls: (bucket?.calls || 0) + 1,
    inputTokens: (bucket?.inputTokens || 0) + (usage.input_tokens || 0),
    outputTokens: (bucket?.outputTokens || 0) + (usage.output_tokens || 0),
  };
}

/** Soma uma chamada ao acumulado e ao mês corrente. Função pura. */
export function recordCall(state: any, model: string, usage: any, now = Date.now()) {
  const base = normalizeUsage(state);
  const mk = monthKey(now);
  const month = base.months[mk] || { byModel: {} };
  return {
    since: base.since || now,
    byModel: { ...base.byModel, [model]: addTo(base.byModel[model], usage) },
    months: {
      ...base.months,
      [mk]: { byModel: { ...month.byModel, [model]: addTo(month.byModel[model], usage) } },
    },
  };
}

/** Custo total (USD) de um mapa `byModel`. */
export function costOfByModel(byModel: Record<string, any>) {
  return Object.entries(byModel || {}).reduce(
    (sum, [model, b]: [string, any]) => sum + costOf(model, b.inputTokens || 0, b.outputTokens || 0),
    0
  );
}

export function totalsOf(byModel: Record<string, any>) {
  return Object.values(byModel || {}).reduce(
    (acc: any, b: any) => ({
      calls: acc.calls + (b.calls || 0),
      inputTokens: acc.inputTokens + (b.inputTokens || 0),
      outputTokens: acc.outputTokens + (b.outputTokens || 0),
    }),
    emptyBucket()
  );
}

/** Custo já gasto no mês corrente, em USD. */
export function monthSpend(state: any, now = Date.now()) {
  const base = normalizeUsage(state);
  return costOfByModel(base.months[monthKey(now)]?.byModel);
}

/* ------------------------------------------------------------- persistência */

export async function getUsageStats() {
  return normalizeUsage(await getJSON(KEYS.usageStats, null));
}

/** Zera o acumulado visível, mas preserva o histórico mensal (ver topo). */
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

export class BudgetExceededError extends Error {
  limit: number;
  spent: number;
  constructor(limit: number, spent: number) {
    super(
      `Teto mensal de US$ ${limit.toFixed(2)} atingido (US$ ${spent.toFixed(2)} gastos neste mês). ` +
        "Suba ou desligue o limite em Configurações."
    );
    this.name = "BudgetExceededError";
    this.limit = limit;
    this.spent = spent;
  }
}

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
