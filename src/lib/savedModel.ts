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

/**
 * Um item salvo (técnica, conceito, tipo ou planta). Os campos variam por
 * `kind` — em vez de uma união exaustiva, usa-se um shape aberto com os
 * campos comuns e o resto como índice, já que cards diferentes têm campos
 * bem diferentes (ver Definition/Tech/PlantCard) e a forma legada também
 * aparece aqui antes de passar pelas migrações.
 */
export interface SavedItem {
  id?: string;
  kind?: string;
  name?: string;
  term?: string;
  commonNames?: string[];
  scientificName?: string;
  savedAt?: number;
  tags?: string[];
  note?: string;
  archived?: boolean;
  aspects?: Record<string, string>;
  images?: unknown;
  [key: string]: unknown;
}

/** Um grupo de itens salvos sob um mesmo assunto/subject key. */
export interface SavedGroup {
  displayName?: string;
  kind?: string;
  items?: SavedItem[];
  /** Forma legada (pré-v3), onde só técnicas eram guardadas. */
  techniques?: SavedItem[];
  [key: string]: unknown;
}

export type SavedState = Record<string, SavedGroup>;

/** Tipos que se convertem entre si (ver lib/convert.js e ConvertButton). */
export const ITEM_KINDS = ["technique", "definition", "list"];

export const KIND_LABELS: Record<string, string> = {
  technique: "Técnica",
  definition: "Conceito",
  list: "Tipo",
  plant: "Planta",
};

export function isKnowledgeKind(kind: string | undefined) {
  return kind === "definition" || kind === "list";
}

export function isPlantKind(kind: string | undefined) {
  return kind === "plant";
}

/**
 * Categoria da Pokédex a que um item pertence. As abas de baixo filtram por
 * ISSO, não por `kind`: "Conceitos" junta definição e tipo, e planta é uma
 * categoria própria porque o card e os campos não se parecem com nenhum outro.
 */
export const CATEGORIES = ["technique", "knowledge", "plants"];

export function categoryOfKind(kind: string | undefined) {
  if (isKnowledgeKind(kind)) return "knowledge";
  if (isPlantKind(kind)) return "plants";
  return "technique";
}

/** Itens do grupo, em qualquer versão do schema. */
export function groupItems(group: SavedGroup | undefined | null): SavedItem[] {
  if (!group) return [];
  if (Array.isArray(group.items)) return group.items;
  if (Array.isArray(group.techniques)) return group.techniques;
  return [];
}

/** Tipo do item; cai pro `kind` do grupo (legado) e, por fim, pra técnica. */
export function itemKind(item: SavedItem | undefined | null, group: SavedGroup | undefined | null) {
  return item?.kind || group?.kind || "technique";
}

/** Nome exibível: conceitos usam `term`, plantas o nome popular, o resto `name`. */
export function itemLabel(item: SavedItem | undefined | null) {
  if (item?.kind === "plant") return item.commonNames?.[0] || item.scientificName || item.name || "";
  return item?.term || item?.name || "";
}

/** Grupo com outra lista de itens, já na forma canônica. */
export function withItems(group: SavedGroup | undefined | null, items: SavedItem[]): SavedGroup {
  return { displayName: group?.displayName || "", items };
}

/** Achata `saved` em `[{ subjectKey, group, item, kind, label }]`. */
export function listAllItems(saved: SavedState | undefined | null) {
  const out: { subjectKey: string; group: SavedGroup; item: SavedItem; kind: string; label: string }[] = [];
  for (const [subjectKey, group] of Object.entries(saved || {})) {
    for (const item of groupItems(group)) {
      out.push({ subjectKey, group, item, kind: itemKind(item, group), label: itemLabel(item) });
    }
  }
  return out;
}
