/**
 * Chamadas à API da Anthropic específicas dos perfis de efeito.
 *
 * Estas funções viviam em `src/lib/anthropic.js` do Bookdex e saíram junto com
 * a aba "Efeitos". No app novo, importe `sendMessageJSON` do cliente da API
 * daquele app (a assinatura esperada é `{ system, user, maxTokens }`).
 */
import { sendMessageJSON } from "./anthropic";

export const EFFECT_RATING_SYSTEM_PROMPT = `Você avalia o efeito de um item (suplemento, alimento, exercício ou prática) em critérios definidos pelo usuário, para um app pessoal de acompanhamento de efeitos.
Dado o nome do item, o domínio/contexto e uma lista de critérios, avalie o quanto esse item TIPICAMENTE afeta CADA critério.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "value": nota de -5 a +5 por critério — negativo significa que o item PIORA/REDUZ aquele critério, positivo que MELHORA/AUMENTA, 0 que não tem efeito relevante conhecido.
- Seja realista e criterioso, baseado em conhecimento geral — não infle notas, e use valores negativos sempre que fizer sentido (ex.: um estimulante pode reduzir um critério como "calma").
- "reason": justificativa de até 12 palavras por critério, explicando a nota.
- Retorne EXATAMENTE um item em "ratings" para cada critério informado, na mesma ordem.

Formato exato (sem campos extras):
{"ratings":[{"criterion":"...","value":0,"reason":"..."}]}`;

/** Avalia UM item novo (suplemento/alimento/exercício/prática) nos critérios atuais de um perfil de efeito. */
export async function fetchItemRatings(itemName, domainContext, criteriaLabels) {
  const parsed = await sendMessageJSON({
    system: EFFECT_RATING_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItem: ${itemName}\nCritérios (nesta ordem): ${criteriaLabels.join(", ")}`,
    maxTokens: 600,
  });
  if (!Array.isArray(parsed.ratings)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.ratings;
}

export const EFFECT_SUGGESTIONS_SYSTEM_PROMPT = `Você sugere adições ou substituições pra uma combinação de suplementos/alimentos ou exercícios/práticas, buscando um objetivo específico do usuário em critérios que ele mesmo definiu.
Dado o domínio, os itens atualmente ativos na combinação (com suas notas em cada critério) e o(s) critério(s)-alvo com a direção desejada, sugira de 3 a 6 itens novos (adições) ou trocas de um item já ativo.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "name": nome do item sugerido.
- "kind": "adicao" (some à combinação atual, sem tirar nada) ou "substituicao" (troca por um item específico já ativo).
- "replaces": nome EXATO de um item já ativo informado, obrigatório se "kind" for "substituicao"; string vazia "" se for "adicao".
- "estimatedRatings": nota de -5 a +5 pra CADA critério-alvo informado, na mesma ordem.
- "reason": justificativa de até 18 palavras, mencionando o principal trade-off ou efeito colateral, se houver.

Formato exato (sem campos extras):
{"suggestions":[{"name":"...","kind":"adicao","replaces":"","estimatedRatings":[0],"reason":"..."}]}`;

/**
 * Sugere adições/substituições pra um perfil de efeito, dado os itens ativos
 * e os critérios-alvo (cada um com direção "mais"/"menos").
 */
export async function fetchEffectSuggestions(domainContext, activeItems, targetCriteria) {
  const activeSummary = (activeItems || [])
    .map((it) => `${it.name} (${Object.entries(it.ratings || {}).map(([c, v]) => `${c}: ${v > 0 ? "+" : ""}${v}`).join(", ")})`)
    .join("; ");
  const targetSummary = targetCriteria.map((t) => `${t.direction} ${t.label}`).join(", ");
  const parsed = await sendMessageJSON({
    system: EFFECT_SUGGESTIONS_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItens ativos: ${activeSummary || "nenhum"}\nObjetivo: quero ${targetSummary}\nCritérios-alvo (nesta ordem): ${targetCriteria
      .map((t) => t.label)
      .join(", ")}`,
    maxTokens: 900,
  });
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.suggestions;
}
