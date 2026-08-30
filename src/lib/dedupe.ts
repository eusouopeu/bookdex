import { slug } from "../theme";
import { groupItems, itemLabel, itemKind, type SavedState } from "./savedModel";

/**
 * Procura, em QUALQUER assunto já salvo, um item cujo nome normalizado
 * (slug) bata com o nome dado — usado pra avisar o usuário que ele já tem
 * algo parecido antes de confirmar uma nova captura, mesmo que o item
 * pareça novo por estar em outro assunto.
 */
export function findSimilarItem(saved: SavedState | undefined | null, name: string) {
  const targetSlug = slug(name);
  if (!targetSlug) return null;
  for (const group of Object.values(saved || {})) {
    for (const it of groupItems(group)) {
      const itName = itemLabel(it);
      if (slug(itName) === targetSlug) {
        return { subjectDisplay: group.displayName, name: itName };
      }
    }
  }
  return null;
}

/**
 * Um item de conceito (kind "definition") já capturado com o mesmo nome
 * normalizado, em QUALQUER assunto — usado pra "Relacionados" e pelos chips
 * de termos relacionados abrirem direto o card já salvo, sem gastar uma
 * chamada nova pra algo que já está na Pokédex.
 */
export function findSavedDefinition(saved: SavedState | undefined | null, term: string) {
  const targetSlug = slug(term);
  if (!targetSlug) return null;
  for (const group of Object.values(saved || {})) {
    for (const it of groupItems(group)) {
      if (itemKind(it, group) !== "definition") continue;
      if (slug(itemLabel(it)) === targetSlug) return it;
    }
  }
  return null;
}
