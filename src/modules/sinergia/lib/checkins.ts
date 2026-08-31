/**
 * Check-ins: o resultado REAL, medido por você, contra o que o perfil previu.
 *
 * Sem isso o app só estima e nunca confere — "Anedota → Consenso" vira rótulo
 * decorativo. Um check-in congela três coisas: quais itens estavam ativos (e
 * em qual variante), o efeito PREVISTO naquele momento e a nota OBSERVADA que
 * você deu a cada critério, na mesma escala -5..+5.
 *
 * Previsto e observado só são comparáveis depois de passar o previsto por
 * `saturate` — a soma bruta pode valer +15 numa escala que vai até +5. Por
 * isso a calibração satura sempre, mesmo em perfil sem saturação ligada.
 */
import { computeCombinedEffect, currentVariantIndex, saturate } from "./effectProfiles";

export function createCheckIn(profile: any, observed: any, note = "") {
  const activeIds = (profile.items || []).filter((it: any) => it.active).map((it: any) => it.id);
  const variantIndices: Record<string, number> = {};
  for (const item of profile.items || []) {
    if (item.active) variantIndices[item.id] = currentVariantIndex(item);
  }
  return {
    id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    activeIds,
    variantIndices,
    /** Previsto no momento do registro — congelado de propósito: editar notas depois não pode reescrever o passado. */
    predicted: computeCombinedEffect(profile),
    observed: observed || {},
    note: note || "",
  };
}

export function checkInList(profile: any) {
  return [...(profile.checkins || [])].sort((a: any, b: any) => b.at - a.at);
}

/** Erro de um check-in num critério: observado − previsto (ambos na escala -5..+5). Positivo = melhor do que o previsto. */
export function checkInError(checkIn: any, criterionId: string) {
  const observed = checkIn.observed?.[criterionId];
  if (observed == null) return null;
  return Math.round((observed - saturate(checkIn.predicted?.[criterionId] || 0)) * 10) / 10;
}

function mean(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

/** Calibração por critério: quantos check-ins, viés médio (previsto otimista ou pessimista) e erro absoluto médio. */
export function criterionCalibration(profile: any) {
  const list = profile.checkins || [];
  return (profile.criteria || []).map((c: any) => {
    const errors = list.map((ci: any) => checkInError(ci, c.id)).filter((e: any) => e != null);
    return {
      criterion: c,
      n: errors.length,
      bias: mean(errors),
      absError: mean(errors.map(Math.abs)),
    };
  });
}

/**
 * Divergência por item — heurística, não medida limpa: o erro de um check-in é
 * atribuído a cada item ATIVO nele, só nos critérios em que aquele item declara
 * algum efeito. Com poucos check-ins isso é ruído; com muitos, um item que
 * aparece sempre associado a erro no mesmo sentido é candidato a ter a nota
 * ajustada. Por isso `n` vem junto e a lista exige pelo menos 2 registros.
 */
export function itemDivergence(profile: any, minCheckins = 2) {
  const list = profile.checkins || [];
  const out: any[] = [];
  for (const item of profile.items || []) {
    const errors: number[] = [];
    for (const ci of list) {
      if (!ci.activeIds?.includes(item.id)) continue;
      const variantIdx = ci.variantIndices?.[item.id] ?? currentVariantIndex(item);
      const ratings = (item.ratings && item.ratings[variantIdx]) || {};
      for (const c of profile.criteria || []) {
        if (!ratings[c.id]) continue;
        const err = checkInError(ci, c.id);
        if (err != null) errors.push(err);
      }
    }
    const n = list.filter((ci: any) => ci.activeIds?.includes(item.id)).length;
    if (n < minCheckins || !errors.length) continue;
    out.push({ item, n, bias: mean(errors), absError: mean(errors.map(Math.abs)) });
  }
  return out.sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));
}
