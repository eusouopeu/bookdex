import { describe, expect, it } from "vitest";
import { costOfByModel, recordCall } from "./usageCore";
import { MODELS } from "./models";

describe("contador de uso com prompt caching", () => {
  it("acumula tokens de cache e cobra leitura a 0,1× e escrita a 1,25× do preço de entrada", () => {
    const state = recordCall(null, MODELS.sonnet, {
      input_tokens: 1000,
      output_tokens: 0,
      cache_creation_input_tokens: 2000,
      cache_read_input_tokens: 10000,
    });
    const bucket = state.byModel[MODELS.sonnet];
    expect(bucket.cacheWriteTokens).toBe(2000);
    expect(bucket.cacheReadTokens).toBe(10000);
    // Sonnet: US$ 3/MTok entrada → 1000×3 + 2000×3×1.25 + 10000×3×0.1 = 3000 + 7500 + 3000 = 13500 /1e6
    expect(costOfByModel(state.byModel)).toBeCloseTo(0.0135, 6);
  });

  it("estado antigo sem campos de cache continua custando igual", () => {
    const state = recordCall(null, MODELS.sonnet, { input_tokens: 1000, output_tokens: 1000 });
    expect(costOfByModel(state.byModel)).toBeCloseTo((1000 * 3 + 1000 * 15) / 1e6, 6);
  });
});
