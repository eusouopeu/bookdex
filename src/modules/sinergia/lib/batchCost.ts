/**
 * Estimativa de custo de uma operação em LOTE, mostrada antes de disparar.
 *
 * "Detectar interações" com 8 itens ativos são 28 chamadas — antes elas saíam
 * sequenciais, sem aviso, sem progresso e sem como cancelar. O número aqui é
 * grosseiro de propósito (tokens típicos por tipo de chamada, preço de lista):
 * serve pra distinguir "centavos" de "isso vai doer", não pra fechar conta.
 */
import { costOf, MODELS } from "./models";
import { getMonthlyBudget, getUsageStats, monthSpend } from "./usage";

/** Tokens típicos por chamada, por tipo de lote. Saída inclui a folga do pensamento estendido. */
const CALL_SHAPE: Record<string, { input: number; output: number }> = {
  rating: { input: 400, output: 700 },
  interaction: { input: 400, output: 600 },
};

export function estimateBatchCost(calls: number, kind = "rating") {
  const shape = CALL_SHAPE[kind] || CALL_SHAPE.rating;
  return costOf(MODELS.sonnet, calls * shape.input, calls * shape.output);
}

/** Custo estimado do lote + quanto ainda cabe no teto mensal (null quando não há teto). */
export async function estimateBatch(calls: number, kind = "rating") {
  const [limit, usage] = await Promise.all([getMonthlyBudget(), getUsageStats()]);
  const spent = monthSpend(usage);
  const cost = estimateBatchCost(calls, kind);
  return {
    calls,
    cost,
    limit: limit || null,
    spent,
    remaining: limit ? Math.max(0, limit - spent) : null,
    exceedsBudget: !!limit && spent + cost > limit,
  };
}

export function usd(value: number) {
  return `US$ ${value < 0.01 && value > 0 ? value.toFixed(4) : value.toFixed(2)}`;
}
