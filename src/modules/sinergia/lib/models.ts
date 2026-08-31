/**
 * Modelo usado pelo app e seu preço. Avaliar um item e sugerir combinações
 * exige julgamento comparativo, então fica fixo em Sonnet — não há um modo
 * de recuperação estruturada aqui que justificasse Haiku.
 */
export const MODELS = {
  sonnet: "claude-sonnet-5",
};

/** Preço de lista em USD por milhão de tokens. Usado só para estimar custo. */
export const PRICING: Record<string, { input: number; output: number }> = {
  [MODELS.sonnet]: { input: 3, output: 15 },
};

export function modelFor() {
  return MODELS.sonnet;
}

/** Custo em USD de um par (entrada, saída) de tokens num modelo. */
export function costOf(model: string, inputTokens: number, outputTokens: number) {
  const price = PRICING[model] || PRICING[MODELS.sonnet];
  return (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output;
}
