/**
 * Revisão espaçada estilo Leitner sobre os itens já salvos na Pokédex.
 * Cada item guarda `reviewState: { box, nextReviewAt }` dentro do próprio
 * objeto salvo (persistido junto com `saved` em storage).
 *
 * Caixa 0 -> revisa amanhã; a cada acerto sobe de caixa e o intervalo cresce;
 * a cada erro volta pra caixa 0.
 */
const BOX_INTERVALS_DAYS = [1, 2, 4, 8, 16, 32];
const DAY_MS = 86400000;

export function initReviewState(now = Date.now()) {
  return { box: 0, nextReviewAt: now };
}

export function isDue(item, now = Date.now()) {
  const rs = item.reviewState;
  if (!rs) return true;
  return rs.nextReviewAt <= now;
}

export function gradeReviewState(reviewState, correct, now = Date.now()) {
  const rs = reviewState || initReviewState(now);
  const box = correct ? Math.min(rs.box + 1, BOX_INTERVALS_DAYS.length - 1) : 0;
  const days = BOX_INTERVALS_DAYS[box];
  return { box, nextReviewAt: now + days * DAY_MS };
}

function itemKind(group) {
  return group.kind === "definition" ? "definition" : group.kind === "list" ? "list" : "technique";
}

function groupItems(group) {
  return group.kind === "definition" || group.kind === "list" ? group.items : group.techniques;
}

function itemName(kind, item) {
  return kind === "definition" ? item.term : item.name;
}

/**
 * Achata `saved` numa lista de { subjectKey, subjectDisplay, kind, item }
 * para os itens vencidos (ou nunca revisados), ordenada pelos mais atrasados.
 */
export function getDueQueue(saved, now = Date.now()) {
  const queue = [];
  for (const [subjectKey, group] of Object.entries(saved || {})) {
    const kind = itemKind(group);
    for (const item of groupItems(group)) {
      if (isDue(item, now)) {
        queue.push({ subjectKey, subjectDisplay: group.displayName, kind, item, name: itemName(kind, item) });
      }
    }
  }
  queue.sort((a, b) => (a.item.reviewState?.nextReviewAt || 0) - (b.item.reviewState?.nextReviewAt || 0));
  return queue;
}

export function countDue(saved, now = Date.now()) {
  return getDueQueue(saved, now).length;
}
