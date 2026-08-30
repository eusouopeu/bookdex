/**
 * Preferências de relevância: itens que o usuário marcou como "pouco
 * relevante" num resultado de escaneamento. Guardado em storage
 * (KEYS.irrelevantItems) e usado para personalizar buscas futuras — tanto
 * dentro do mesmo assunto (exclusão direta) quanto entre assuntos (uma
 * lista curta e recente de "gosto" enviada como contexto pra API).
 *
 * Formato:
 *   { bySubject: { [subjectSlug]: { [itemId]: {name, mode, markedAt} } },
 *     recent: [{name, mode, subject, markedAt}] }
 */
const MAX_RECENT = 25;

export function initRelevanceState() {
  return { bySubject: {}, recent: [] };
}

export function isMarkedIrrelevant(state, subjectSlug, itemId) {
  return !!state?.bySubject?.[subjectSlug]?.[itemId];
}

export function markIrrelevant(state, { subjectSlug, itemId, name, mode, subjectDisplay }) {
  const prev = state || initRelevanceState();
  const bySubject = { ...prev.bySubject };
  bySubject[subjectSlug] = { ...(bySubject[subjectSlug] || {}), [itemId]: { name, mode, markedAt: Date.now() } };
  const recent = [
    { name, mode, subject: subjectDisplay, markedAt: Date.now() },
    ...prev.recent.filter((r) => !(r.name === name && r.subject === subjectDisplay)),
  ].slice(0, MAX_RECENT);
  return { bySubject, recent };
}

export function unmarkIrrelevant(state, subjectSlug, itemId) {
  const prev = state || initRelevanceState();
  const group = prev.bySubject[subjectSlug];
  if (!group || !group[itemId]) return prev;
  const nextGroup = { ...group };
  const removed = nextGroup[itemId];
  delete nextGroup[itemId];
  const bySubject = { ...prev.bySubject, [subjectSlug]: nextGroup };
  const recent = prev.recent.filter((r) => !(r.name === removed.name && r.subject === removed?.subjectDisplay));
  return { bySubject, recent };
}

/** Nomes marcados como pouco relevantes dentro do MESMO assunto — exclusão direta na próxima busca. */
export function avoidListForSubject(state, subjectSlug) {
  const group = state?.bySubject?.[subjectSlug];
  if (!group) return [];
  return Object.values(group).map((v) => v.name);
}

/** Lista curta e recente de itens rejeitados em QUALQUER assunto — contexto de "gosto" geral. */
export function tasteAvoidList(state, limit = 12) {
  return (state?.recent || []).slice(0, limit).map((r) => r.name);
}
