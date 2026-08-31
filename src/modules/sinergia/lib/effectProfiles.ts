/**
 * Perfis de Efeito: grupos de itens (suplementos, alimentos, exercícios de
 * musculação, práticas físicas, ou qualquer outra coisa) avaliados nos
 * critérios que o usuário define (ex.: "energia", "raciocínio",
 * "ansiolítico"), numa escala de -5 (piora bastante o critério) a +5
 * (melhora bastante). O "efeito combinado" de um perfil é a SOMA das notas
 * de todos os itens marcados como `active` (o que você está tomando/fazendo
 * agora), critério por critério — permite simular combinações.
 *
 * Um item pode ter VARIANTES: nomes como "Pushup (Aberto/Fechado)" viram um
 * item só com uma tab por variante, cada uma com seu próprio jogo de notas —
 * pra comparar, no mesmo card, o efeito de cada variação. Sem variantes, o
 * item tem uma "variante" implícita só (arrays de tamanho 1).
 *
 * Cada nota guarda DOIS valores: a estimativa original da IA
 * (`originalRatings`, imutável após a criação) e o valor atual/editado por
 * você (`ratings`, o que conta pro efeito combinado e pode ser ajustado a
 * qualquer momento).
 */
import { slug } from "../theme";

const RATING_MIN = -5;
const RATING_MAX = 5;

export function initEffectProfiles(): Record<string, any> {
  return {};
}

