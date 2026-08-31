/**
 * Migração de esquema dos perfis de efeito.
 *
 * Antes, cada campo novo (peso do critério, `ratingMeta`, `interactions`,
 * `criteriaLinks`, protocolo, custo...) era defendido com `|| {}` e `?? 1`
 * espalhados por todo o código de leitura. Aqui os dados antigos são
 * normalizados UMA vez, na carga (ver `useEffectProfiles`), e o resto do app
 * pode assumir a forma completa.
 *
 * Regra: migração nunca perde dado — só preenche o que falta e alinha o
 * tamanho dos arrays por variante.
 */

export const SCHEMA_VERSION = 3;

function padArray(arr: any, length: number, make: () => any) {
  const out = Array.isArray(arr) ? arr.slice(0, length) : [];
  while (out.length < length) out.push(make());
  return out.map((entry: any) => (entry && typeof entry === "object" ? entry : make()));
}

function migrateCriterion(criterion: any) {
  return {
    ...criterion,
    label: criterion.label || "",
    weight: criterion.weight == null ? 1 : Math.max(0, Math.min(3, Math.round(criterion.weight))),
    /** Antes era estado local da tela (some dos cards mas continua contando no total). Agora mora no perfil e sobrevive ao recarregar. */
    hidden: !!criterion.hidden,
  };
}

function migrateItem(item: any) {
  const variantLabels = Array.isArray(item.variantLabels) ? item.variantLabels : [];
  const count = Math.max(1, variantLabels.length || (Array.isArray(item.ratings) ? item.ratings.length : 1));
  const ratings = padArray(item.ratings, count, () => ({}));
  return {
    ...item,
    name: item.name || "",
    active: item.active !== false,
    hidden: !!item.hidden,
    note: item.note || "",
    variantLabels,
    activeVariantIndex: Math.min(Math.max(item.activeVariantIndex || 0, 0), count - 1),
    ratings,
    originalRatings: padArray(item.originalRatings, count, () => ({})),
    reasons: padArray(item.reasons, count, () => ({})),
    ratingMeta: padArray(item.ratingMeta, count, () => ({})),
    explainCache: padArray(item.explainCache, count, () => ({})),
    aiEvaluated: Array.from({ length: count }, (_, i) => !!(item.aiEvaluated || [])[i]),
    protocol: item.protocol || null,
    indicators: item.indicators || null,
    /** Custo/atrito do item — ver `itemCostIndex` em effectProfiles.js. */
    cost: item.cost || null,
  };
}

export function migrateProfile(profile: any) {
  if (!profile || typeof profile !== "object") return null;
  if (profile.schemaVersion === SCHEMA_VERSION) return profile;
  return {
    ...profile,
    schemaVersion: SCHEMA_VERSION,
    name: profile.name || "Perfil",
    createdAt: profile.createdAt || Date.now(),
    criteria: (Array.isArray(profile.criteria) ? profile.criteria : []).map(migrateCriterion),
    items: (Array.isArray(profile.items) ? profile.items : []).map(migrateItem),
    interactions: profile.interactions || {},
    comparisons: profile.comparisons || {},
    criteriaLinks: profile.criteriaLinks || {},
    /** Registros de resultado observado (ver lib/checkins.js). */
    checkins: Array.isArray(profile.checkins) ? profile.checkins : [],
    /** Saturação do efeito combinado (retornos decrescentes) — desligada por padrão pra não mudar números já existentes. */
    saturation: !!profile.saturation,
  };
}

export function migrateProfiles(map: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [id, profile] of Object.entries(map || {})) {
    const migrated = migrateProfile(profile);
    if (migrated) out[id] = { ...migrated, id: migrated.id || id };
  }
  return out;
}
