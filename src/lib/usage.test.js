import { describe, expect, it } from "vitest";
import { normalizeUsage, recordCall, monthSpend, costOfByModel, totalsOf, monthKey } from "./usage";
import { MODELS } from "./models";

const JAN = new Date(2026, 0, 15, 12).getTime();
const FEV = new Date(2026, 1, 3, 12).getTime();

describe("usage", () => {
  it("migra o contador plano antigo atribuindo tudo ao Sonnet", () => {
    const legacy = { calls: 3, inputTokens: 1000, outputTokens: 2000, since: 42 };
    const migrated = normalizeUsage(legacy);
    expect(migrated.since).toBe(42);
    expect(migrated.byModel[MODELS.sonnet]).toEqual({ calls: 3, inputTokens: 1000, outputTokens: 2000 });
    expect(migrated.months).toEqual({});
  });

  it("normaliza estado ausente ou vazio sem explodir", () => {
    expect(normalizeUsage(null)).toEqual({ since: null, byModel: {}, months: {} });
    expect(normalizeUsage({ calls: 0, since: 7 })).toEqual({ since: 7, byModel: {}, months: {} });
  });

  it("soma por modelo e por mês, mantendo os meses separados", () => {
    let state = recordCall(null, MODELS.sonnet, { input_tokens: 100, output_tokens: 200 }, JAN);
    state = recordCall(state, MODELS.haiku, { input_tokens: 50, output_tokens: 50 }, JAN);
    state = recordCall(state, MODELS.sonnet, { input_tokens: 10, output_tokens: 10 }, FEV);

    expect(state.byModel[MODELS.sonnet]).toEqual({ calls: 2, inputTokens: 110, outputTokens: 210 });
    expect(state.byModel[MODELS.haiku].calls).toBe(1);
    expect(Object.keys(state.months).sort()).toEqual(["2026-01", "2026-02"]);
    expect(state.months["2026-01"].byModel[MODELS.sonnet].calls).toBe(1);
    expect(state.since).toBe(JAN);
  });

  it("precifica cada modelo com a tabela dele", () => {
    // 1M de entrada + 1M de saída: Sonnet 3+15, Haiku 1+5.
    const cost = costOfByModel({
      [MODELS.sonnet]: { inputTokens: 1e6, outputTokens: 1e6 },
      [MODELS.haiku]: { inputTokens: 1e6, outputTokens: 1e6 },
    });
    expect(cost).toBeCloseTo(24, 5);
  });

  it("monthSpend só considera o mês corrente", () => {
    let state = recordCall(null, MODELS.sonnet, { input_tokens: 1e6, output_tokens: 0 }, JAN);
    state = recordCall(state, MODELS.sonnet, { input_tokens: 2e6, output_tokens: 0 }, FEV);
    expect(monthSpend(state, JAN)).toBeCloseTo(3, 5);
    expect(monthSpend(state, FEV)).toBeCloseTo(6, 5);
  });

  it("totalsOf soma chamadas e tokens de todos os modelos", () => {
    expect(
      totalsOf({ a: { calls: 1, inputTokens: 10, outputTokens: 20 }, b: { calls: 2, inputTokens: 5, outputTokens: 5 } })
    ).toEqual({ calls: 3, inputTokens: 15, outputTokens: 25 });
  });

  it("monthKey usa o fuso local, com mês de dois dígitos", () => {
    expect(monthKey(JAN)).toBe("2026-01");
  });
});
