/**
 * Chamadas à API da Anthropic específicas dos perfis de efeito.
 *
 * Estas funções viviam em `src/lib/anthropic.js` do Bookdex e saíram junto com
 * a aba "Efeitos". No app novo, importe `sendMessageJSON` do cliente da API
 * daquele app (a assinatura esperada é `{ system, user, maxTokens }`).
 */
import { sendMessageJSON } from "./anthropic";
import { getCachedRating, putCachedRating } from "./ratingCache";

const PROBABILITY_CONFIDENCE_RULES = `- "probability": faixa de PROBABILIDADE de o efeito realmente ocorrer numa pessoa típica — exatamente um destes textos: "raro", "possivel", "provavel" ou "quase_certo". NUNCA um número/percentual — só a faixa.
- "confidence": nível de CONFIANÇA na estimativa — exatamente um destes textos: "anedota", "mecanismo", "estudo" ou "consenso".`;

export const EFFECT_RATING_SYSTEM_PROMPT = `Você avalia o efeito de um item (suplemento, alimento, exercício ou prática) em critérios definidos pelo usuário, para um app pessoal de acompanhamento de efeitos.
Dado o nome do item, o domínio/contexto e uma lista de critérios, avalie o quanto esse item TIPICAMENTE afeta CADA critério.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "value": nota de -5 a +5 por critério — negativo significa que o item PIORA/REDUZ aquele critério, positivo que MELHORA/AUMENTA, 0 que não tem efeito relevante conhecido.
- Seja realista e criterioso, baseado em conhecimento geral — não infle notas, e use valores negativos sempre que fizer sentido (ex.: um estimulante pode reduzir um critério como "calma").
- "reason": justificativa de até 12 palavras por critério, explicando a nota.
${PROBABILITY_CONFIDENCE_RULES}
- Retorne EXATAMENTE um item em "ratings" para cada critério informado, na mesma ordem.

Formato exato (sem campos extras):
{"ratings":[{"criterion":"...","value":0,"reason":"...","probability":"provavel","confidence":"mecanismo"}]}`;

