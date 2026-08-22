/**
 * Perfis de Efeito: grupos de itens (suplementos, alimentos, exercícios de
 * musculação, práticas físicas, ou qualquer outra coisa) avaliados nos
 * critérios que o usuário define (ex.: "energia", "raciocínio",
 * "ansiolítico"), numa escala de -5 (piora bastante o critério) a +5
 * (melhora bastante). O "efeito combinado" de um perfil é a SOMA das notas
 * de todos os itens marcados como `active` (o que você está tomando/fazendo
 * agora), critério por critério — permite simular combinações.
 */
import { slug } from "../theme";

const RATING_MIN = -5;
const RATING_MAX = 5;

export function initEffectProfiles() {
  return {};
}

export function createProfileId() {
  return `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueId(existingIds, base) {
  const clean = base || "item";
  let id = clean;
  let n = 2;
  while (existingIds.includes(id)) id = `${clean}-${n++}`;
  return id;
}

export function createCriterionId(existingIds, label) {
  return uniqueId(existingIds, slug(label));
}

export function createItemId(existingIds, name) {
  return uniqueId(existingIds, slug(name));
}

export function clampRating(value) {
  const n = Math.round(Number(value) || 0);
  return Math.max(RATING_MIN, Math.min(RATING_MAX, n));
}

/** Soma as notas dos itens ATIVOS de um perfil, critério por critério. */
export function computeCombinedEffect(profile) {
  const totals = {};
  for (const c of profile.criteria || []) totals[c.id] = 0;
  for (const item of profile.items || []) {
    if (!item.active) continue;
    for (const [critId, value] of Object.entries(item.ratings || {})) {
      if (critId in totals) totals[critId] += value;
    }
  }
  return totals;
}

export { RATING_MIN, RATING_MAX };
