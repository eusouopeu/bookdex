/**
 * Vínculos manuais entre itens salvos na Pokédex (ex.: "técnica A é uma
 * variante da técnica B", "conceito X se relaciona com a técnica Y").
 * Cada item guarda `links: [{ subjectKey, itemId, kind }]` — o vínculo é
 * sempre bidirecional: adicionar/remover em A também atualiza B.
 */
function isKnowledgeGroup(group) {
  return group.kind === "definition" || group.kind === "list";
}

function groupItemsOf(group) {
  return isKnowledgeGroup(group) ? group.items : group.techniques;
}

function itemKindOf(group) {
  return group.kind === "definition" ? "definition" : group.kind === "list" ? "list" : "technique";
}

export function itemLabelOf(kind, item) {
  return kind === "definition" ? item.term : item.name;
}

/** Lista achatada de todos os itens salvos, para o seletor de vínculo. */
export function listAllItems(saved) {
  const out = [];
  for (const [subjectKey, group] of Object.entries(saved || {})) {
    const kind = itemKindOf(group);
    for (const item of groupItemsOf(group)) {
      out.push({
        subjectKey,
        subjectDisplay: group.displayName,
        itemId: item.id,
        kind,
        label: itemLabelOf(kind, item),
      });
    }
  }
  return out;
}

function sameRef(a, b) {
  return a.subjectKey === b.subjectKey && a.itemId === b.itemId;
}

function updateItem(saved, ref, mutate) {
  const group = saved[ref.subjectKey];
  if (!group) return saved;
  const isKnowledge = isKnowledgeGroup(group);
  const list = isKnowledge ? group.items : group.techniques;
  const idx = list.findIndex((it) => it.id === ref.itemId);
  if (idx === -1) return saved;
  const nextList = [...list];
  nextList[idx] = mutate(nextList[idx]);
  const nextGroup = isKnowledge ? { ...group, items: nextList } : { ...group, techniques: nextList };
  return { ...saved, [ref.subjectKey]: nextGroup };
}

export function addLink(saved, a, b) {
  if (sameRef(a, b)) return saved;
  let next = updateItem(saved, a, (item) => {
    const links = item.links || [];
    if (links.some((l) => sameRef(l, b))) return item;
    return { ...item, links: [...links, { subjectKey: b.subjectKey, itemId: b.itemId, kind: b.kind }] };
  });
  next = updateItem(next, b, (item) => {
    const links = item.links || [];
    if (links.some((l) => sameRef(l, a))) return item;
    return { ...item, links: [...links, { subjectKey: a.subjectKey, itemId: a.itemId, kind: a.kind }] };
  });
  return next;
}

export function removeLink(saved, a, b) {
  let next = updateItem(saved, a, (item) => ({
    ...item,
    links: (item.links || []).filter((l) => !sameRef(l, b)),
  }));
  next = updateItem(next, b, (item) => ({
    ...item,
    links: (item.links || []).filter((l) => !sameRef(l, a)),
  }));
  return next;
}

/** Resolve `links` de um item para objetos exibíveis (rótulo, assunto), pulando alvos apagados. */
export function resolveLinks(saved, links) {
  return (links || [])
    .map((l) => {
      const group = saved[l.subjectKey];
      if (!group) return null;
      const list = groupItemsOf(group);
      const item = list.find((it) => it.id === l.itemId);
      if (!item) return null;
      const kind = itemKindOf(group);
      return {
        subjectKey: l.subjectKey,
        itemId: l.itemId,
        kind,
        subjectDisplay: group.displayName,
        label: itemLabelOf(kind, item),
      };
    })
    .filter(Boolean);
}
