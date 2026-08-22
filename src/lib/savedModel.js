/**
 * Forma canônica de `saved` (schema v3) e os acessos a ela.
 *
 *   saved[subjectKey] = { displayName, items: [ { id, kind, ... } ] }
 *
 * `kind` ("technique" | "definition" | "list") é do ITEM, não do grupo: um
 * mesmo assunto pode guardar técnicas, conceitos e tipos lado a lado, e
 * converter um card de um tipo pra outro é mudar um campo — sem mover de
 * grupo, sem trocar de id e sem invalidar refs de coleção.
 *
 * Antes do v3 o `kind` era do grupo, os itens ficavam em `techniques` (técnica)
 * ou `items` (conceito/tipo) e os grupos de conhecimento eram prefixados com
 * `kn:`. Os helpers daqui leem as duas formas, porque payloads importados de
 * versões antigas chegam no formato velho e só depois passam pelas migrações.
 */

/** Tipos que se convertem entre si (ver lib/convert.js e ConvertButton). */
export const ITEM_KINDS = ["technique", "definition", "list"];

export const KIND_LABELS = {
  technique: "Técnica",
  definition: "Conceito",
  list: "Tipo",
  plant: "Planta",
};

export function isKnowledgeKind(kind) {
  return kind === "definition" || kind === "list";
}

export function isPlantKind(kind) {
  return kind === "plant";
}

/**
 * Categoria da Pokédex a que um item pertence. As abas de baixo filtram por
 * ISSO, não por `kind`: "Conceitos" junta definição e tipo, e planta é uma
 * categoria própria porque o card e os campos não se parecem com nenhum outro.
 */
export const CATEGORIES = ["technique", "knowledge", "plants"];

export function categoryOfKind(kind) {
  if (isKnowledgeKind(kind)) return "knowledge";
  if (isPlantKind(kind)) return "plants";
  return "technique";
}

/** Itens do grupo, em qualquer versão do schema. */
export function groupItems(group) {
  if (!group) return [];
  if (Array.isArray(group.items)) return group.items;
  if (Array.isArray(group.techniques)) return group.techniques;
  return [];
}

/** Tipo do item; cai pro `kind` do grupo (legado) e, por fim, pra técnica. */
export function itemKind(item, group) {
  return item?.kind || group?.kind || "technique";
}

/** Nome exibível: conceitos usam `term`, plantas o nome popular, o resto `name`. */
export function itemLabel(item) {
  if (item?.kind === "plant") return item.commonNames?.[0] || item.scientificName || item.name || "";
  return item?.term || item?.name || "";
}

/** Grupo com outra lista de itens, já na forma canônica. */
export function withItems(group, items) {
  return { displayName: group?.displayName || "", items };
}

/** Achata `saved` em `[{ subjectKey, group, item, kind, label }]`. */
export function listAllItems(saved) {
  const out = [];
  for (const [subjectKey, group] of Object.entries(saved || {})) {
    for (const item of groupItems(group)) {
      out.push({ subjectKey, group, item, kind: itemKind(item, group), label: itemLabel(item) });
    }
  }
  return out;
}
