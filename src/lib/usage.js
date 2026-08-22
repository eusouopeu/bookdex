/**
 * Contador de uso da API — por modelo e por mês — e o teto mensal opcional.
 *
 * Antes o contador era um único acumulado plano `{ calls, inputTokens,
 * outputTokens }` precificado sempre como Sonnet. Com dois modelos em uso
 * (ver lib/models.js) isso passou a mentir, e sem recorte mensal não dava pra
 * impor limite de gasto. O formato novo é:
 *
 *   {
 *     since: 1730000000000,
 *     byModel: { "claude-sonnet-5": { calls, inputTokens, outputTokens } },
 *     months:  { "2026-08": { byModel: { ... } } }
 *   }
 *
 * `byModel` é o acumulado desde `since` (o que o botão "zerar contador"
 * reinicia); `months` é o histórico usado pelo teto mensal, e sobrevive ao
 * zerar — senão o teto seria contornável com um toque.
 */
import { getJSON, setJSON, KEYS } from "./storage";
import { costOf, MODELS } from "./models";

export function emptyBucket() {
  return { calls: 0, inputTokens: 0, outputTokens: 0 };
}

export function emptyUsage() {
  return { since: null, byModel: {}, months: {} };
}

/** "2026-08" no fuso local — o mês que o usuário enxerga na fatura mental dele. */
export function monthKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Aceita tanto o formato novo quanto o plano antigo (`{ calls, inputTokens,
 * outputTokens, since }`), que é atribuído inteiro ao Sonnet — era o único
 * modelo em uso quando aqueles números foram gravados.
 */
export function normalizeUsage(raw) {
  if (!raw || typeof raw !== "object") return emptyUsage();
  if (raw.byModel || raw.months) {
    return { since: raw.since ?? null, byModel: raw.byModel || {}, months: raw.months || {} };
  }
  if (!raw.calls) return { ...emptyUsage(), since: raw.since ?? null };
  const legacy = {
    calls: raw.calls || 0,
    inputTokens: raw.inputTokens || 0,
    outputTokens: raw.outputTokens || 0,
  };
  return { since: raw.since ?? null, byModel: { [MODELS.sonnet]: legacy }, months: {} };
}

function addTo(bucket, usage) {
  return {
    calls: (bucket?.calls || 0) + 1,
    inputTokens: (bucket?.inputTokens || 0) + (usage.input_tokens || 0),
    outputTokens: (bucket?.outputTokens || 0) + (usage.output_tokens || 0),
  };
}

/** Soma uma chamada ao acumulado e ao mês corrente. Função pura. */
export function recordCall(state, model, usage, now = Date.now()) {
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
export function costOfByModel(byModel) {
  return Object.entries(byModel || {}).reduce(
    (sum, [model, b]) => sum + costOf(model, b.inputTokens || 0, b.outputTokens || 0),
    0
  );
}

export function totalsOf(byModel) {
  return Object.values(byModel || {}).reduce(
    (acc, b) => ({
      calls: acc.calls + (b.calls || 0),
      inputTokens: acc.inputTokens + (b.inputTokens || 0),
      outputTokens: acc.outputTokens + (b.outputTokens || 0),
    }),
    emptyBucket()
  );
}

/** Custo já gasto no mês corrente, em USD. */
export function monthSpend(state, now = Date.now()) {
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

export async function trackUsage(model, usage) {
  if (!usage) return;
  const current = await getUsageStats();
  await setJSON(KEYS.usageStats, recordCall(current, model, usage));
}

/* ------------------------------------------------------------- teto mensal */

export class BudgetExceededError extends Error {
  constructor(limit, spent) {
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

export async function setMonthlyBudget(usd) {
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