/** Avalia UM item novo (suplemento/alimento/exercício/prática) nos critérios atuais de um perfil de efeito. */
export async function fetchItemRatings(itemName: string, domainContext: string, criteriaLabels: string[]) {
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

export const EFFECT_RATING_VARIANTS_SYSTEM_PROMPT = `Você avalia o efeito de VÁRIAS VARIANTES de um mesmo item (suplemento, alimento, exercício ou prática) em critérios definidos pelo usuário, para um app pessoal de acompanhamento de efeitos.
Dado o nome base do item, a lista de variantes e os critérios, avalie o quanto CADA variante TIPICAMENTE afeta CADA critério — variantes diferentes podem (e costumam) ter notas diferentes entre si.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "value": nota de -5 a +5 por critério — negativo piora/reduz, positivo melhora/aumenta, 0 sem efeito relevante conhecido.
- "reason": justificativa de até 12 palavras por critério.
${PROBABILITY_CONFIDENCE_RULES}
- Retorne EXATAMENTE um item em "variants" para cada variante informada, na mesma ordem, e dentro de cada uma EXATAMENTE um item em "ratings" para cada critério, na mesma ordem.

Formato exato (sem campos extras):
{"variants":[{"variant":"...","ratings":[{"criterion":"...","value":0,"reason":"...","probability":"provavel","confidence":"mecanismo"}]}]}`;

/** Avalia TODAS as variantes de um item novo numa chamada só (em vez de uma chamada por variante). */
export async function fetchItemRatingsForVariants(baseName: string, domainContext: string, criteriaLabels: string[], variantLabels: string[]) {
  const parsed = await sendMessageJSON({
    system: EFFECT_RATING_VARIANTS_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItem base: ${baseName}\nVariantes (nesta ordem): ${variantLabels.join(", ")}\nCritérios (nesta ordem): ${criteriaLabels.join(", ")}`,
    maxTokens: 350 + 250 * variantLabels.length,
  });
  if (!Array.isArray(parsed.variants) || parsed.variants.length !== variantLabels.length) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.variants.map((v: any) => v.ratings);
}

/* ------------------------------------------------------- avaliação com cache global */

function variantFullName(baseName: string, variantLabel?: string) {
  return variantLabel ? `${baseName} (${variantLabel})` : baseName;
}

/** Quantos critérios de um item ainda exigem chamada à API — usado pra estimar o custo do lote antes de disparar. */
export async function countUncachedCriteria(itemName: string, criteriaLabels: string[]) {
  const hits = await Promise.all(criteriaLabels.map((label) => getCachedRating(itemName, label)));
  return hits.filter((h) => !h).length;
}

/**
 * Igual a `fetchItemRatings`, mas passa pelo cache global (ver ratingCache.js):
 * só os critérios sem estimativa guardada vão pra API, numa chamada só, e o
 * que voltar entra no cache. `force` ignora o cache e reavalia tudo.
 */
export async function fetchItemRatingsCached(
  itemName: string,
  domainContext: string,
  criteriaLabels: string[],
  { force = false }: { force?: boolean } = {}
) {
  const results: any[] = new Array(criteriaLabels.length).fill(null);

  if (!force) {
    const hits = await Promise.all(criteriaLabels.map((label) => getCachedRating(itemName, label)));
    hits.forEach((hit, i) => {
      if (hit) results[i] = { criterion: criteriaLabels[i], ...hit, cached: true };
    });
  }

  const missing = criteriaLabels.map((label, i) => ({ label, i })).filter(({ i }) => !results[i]);
  if (missing.length) {
    const fresh = await fetchItemRatings(itemName, domainContext, missing.map((m) => m.label));
    for (let k = 0; k < missing.length; k++) {
      const { label, i } = missing[k];
      const found = fresh.find((r: any) => r.criterion === label) || fresh[k];
      const entry = {
        criterion: label,
        value: found?.value ?? 0,
        reason: found?.reason || "",
        probability: found?.probability,
        confidence: found?.confidence,
      };
      results[i] = entry;
      // eslint-disable-next-line no-await-in-loop
      await putCachedRating(itemName, label, entry);
    }
  }
  return results;
}

/**
 * Variantes com cache: se TODAS as variantes já têm todos os critérios em
 * cache, não gasta chamada nenhuma; se falta qualquer coisa, faz a chamada
 * única de variantes (mais barata que uma por variante) e guarda o resultado
 * inteiro no cache.
 */
export async function fetchItemRatingsForVariantsCached(
  baseName: string,
  domainContext: string,
  criteriaLabels: string[],
  variantLabels: string[]
) {
  const perVariantHits = await Promise.all(
    variantLabels.map((variant) => Promise.all(criteriaLabels.map((label) => getCachedRating(variantFullName(baseName, variant), label))))
  );
  const allCached = perVariantHits.every((hits) => hits.every(Boolean));
  if (allCached) {
    return perVariantHits.map((hits) => hits.map((hit, i) => ({ criterion: criteriaLabels[i], ...hit, cached: true })));
  }

  const fresh = await fetchItemRatingsForVariants(baseName, domainContext, criteriaLabels, variantLabels);
  for (let v = 0; v < variantLabels.length; v++) {
    const name = variantFullName(baseName, variantLabels[v]);
    for (let ci = 0; ci < criteriaLabels.length; ci++) {
      const label = criteriaLabels[ci];
      const found = (fresh[v] || []).find((r: any) => r.criterion === label) || (fresh[v] || [])[ci];
      if (!found) continue;
      // eslint-disable-next-line no-await-in-loop
      await putCachedRating(name, label, found);
    }
  }
  return fresh;
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
export async function fetchEffectSuggestions(domainContext: string, activeItems: any[], targetCriteria: any[]) {
  const activeSummary = (activeItems || [])
    .map((it) => `${it.name} (${Object.entries(it.ratings || {}).map(([c, v]) => `${c}: ${(v as number) > 0 ? "+" : ""}${v}`).join(", ")})`)
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

/* ------------------------------------------------------- explicações sob demanda */

export const CRITERION_EFFECT_SYSTEM_PROMPT = `Você explica, de forma curta, por que um item específico tem o efeito que tem sobre UM critério, num app pessoal de acompanhamento de efeitos.
Dado o domínio, o item, o critério e a nota atual (-5 a +5) atribuída a ele nesse critério, explique o MECANISMO por trás — por que esse item afeta esse critério nessa direção e nessa intensidade.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "text": de 2 a 4 linhas de texto corrido em português (aproximadamente 35 a 65 palavras), específico e concreto — mecanismo fisiológico, bioquímico, biomecânico ou comportamental, o que se aplicar. Nada de conselho genérico.

Formato exato (sem campos extras):
{"text":"..."}`;

/** Explica por que um item tem a magnitude de efeito atual (valor editado/atual) num critério. */
export async function fetchCriterionEffectExplanation(itemLabel: string, domainContext: string, criterionLabel: string, value: number) {
  const parsed = await sendMessageJSON({
    system: CRITERION_EFFECT_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItem: ${itemLabel}\nCritério: ${criterionLabel}\nNota atual: ${value > 0 ? "+" : ""}${value}`,
    maxTokens: 400,
  });
  if (!parsed.text) throw new Error("Formato inesperado na resposta");
  return parsed.text;
}

export const PERSONAL_DEVIATION_SYSTEM_PROMPT = `Você ajuda alguém a entender por que a experiência PESSOAL dela com um item diverge da estimativa que uma IA deu, num app pessoal de acompanhamento de efeitos.
Dado o domínio, o item, o critério, a nota que a IA estimou e a nota que a pessoa registrou pela própria sensação, liste possíveis motivos REAIS e específicos para essa diferença — variação individual (genética, tolerância, dosagem, sensibilidade), contexto de uso, interação com outros fatores, ou a estimativa da IA sendo baseada numa média populacional que não bate com este caso.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "text": de 2 a 4 linhas de texto corrido em português (aproximadamente 35 a 65 palavras), com 1 a 3 motivos plausíveis e específicos — não genéricos ("cada pessoa é diferente" sozinho não vale).

Formato exato (sem campos extras):
{"text":"..."}`;

/** Explica possíveis motivos para o valor pessoal do usuário divergir da estimativa original da IA. */
export async function fetchPersonalDeviationExplanation(
  itemLabel: string,
  domainContext: string,
  criterionLabel: string,
  originalValue: number,
  personalValue: number
) {
  const parsed = await sendMessageJSON({
    system: PERSONAL_DEVIATION_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItem: ${itemLabel}\nCritério: ${criterionLabel}\nEstimativa da IA: ${originalValue > 0 ? "+" : ""}${originalValue}\nMinha nota pessoal: ${personalValue > 0 ? "+" : ""}${personalValue}`,
    maxTokens: 400,
  });
  if (!parsed.text) throw new Error("Formato inesperado na resposta");
  return parsed.text;
}

/* ------------------------------------------------------- sugestões a partir de um item */

export const COUNTERBALANCE_SYSTEM_PROMPT = `Você sugere itens que CONTRABALANCEM os efeitos negativos ou nulos de outro item específico, num app pessoal de acompanhamento de efeitos (suplementos, alimentos, exercícios, práticas).
Dado o domínio, o item de referência e os critérios em que ele tem efeito negativo ou nulo (com a nota de cada), sugira exatamente 3 itens que compensem especificamente esses pontos fracos — sem repetir o item de referência.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "name": nome curto do item sugerido.
- "reason": até 16 palavras, dizendo qual ponto fraco do item de referência esse item compensa e como.
- Retorne EXATAMENTE 3 sugestões.

Formato exato (sem campos extras):
{"suggestions":[{"name":"...","reason":"..."}]}`;

/** Sugere 3 itens que contrabalancem os efeitos negativos/nulos de um item de referência. */
export async function fetchCounterbalanceSuggestions(domainContext: string, itemLabel: string, negativeCriteria: any[]) {
  const summary = (negativeCriteria || []).map((c) => `${c.label}: ${c.value > 0 ? "+" : ""}${c.value}`).join(", ");
  const parsed = await sendMessageJSON({
    system: COUNTERBALANCE_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItem de referência: ${itemLabel}\nPontos fracos (critério: nota): ${summary || "nenhum"}`,
    maxTokens: 500,
  });
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.suggestions;
}

export const SIMILAR_EFFECT_SYSTEM_PROMPT = `Você sugere itens com a MESMA combinação de efeitos fortemente positivos de outro item específico, num app pessoal de acompanhamento de efeitos (suplementos, alimentos, exercícios, práticas).
Dado o domínio, o item de referência e os critérios em que ele tem efeito fortemente positivo (nota +3 a +5, com a nota de cada), sugira exatamente 3 itens ALTERNATIVOS que produzam essa MESMA assinatura de efeitos positivos — úteis como substitutos ou opções equivalentes. Não repita o item de referência.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "name": nome curto do item sugerido.
- "reason": até 16 palavras, dizendo por que produz efeito parecido nesses critérios.
- Retorne EXATAMENTE 3 sugestões.

Formato exato (sem campos extras):
{"suggestions":[{"name":"...","reason":"..."}]}`;

/** Sugere 3 itens alternativos com a mesma assinatura de efeitos fortemente positivos de um item de referência. */
export async function fetchSimilarEffectSuggestions(domainContext: string, itemLabel: string, positiveCriteria: any[]) {
  const summary = (positiveCriteria || []).map((c) => `${c.label}: +${c.value}`).join(", ");
  const parsed = await sendMessageJSON({
    system: SIMILAR_EFFECT_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItem de referência: ${itemLabel}\nPontos fortes (critério: nota): ${summary || "nenhum"}`,
    maxTokens: 500,
  });
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.suggestions;
}

/* ------------------------------------------------------- interação entre pares de itens ativos */

export const PAIR_INTERACTION_SYSTEM_PROMPT = `Você avalia se existe INTERAÇÃO (sinergia ou antagonismo) entre DOIS itens específicos (suplementos, alimentos, exercícios, práticas) usados JUNTOS, além do que a soma simples das notas individuais já capturaria, num app pessoal de acompanhamento de efeitos.
Dado o domínio, os dois itens e a lista de critérios, avalie para CADA critério um AJUSTE de -2 a +2 que representa o efeito de interação (sinergia = ajuste positivo além da soma; antagonismo/interferência = ajuste negativo). Use 0 quando não houver interação conhecida ou relevante nesse critério — a maioria dos pares na maioria dos critérios deve ter ajuste 0.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "value": ajuste de -2 a +2 por critério.
- "reason": até 14 palavras, só quando "value" for diferente de 0; string vazia "" quando "value" for 0.
- Retorne EXATAMENTE um item em "adjustments" para cada critério informado, na mesma ordem.

Formato exato (sem campos extras):
{"adjustments":[{"criterion":"...","value":0,"reason":"..."}]}`;

/** Avalia a interação (sinergia/antagonismo) entre dois itens ativos, além da soma simples. */
export async function fetchPairInteraction(domainContext: string, itemALabel: string, itemBLabel: string, criteriaLabels: string[]) {
  const parsed = await sendMessageJSON({
    system: PAIR_INTERACTION_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItem A: ${itemALabel}\nItem B: ${itemBLabel}\nCritérios (nesta ordem): ${criteriaLabels.join(", ")}`,
    maxTokens: 500,
  });
  if (!Array.isArray(parsed.adjustments)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.adjustments;
}

/* ------------------------------------------------------- comparação entre dois itens (aba Comparar) */

export const COMPARISON_MECHANISM_SYSTEM_PROMPT = `Você explica, de forma curta, o MECANISMO por trás do efeito de DOIS itens específicos (suplementos, alimentos, exercícios, práticas) nos critérios de um app pessoal de acompanhamento de efeitos, pra ajudar numa comparação lado a lado.
Dado o domínio, os dois itens (cada um com suas notas por critério) e a lista de critérios, explique o mecanismo de CADA item separadamente — fisiológico, bioquímico, biomecânico ou comportamental, o que se aplicar.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "itemA" e "itemB": de 2 a 4 linhas de texto corrido em português (aproximadamente 35 a 60 palavras) cada, específico e concreto. Nada de conselho genérico.

Formato exato (sem campos extras):
{"itemA":"...","itemB":"..."}`;

/** Explica o mecanismo de efeito de cada um dos dois itens sendo comparados. */
export async function fetchComparisonMechanism(
  domainContext: string,
  itemALabel: string,
  itemARatingsSummary: string,
  itemBLabel: string,
  itemBRatingsSummary: string,
  criteriaLabels: string[]
) {
  const parsed = await sendMessageJSON({
    system: COMPARISON_MECHANISM_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nCritérios: ${criteriaLabels.join(", ")}\nItem A: ${itemALabel} (${itemARatingsSummary})\nItem B: ${itemBLabel} (${itemBRatingsSummary})`,
    maxTokens: 500,
  });
  if (!parsed.itemA || !parsed.itemB) throw new Error("Formato inesperado na resposta");
  return parsed;
}

export const COMPARISON_VERDICT_SYSTEM_PROMPT = `Você compara DOIS itens específicos (suplementos, alimentos, exercícios, práticas) já avaliados nos mesmos critérios, num app pessoal de acompanhamento de efeitos, e explica de forma direta qual se sai melhor e por quê.
Dado o domínio, os dois itens (cada um com suas notas por critério, já ponderadas pela importância que o usuário deu a cada critério) e a lista de critérios, explique o veredito: qual item é preferível NO GERAL considerando esse conjunto de critérios e pesos, e o principal motivo — sem ignorar em quais critérios específicos cada um se sai melhor.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "text": de 3 a 5 linhas de texto corrido em português (aproximadamente 45 a 80 palavras), direto, mencionando os critérios decisivos.

Formato exato (sem campos extras):
{"text":"..."}`;

/** Explica qual dos dois itens é preferível no geral (considerando os pesos dos critérios) e por quê. */
export async function fetchComparisonVerdict(
  domainContext: string,
  itemALabel: string,
  itemARatingsSummary: string,
  itemBLabel: string,
  itemBRatingsSummary: string,
  criteriaLabels: string[]
) {
  const parsed = await sendMessageJSON({
    system: COMPARISON_VERDICT_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nCritérios (com peso): ${criteriaLabels.join(", ")}\nItem A: ${itemALabel} (${itemARatingsSummary})\nItem B: ${itemBLabel} (${itemBRatingsSummary})`,
    maxTokens: 500,
  });
  if (!parsed.text) throw new Error("Formato inesperado na resposta");
  return parsed.text;
}

export const COMPARISON_SCENARIOS_SYSTEM_PROMPT = `Você lista SITUAÇÕES/CASOS de uso em que cada um de DOIS itens específicos (suplementos, alimentos, exercícios, práticas) se destaca ou ganha vantagem sobre o outro, num app pessoal de acompanhamento de efeitos.
Dado o domínio, os dois itens (cada um com suas notas por critério) e a lista de critérios, gere de 2 a 4 situações concretas pra CADA item no formato "Escolha [item] se: ...".

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "itemA" e "itemB": array de 2 a 4 strings cada, cada string já no formato "Escolha ITEM se: situação concreta" (até 20 palavras).

Formato exato (sem campos extras):
{"itemA":["Escolha ... se: ..."],"itemB":["Escolha ... se: ..."]}`;

/** Lista situações concretas em que cada item se destaca em relação ao outro. */
export async function fetchComparisonScenarios(
  domainContext: string,
  itemALabel: string,
  itemARatingsSummary: string,
  itemBLabel: string,
  itemBRatingsSummary: string,
  criteriaLabels: string[]
) {
  const parsed = await sendMessageJSON({
    system: COMPARISON_SCENARIOS_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nCritérios: ${criteriaLabels.join(", ")}\nItem A: ${itemALabel} (${itemARatingsSummary})\nItem B: ${itemBLabel} (${itemBRatingsSummary})`,
    maxTokens: 600,
  });
  if (!Array.isArray(parsed.itemA) || !Array.isArray(parsed.itemB)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

/* ------------------------------------------------------- diagnóstico, planejamento e mapa causal */

export const REVERSE_DIAGNOSIS_SYSTEM_PROMPT = `Você ajuda a diagnosticar CAUSAS PROVÁVEIS de um efeito (ou conjunto de efeitos) observado, num app pessoal de acompanhamento de efeitos (suplementos, alimentos, exercícios, práticas, estados fisiológicos ou psicológicos).
Dado o domínio e um ou mais critérios observados (cada um com a direção em que foi observado — "mais" ou "menos" do que o normal), liste de 3 a 6 causas candidatas plausíveis. Priorize causas que expliquem VÁRIOS dos critérios observados ao mesmo tempo, quando fizer sentido, sobre causas que só explicam um.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "name": nome curto da causa candidata (item, hábito, condição ou fenômeno).
- "explainsCount": quantos dos critérios observados essa causa plausivelmente explica.
- "estimatedRatings": nota de -5 a +5 que essa causa teria em CADA critério observado, nesta ordem (coerente com a direção observada).
- "probability": "raro", "possivel", "provavel" ou "quase_certo" — nunca um número.
- "confidence": "anedota", "mecanismo", "estudo" ou "consenso".
- "reason": até 18 palavras.
- Retorne EXATAMENTE 3 a 6 itens em "causes", ordenados da causa mais provável pra menos provável.

Formato exato (sem campos extras):
{"causes":[{"name":"...","explainsCount":1,"estimatedRatings":[0],"probability":"provavel","confidence":"mecanismo","reason":"..."}]}`;

/** "O que pode estar causando isso (ou esse conjunto de efeitos)?" — cobre tanto 1 critério quanto uma síndrome de vários. */
export async function fetchReverseDiagnosis(domainContext: string, observedCriteria: any[]) {
  const summary = observedCriteria.map((c) => `${c.direction} ${c.label}`).join(", ");
  const parsed = await sendMessageJSON({
    system: REVERSE_DIAGNOSIS_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nCritérios observados (nesta ordem): ${observedCriteria.map((c) => c.label).join(", ")}\nObservação: ${summary}`,
    maxTokens: 900,
  });
  if (!Array.isArray(parsed.causes)) throw new Error("Formato inesperado na resposta");
  return parsed.causes;
}

export const GOAL_PATHS_SYSTEM_PROMPT = `Você recomenda AÇÕES pra alcançar um objetivo definido em critérios, num app pessoal de acompanhamento de efeitos.
Dado o domínio e um ou mais critérios-alvo (cada um com a direção desejada), sugira de 3 a 6 ações concretas (itens, hábitos ou práticas), ordenadas da mais efetiva pra menos efetiva.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "name": nome curto da ação.
- "estimatedRatings": nota de -5 a +5 que essa ação teria em CADA critério-alvo, nesta ordem.
- "probability": "raro", "possivel", "provavel" ou "quase_certo".
- "confidence": "anedota", "mecanismo", "estudo" ou "consenso".
- "reason": até 18 palavras, mencionando o principal trade-off se houver.
- Retorne EXATAMENTE 3 a 6 itens em "paths", já ordenados por efetividade.

Formato exato (sem campos extras):
{"paths":[{"name":"...","estimatedRatings":[0],"probability":"provavel","confidence":"mecanismo","reason":"..."}]}`;

/** "O que devo fazer para alcançar y (ou esse conjunto de objetivos)?" */
export async function fetchGoalPaths(domainContext: string, targetCriteria: any[]) {
  const summary = targetCriteria.map((c) => `${c.direction} ${c.label}`).join(", ");
  const parsed = await sendMessageJSON({
    system: GOAL_PATHS_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nCritérios-alvo (nesta ordem): ${targetCriteria.map((c) => c.label).join(", ")}\nObjetivo: quero ${summary}`,
    maxTokens: 900,
  });
  if (!Array.isArray(parsed.paths)) throw new Error("Formato inesperado na resposta");
  return parsed.paths;
}

export const FORWARD_CONSEQUENCES_SYSTEM_PROMPT = `Você lista CONSEQUÊNCIAS prováveis de um item, hábito ou estado específico, num app pessoal de acompanhamento de efeitos.
Dado o domínio e a coisa de referência (com um resumo do que ela já afeta, se houver), liste de 3 a 6 consequências plausíveis — efeitos que ELA causa em outras coisas (critérios, estados ou fenômenos), incluindo consequências não óbvias/indiretas quando fizer sentido.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "label": nome curto da consequência (um critério/estado/fenômeno, não uma ação).
- "magnitude": intensidade de -5 a +5 (negativo = piora/reduz a consequência, positivo = melhora/aumenta).
- "probability": "raro", "possivel", "provavel" ou "quase_certo".
- "confidence": "anedota", "mecanismo", "estudo" ou "consenso".
- "latency": tempo até aparecer — "imediato", "horas", "dias", "semanas" ou "meses".
- "reason": até 18 palavras.
- Retorne EXATAMENTE 3 a 6 itens em "consequences".

Formato exato (sem campos extras):
{"consequences":[{"label":"...","magnitude":0,"probability":"provavel","confidence":"mecanismo","latency":"dias","reason":"..."}]}`;

/** "Quais consequências isso (ou esse conjunto de coisas) pode causar?" */
export async function fetchForwardConsequences(domainContext: string, referenceLabel: string, referenceSummary?: string) {
  const parsed = await sendMessageJSON({
    system: FORWARD_CONSEQUENCES_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nReferência: ${referenceLabel}${referenceSummary ? ` (${referenceSummary})` : ""}`,
    maxTokens: 900,
  });
  if (!Array.isArray(parsed.consequences)) throw new Error("Formato inesperado na resposta");
  return parsed.consequences;
}

export const PROGNOSIS_SYSTEM_PROMPT = `Você estima o PROGNÓSTICO de alcançar um objetivo tendo feito uma ação específica, num app pessoal de acompanhamento de efeitos.
Dado o domínio, a ação feita e o critério-alvo, estime a probabilidade de alcançar o objetivo, em quanto tempo, e em que magnitude.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "probability": "raro", "possivel", "provavel" ou "quase_certo" — nunca um número.
- "timeframe": texto curto (ex.: "2 a 4 semanas de uso contínuo").
- "expectedMagnitude": nota de -5 a +5 esperada no critério-alvo.
- "confidence": "anedota", "mecanismo", "estudo" ou "consenso".
- "reason": de 2 a 3 linhas explicando o raciocínio (até 60 palavras).

Formato exato (sem campos extras):
{"probability":"provavel","timeframe":"...","expectedMagnitude":0,"confidence":"mecanismo","reason":"..."}`;

/** "Qual a probabilidade de alcançar y tendo feito x, em quanto tempo e em que grau?" */
export async function fetchPrognosis(domainContext: string, actionLabel: string, targetCriterionLabel: string) {
  const parsed = await sendMessageJSON({
    system: PROGNOSIS_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nAção feita: ${actionLabel}\nCritério-alvo: ${targetCriterionLabel}`,
    maxTokens: 500,
  });
  if (!parsed.probability || !parsed.reason) throw new Error("Formato inesperado na resposta");
  return parsed;
}

export const PROTOCOL_SYSTEM_PROMPT = `Você recomenda o PROTOCOLO de uso de um item específico pra alcançar critérios-alvo, num app pessoal de acompanhamento de efeitos.
Dado o domínio, o item e os critérios-alvo, recomende intensidade/dose, frequência, duração do uso, ordem relativa a outras coisas (se relevante) e o melhor momento.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "intensity": dose/intensidade recomendada, texto curto.
- "frequency": frequência recomendada, texto curto.
- "duration": por quanto tempo manter, texto curto.
- "order": quando fazer em relação a outras coisas (ex.: "em jejum", "após o treino"), texto curto — "" se não houver recomendação específica.
- "timing": melhor momento do dia, texto curto — "" se não houver recomendação específica.
- "reason": até 25 palavras explicando o porquê do protocolo.

Formato exato (sem campos extras):
{"intensity":"...","frequency":"...","duration":"...","order":"","timing":"","reason":"..."}`;

/** "De que maneira devo fazer isso? Em qual ordem, intensidade, duração e frequência?" */
export async function fetchProtocol(domainContext: string, itemLabel: string, targetCriteria?: any[]) {
  const summary = (targetCriteria || []).map((c) => `${c.direction} ${c.label}`).join(", ");
  const parsed = await sendMessageJSON({
    system: PROTOCOL_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItem: ${itemLabel}\nCritérios-alvo: ${summary || "melhora geral"}`,
    maxTokens: 500,
  });
  if (!parsed.reason) throw new Error("Formato inesperado na resposta");
  return parsed;
}

export const INDICATORS_SYSTEM_PROMPT = `Você lista SINAIS que indicam se algo está sendo feito certo ou errado, num app pessoal de acompanhamento de efeitos.
Dado o domínio e o item/objetivo de referência, liste sinais concretos e observáveis de que está funcionando bem, e sinais de que está funcionando mal ou precisa de ajuste.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "positive": array de 2 a 4 strings curtas, sinais concretos de que está indo bem.
- "negative": array de 2 a 4 strings curtas, sinais concretos de que algo está errado ou precisa ajuste.

Formato exato (sem campos extras):
{"positive":["..."],"negative":["..."]}`;

/** "Como posso saber se estou fazendo certo ou errado?" */
export async function fetchIndicators(domainContext: string, referenceLabel: string) {
  const parsed = await sendMessageJSON({
    system: INDICATORS_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nReferência: ${referenceLabel}`,
    maxTokens: 450,
  });
  if (!Array.isArray(parsed.positive) || !Array.isArray(parsed.negative)) throw new Error("Formato inesperado na resposta");
  return parsed;
}

export const DIRECTION_ARBITRATION_SYSTEM_PROMPT = `Você arbitra a DIREÇÃO CAUSAL provável entre dois critérios específicos, num app pessoal de acompanhamento de efeitos.
Dado o domínio e os dois critérios (A e B), determine qual relação é mais plausível entre eles.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "direction": exatamente um destes textos — "a_causa_b" (A causa B), "b_causa_a" (B causa A), "bidirecional" (se retroalimentam) ou "confundida" (correlacionados por uma terceira causa, sem relação causal direta clara).
- "magnitude": nota de -5 a +5 do efeito na direção indicada (se "bidirecional" ou "confundida", a magnitude do efeito mais forte das duas direções).
- "probability": "raro", "possivel", "provavel" ou "quase_certo".
- "confidence": "anedota", "mecanismo", "estudo" ou "consenso".
- "reason": até 30 palavras explicando o raciocínio.

Formato exato (sem campos extras):
{"direction":"a_causa_b","magnitude":0,"probability":"provavel","confidence":"mecanismo","reason":"..."}`;

/** "Entre esses itens/critérios, quem é a causa e quem é a consequência?" */
export async function fetchDirectionArbitration(domainContext: string, labelA: string, labelB: string) {
  const parsed = await sendMessageJSON({
    system: DIRECTION_ARBITRATION_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nA: ${labelA}\nB: ${labelB}`,
    maxTokens: 400,
  });
  if (!parsed.direction || !parsed.reason) throw new Error("Formato inesperado na resposta");
  return parsed;
}

export const CONVERSATION_EXTRACTION_SYSTEM_PROMPT = `Você extrai ITENS, CRITÉRIOS e RELAÇÕES CAUSAIS de um trecho de conversa colado por um usuário, pra alimentar um app pessoal de acompanhamento de efeitos e relações causais.
Dado o domínio e o texto colado, identifique: itens/ações/coisas concretas mencionadas (candidatos a "item"), critérios/estados/efeitos mencionados (candidatos a "critério"), e relações causais explícitas ou fortemente implícitas entre eles.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "items": array de até 6 nomes curtos de itens/ações mencionados no texto.
- "criteria": array de até 6 nomes curtos de critérios/estados/efeitos mencionados no texto.
- "edges": array de até 8 relações, cada uma com "from" (nome), "to" (nome), "magnitude" (-5 a +5), "probability" ("raro"/"possivel"/"provavel"/"quase_certo") e "reason" (até 16 palavras) — só relações que o texto realmente sustenta.
- Se o texto não sustentar nada em alguma categoria, retorne array vazio pra ela.

Formato exato (sem campos extras):
{"items":["..."],"criteria":["..."],"edges":[{"from":"...","to":"...","magnitude":0,"probability":"provavel","reason":"..."}]}`;

/** Extrai nós/arestas candidatos de um trecho de conversa colado (ex.: do Claude), pra revisão e aprovação manual. */
export async function fetchConversationExtraction(domainContext: string, pastedText: string) {
  const parsed = await sendMessageJSON({
    system: CONVERSATION_EXTRACTION_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nTexto colado:\n${pastedText.slice(0, 6000)}`,
    maxTokens: 1000,
  });
  if (!Array.isArray(parsed.items) || !Array.isArray(parsed.criteria) || !Array.isArray(parsed.edges)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}
