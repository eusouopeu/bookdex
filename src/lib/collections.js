/**
 * Coleções manuais: pastas nomeadas pelo usuário que agrupam itens de
 * assuntos DIFERENTES (ex.: "prova de sexta"), cruzando técnicas, conceitos
 * e tipos já capturados. Guardadas como referências `{subjectKey, itemId}`
 * que apontam pro item real em `saved` — nunca duplicam o dado.
 *
 * Uma referência cujo item foi removido da Pokédex fica "órfã": some da
 * exibição (resolveCollectionItems filtra), sem exigir limpeza síncrona do
 * storage.
 */

export function initCollections() {
  return {};
}

export function createCollectionId() {
  return `col-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function itemsArrayOf(group) {
  return group.kind === "definition" || group.kind === "list" ? group.items : group.techniques;
}

/** Resolve as refs de uma coleção contra o estado atual de `saved`, descartando órfãs. */
export function resolveCollectionItems(saved, refs) {
  const resolved = [];
  for (const ref of refs || []) {
    const group = saved[ref.subjectKey];
    if (!group) continue;
    const list = itemsArrayOf(group);
    const item = list.find((it) => it.id === ref.itemId);
    if (!item) continue;
    resolved.push({ ref, group, item, kind: group.kind || "technique" });
  }
  return resolved;
}

export function refKey(ref) {
  return `${ref.subjectKey}:${ref.itemId}`;
}
