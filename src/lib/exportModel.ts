/**
 * Forma compartilhada dos dados entre exportadores (PDF do acervo, PDF de
 * card avulso, CSV do Anki, espelho .md automático): "que campos um item
 * tem" e "onde fica o guia cacheado dele" moram só aqui — cada exportador
 * vira só um renderizador do mesmo modelo, em vez de reimplementar
 * `sectionsOf`/chave de cache/lista de aspectos 3-4 vezes.
 */
import { slug } from "../theme";
import { groupItems, itemKind, categoryOfKind, type SavedState, type SavedGroup, type SavedItem } from "./savedModel";
import { PLANT_ASPECTS } from "./anthropic";

export interface ExportSection {
  group: SavedGroup;
  items: SavedItem[];
}

/** Assuntos com pelo menos um item da categoria pedida, já com os itens filtrados. */
export function sectionsOf(saved: SavedState, category: string): ExportSection[] {
  const out: ExportSection[] = [];
  for (const group of Object.values(saved || {})) {
    const items = groupItems(group).filter((it) => categoryOfKind(itemKind(it, group)) === category);
    if (items.length) out.push({ group, items });
  }
  return out;
}

/** Chave usada em `detailCache` pro guia passo a passo de uma técnica salva. */
export function techniqueCacheKey(displayName: string | undefined, itemId: string | undefined) {
  return `${slug(displayName || "")}:${itemId}`;
}

/** Guia passo a passo já cacheado de uma técnica, se existir. */
export function techniqueGuide(displayName: string | undefined, item: SavedItem, detailCache: Record<string, any>) {
  return detailCache?.[techniqueCacheKey(displayName, item.id)] ?? null;
}

/** Aspectos de uma planta já preenchidos, na ordem canônica de `PLANT_ASPECTS`. */
export function plantAspectEntries(item: SavedItem): { label: string; text: string }[] {
  const aspects = (item.aspects as Record<string, string>) || {};
  return PLANT_ASPECTS.map((a) => ({ label: a.label, text: aspects[a.id] })).filter((e) => !!e.text) as {
    label: string;
    text: string;
  }[];
}