export function createProfileId() {
  return `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueId(existingIds: string[], base: string) {
  const clean = base || "item";
  let id = clean;
  let n = 2;
  while (existingIds.includes(id)) id = `${clean}-${n++}`;
  return id;
}

export function createCriterionId(existingIds: string[], label: string) {
  return uniqueId(existingIds, slug(label));
}

export function createItemId(existingIds: string[], name: string) {
  return uniqueId(existingIds, slug(name));
}

export function clampRating(value: any) {
  const n = Math.round(Number(value) || 0);
  return Math.max(RATING_MIN, Math.min(RATING_MAX, n));
}

/**
 * Nomes com termos entre parênteses separados por "/" viram variantes, ex.:
 * "Pushup (Aberto/Fechado)" -> base "Pushup", variantes ["Aberto", "Fechado"].
 * Um único termo sem "/" (ex.: "Vitamina (C)") não conta como variante — o
 * nome inteiro é tratado literalmente, como sempre foi.
 */
export function parseItemNameVariants(raw?: string) {
  const clean = (raw || "").trim();
  const m = /^(.*)\(([^()]+)\)\s*$/.exec(clean);
  if (!m) return { base: clean, variants: [] as string[] };
  const base = m[1].trim();
  const inner = m[2];
  if (!base || !inner.includes("/")) return { base: clean, variants: [] as string[] };
  const variants = [...new Set(inner.split("/").map((s) => s.trim()).filter(Boolean))];
  if (variants.length < 2) return { base: clean, variants: [] as string[] };
  return { base, variants };
}

/**
 * Monta o item pronto para ser salvo — direto, sem tela intermediária de
 * rascunho. `perVariant` é um array alinhado com `variantLabels` (uma
 * entrada por variante); sem variantes, os arrays têm um elemento só.
 */
export function buildItem(
  id: string,
  name: string,
  { variantLabels = [] as string[], ratings, reasons, aiEvaluated, ratingMeta }: any = {}
) {
  const count = variantLabels.length || 1;
  const ratingsArr = ratings || Array.from({ length: count }, () => ({}));
  const reasonsArr = reasons || Array.from({ length: count }, () => ({}));
  const aiEvaluatedArr = aiEvaluated || Array.from({ length: count }, () => false);
  const ratingMetaArr = ratingMeta || Array.from({ length: count }, () => ({}));
  return {
    id,
    name,
    active: true,
    hidden: false,
    note: "",
    variantLabels,
    activeVariantIndex: 0,
    ratings: ratingsArr,
    originalRatings: ratingsArr.map((r: any) => ({ ...r })),
    reasons: reasonsArr,
    ratingMeta: ratingMetaArr,
    aiEvaluated: aiEvaluatedArr,
    explainCache: Array.from({ length: count }, () => ({})),
    protocol: null,
    indicators: null,
  };
}

export function currentVariantIndex(item: any) {
  const idx = item.activeVariantIndex || 0;
  const max = (item.ratings || [{}]).length - 1;
  return Math.min(Math.max(idx, 0), Math.max(max, 0));
}

export function currentRatings(item: any) {
  return (item.ratings && item.ratings[currentVariantIndex(item)]) || {};
}

export function currentOriginalRatings(item: any) {
  return (item.originalRatings && item.originalRatings[currentVariantIndex(item)]) || {};
}

export function currentReasons(item: any) {
  return (item.reasons && item.reasons[currentVariantIndex(item)]) || {};
}

export function currentAiEvaluated(item: any) {
  return !!(item.aiEvaluated && item.aiEvaluated[currentVariantIndex(item)]);
}

export function currentExplainCache(item: any) {
  return (item.explainCache && item.explainCache[currentVariantIndex(item)]) || {};
}

export function currentRatingMeta(item: any) {
  return (item.ratingMeta && item.ratingMeta[currentVariantIndex(item)]) || {};
}

/**
 * Probabilidade tratada como ORDEM DE GRANDEZA, nunca como percentual exato —
 * são só 4 faixas. `weight` é usado internamente pra valor esperado; nunca
 * exibir esse número na interface, só o `label`.
 */
export const PROBABILITY_BUCKETS = [
  { key: "raro", label: "Raro", weight: 0.15 },
  { key: "possivel", label: "Possível", weight: 0.4 },
  { key: "provavel", label: "Provável", weight: 0.65 },
  { key: "quase_certo", label: "Quase certo", weight: 0.9 },
];

export function probabilityWeight(key?: string) {
  return PROBABILITY_BUCKETS.find((b) => b.key === key)?.weight ?? PROBABILITY_BUCKETS[2].weight;
}

export function probabilityLabel(key?: string) {
  return PROBABILITY_BUCKETS.find((b) => b.key === key)?.label ?? "—";
}

export const CONFIDENCE_LEVELS = [
  { key: "anedota", label: "Anedota" },
  { key: "mecanismo", label: "Mecanismo plausível" },
  { key: "estudo", label: "Estudo" },
  { key: "consenso", label: "Consenso" },
];

export function confidenceLabel(key?: string) {
  return CONFIDENCE_LEVELS.find((c) => c.key === key)?.label ?? "—";
}

export const LATENCY_LEVELS = [
  { key: "imediato", label: "Imediato" },
  { key: "horas", label: "Horas" },
  { key: "dias", label: "Dias" },
  { key: "semanas", label: "Semanas" },
  { key: "meses", label: "Meses" },
];

export function latencyLabel(key?: string) {
  return LATENCY_LEVELS.find((l) => l.key === key)?.label ?? "—";
}

export const DURATION_LEVELS = [
  { key: "enquanto_ativo", label: "Enquanto ativo" },
  { key: "persiste", label: "Persiste depois" },
  { key: "permanente", label: "Permanente" },
];

export function durationLabel(key?: string) {
  return DURATION_LEVELS.find((d) => d.key === key)?.label ?? "—";
}

/** Valor esperado = magnitude × peso da faixa de probabilidade. Sem meta, assume probabilidade "provável" (padrão neutro). */
export function expectedValue(magnitude: number, probabilityKey?: string) {
  return (magnitude || 0) * probabilityWeight(probabilityKey);
}

/**
 * Saturação: retornos decrescentes. Somar notas cru faz 5 itens de +3 no mesmo
 * critério virarem +15, um efeito que não existe na prática — na maioria dos
 * domínios (suplemento, treino, hábito) o segundo item que empurra o mesmo
 * critério rende menos que o primeiro. `5·tanh(soma/5)` mantém o começo quase
 * linear e satura no teto da própria escala (±5). Opcional por perfil.
 */
export function saturate(value: number) {
  return Math.round(5 * Math.tanh((value || 0) / 5) * 10) / 10;
}

function applySaturation(profile: any, totals: Record<string, number>) {
  if (!profile?.saturation) return totals;
  const out: Record<string, number> = {};
  for (const [critId, value] of Object.entries(totals)) out[critId] = saturate(value);
  return out;
}

/** Soma as notas (valores atuais/editados) dos itens ATIVOS, critério por critério, mais os ajustes de interação entre pares ativos. */
export function computeCombinedEffect(profile: any) {
  const totals: Record<string, number> = {};
  for (const c of profile.criteria || []) totals[c.id] = 0;
  for (const item of profile.items || []) {
    if (!item.active) continue;
    const ratings = currentRatings(item);
    for (const [critId, value] of Object.entries(ratings) as [string, number][]) {
      if (critId in totals) totals[critId] += value;
    }
  }
  const activeIds = new Set((profile.items || []).filter((it: any) => it.active).map((it: any) => it.id));
  for (const inter of Object.values(profile.interactions || {}) as any[]) {
    if (!activeIds.has(inter.itemAId) || !activeIds.has(inter.itemBId)) continue;
    for (const [critId, value] of Object.entries(inter.adjustments || {}) as [string, number][]) {
      if (critId in totals) totals[critId] += value;
    }
  }
  return applySaturation(profile, totals);
}

/** Peso de um critério (0 a 3), padrão 1 quando não definido — critérios antigos continuam valendo o mesmo que sempre valeram. */
export function criterionWeight(criterion: any) {
  const w = criterion?.weight;
  return w == null ? 1 : Math.max(0, Math.min(3, Math.round(w)));
}

/** Pontuação de um item (variante atual): soma das notas atuais ponderadas pelo peso de cada critério. */
export function computeItemScore(item: any, criteria: any[]) {
  const ratings = currentRatings(item);
  return (criteria || []).reduce((sum, c) => sum + ((ratings as any)[c.id] || 0) * criterionWeight(c), 0);
}

/** Efeito combinado ponderado pelos pesos dos critérios — um número só pra comparar combinações. */
export function computeWeightedTotal(profile: any) {
  const totals = computeCombinedEffect(profile);
  const raw = (profile.criteria || []).reduce((sum: number, c: any) => sum + ((totals as any)[c.id] || 0) * criterionWeight(c), 0);
  return Math.round(raw * 10) / 10;
}

/** Máximo teórico do score ponderado — todo critério no teto da escala. Serve pra ler o score como % em vez de um inteiro solto. */
export function weightedMax(profile: any) {
  const max = combinedMax(profile);
  const sum = (profile.criteria || []).reduce((acc: number, c: any) => acc + max * criterionWeight(c), 0);
  return Math.max(1, sum);
}

/** Score como porcentagem do máximo teórico (pode ser negativa). */
export function scorePercent(profile: any) {
  return Math.round((computeWeightedTotal(profile) / weightedMax(profile)) * 100);
}

/** Um critério é "não avaliado" num item (variante atual) quando a chave nem existe nas notas — distinto de nota 0 real. */
export function isCriterionRated(item: any, criterionId: string) {
  const ratings = currentRatings(item);
  return criterionId in ratings;
}

/** Totais de um cenário congelado (ids ativos + variante escolhida por item), sem tocar no estado real do perfil. */
export function computeScenarioTotals(profile: any, scenario: any) {
  const totals: Record<string, number> = {};
  for (const c of profile.criteria || []) totals[c.id] = 0;
  if (!scenario) return totals;
  for (const item of profile.items || []) {
    if (!scenario.activeIds.includes(item.id)) continue;
    const variantIdx = scenario.variantIndices?.[item.id] ?? currentVariantIndex(item);
    const ratings = (item.ratings && item.ratings[variantIdx]) || {};
    for (const [critId, value] of Object.entries(ratings) as [string, number][]) {
      if (critId in totals) totals[critId] += value;
    }
  }
  return applySaturation(profile, totals);
}

/** Congela a seleção atual de itens ativos (e a variante escolhida de cada) como um cenário comparável. */
export function snapshotScenario(profile: any) {
  const activeIds = (profile.items || []).filter((it: any) => it.active).map((it: any) => it.id);
  const variantIndices: Record<string, number> = {};
  for (const item of profile.items || []) {
    if (item.active) variantIndices[item.id] = currentVariantIndex(item);
  }
  return { activeIds, variantIndices };
}

export function pairKey(itemAId: string, itemBId: string) {
  return [itemAId, itemBId].sort().join("::");
}

/**
 * Máximo teórico do efeito combinado — escala da barra proporcional. Com
 * saturação ligada o teto é a própria escala (±5); sem ela, é todos os ativos
 * batendo +5/-5 no mesmo critério MAIS o pior caso dos ajustes de interação
 * (que também entram no total e antes faziam a barra estourar 100%).
 */
export function combinedMax(profile: any) {
  if (profile?.saturation) return 5;
  const activeIds = new Set((profile.items || []).filter((it: any) => it.active).map((it: any) => it.id));
  const interactionMax = (Object.values(profile.interactions || {}) as any[]).reduce((sum: number, inter: any) => {
    if (!activeIds.has(inter.itemAId) || !activeIds.has(inter.itemBId)) return sum;
    const worst = (Object.values(inter.adjustments || {}) as number[]).reduce((m: number, v: number) => Math.max(m, Math.abs(v)), 0);
    return sum + worst;
  }, 0);
  return Math.max(1, activeIds.size * 5 + interactionMax);
}

/** Critérios em que o item (na variante atual) tem efeito negativo ou nulo. */
export function negativeOrNullCriteria(item: any, criteria: any[]) {
  const ratings = currentRatings(item);
  return (criteria || []).filter((c) => ((ratings as any)[c.id] || 0) <= 0).map((c) => ({ ...c, value: (ratings as any)[c.id] || 0 }));
}

/** Critérios em que o item (na variante atual) tem efeito fortemente positivo (+3 a +5). */
export function strongPositiveCriteria(item: any, criteria: any[]) {
  const ratings = currentRatings(item);
  return (criteria || []).filter((c) => ((ratings as any)[c.id] || 0) >= 3).map((c) => ({ ...c, value: (ratings as any)[c.id] || 0 }));
}

/**
 * Ligação causal entre dois CRITÉRIOS do mesmo perfil (ex.: "Sono ruim" ->
 * "Ansiedade"), separada das notas item->critério. Chave direcional
 * (from=>to), diferente de `pairKey` (que ordena e serve pra pares de
 * ITENS/interações, onde a ordem não importa).
 */
export function criterionLinkKey(fromId: string, toId: string) {
  return `${fromId}=>${toId}`;
}

export function criterionLinksList(profile: any) {
  return Object.entries(profile.criteriaLinks || {}).map(([key, link]: [string, any]) => ({ key, ...link }));
}

/**
 * Efeitos indiretos (2ª ordem): propaga o total de cada critério pelas
 * ligações causais critério->critério, até 2 saltos, com proteção contra
 * ciclo (nunca revisita o mesmo critério na mesma cadeia). Cada salto pesa
 * pela probabilidade da ligação — por isso o resultado já nasce como valor
 * esperado, não soma bruta.
 *
 * O salto é PROPORCIONAL ao valor que chega (`incomingValue / 5`, onde 5 é o
 * topo da escala): um critério em +1 propaga um quinto do que propaga em +5, e
 * o sinal do que chega inverte o efeito da ligação — sem duplicar o sinal, que
 * antes fazia total negativo propagar efeito positivo.
 */
export function computeSecondOrderEffects(profile: any, totals: Record<string, number>) {
  const links = criterionLinksList(profile);
  const result: Record<string, number> = {};
  for (const c of profile.criteria || []) result[c.id] = 0;

  function propagate(fromId: string, incomingValue: number, depth: number, visited: Set<string>) {
    if (depth > 2 || !incomingValue) return;
    for (const link of links) {
      if (link.fromId !== fromId || visited.has(link.toId)) continue;
      const step = expectedValue(link.magnitude, link.probability) * (incomingValue / RATING_MAX);
      if (!step) continue;
      if (link.toId in result) result[link.toId] += step;
      propagate(link.toId, step, depth + 1, new Set([...visited, link.toId]));
    }
  }

  for (const [critId, value] of Object.entries(totals || {})) {
    if (!value) continue;
    propagate(critId, value, 1, new Set([critId]));
  }
  return result;
}

/** Valor esperado de um item (variante atual): soma das notas ponderadas pelo peso do critério E pela probabilidade da faixa, quando houver meta. */
export function computeItemExpectedScore(item: any, criteria: any[]) {
  const ratings = currentRatings(item);
  const meta = currentRatingMeta(item);
  return (criteria || []).reduce((sum, c) => {
    const magnitude = (ratings as any)[c.id] || 0;
    const probabilityKey = (meta as any)[c.id]?.probability;
    return sum + expectedValue(magnitude, probabilityKey) * criterionWeight(c);
  }, 0);
}

/* ------------------------------------------------------- custo e custo-benefício */

/**
 * Referência de conversão pro índice de custo: quanto de cada dimensão vale
 * UMA unidade de custo. Números redondos e explícitos de propósito — o índice
 * só precisa ordenar itens entre si, não medir nada em absoluto.
 */
export const COST_REFERENCE = { money: 50, time: 20 };

/** Custo total de um item numa unidade só: R$/mês, minutos/dia e esforço (1-5) somados na mesma escala. 0 = sem custo registrado. */
export function itemCostIndex(item: any) {
  const cost = item?.cost || {};
  const money = Number(cost.money) || 0;
  const time = Number(cost.time) || 0;
  const effort = Number(cost.effort) || 0;
  return money / COST_REFERENCE.money + time / COST_REFERENCE.time + effort;
}

export function hasCost(item: any) {
  return itemCostIndex(item) > 0;
}

/**
 * Benefício por unidade de custo. O piso de 0,25 evita que um item de custo
 * quase zero domine a lista com um número gigante — abaixo disso o custo
 * deixa de discriminar qualquer coisa.
 */
export function computeItemBenefitPerCost(item: any, criteria: any[]) {
  const score = computeItemScore(item, criteria);
  return Math.round((score / Math.max(itemCostIndex(item), 0.25)) * 10) / 10;
}

/** Resumo curto do custo pra exibir no card ("R$ 30/mês · 15 min/dia · esforço 3"). */
export function costSummary(item: any) {
  const cost = item?.cost || {};
  const parts: string[] = [];
  if (Number(cost.money) > 0) parts.push(`R$ ${Number(cost.money)}/mês`);
  if (Number(cost.time) > 0) parts.push(`${Number(cost.time)} min/dia`);
  if (Number(cost.effort) > 0) parts.push(`esforço ${Number(cost.effort)}`);
  return parts.join(" · ");
}

export { RATING_MIN, RATING_MAX };
