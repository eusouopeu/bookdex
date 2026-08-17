import { slug } from "../theme";

/**
 * Procura, em QUALQUER assunto já salvo, um item cujo nome normalizado
 * (slug) bata com o nome dado — usado pra avisar o usuário que ele já tem
 * algo parecido antes de confirmar uma nova captura, mesmo que o item
 * pareça novo por estar em outro assunto.
 */
export function findSimilarItem(saved, name) {
  const targetSlug = slug(name);
  if (!targetSlug) return null;
  for (const group of Object.values(saved || {})) {
    const items = group.kind === "definition" || group.kind === "list" ? group.items : group.techniques;
    for (const it of items || []) {
      const itName = it.term || it.name;
      if (slug(itName) === targetSlug) {
        return { subjectDisplay: group.displayName, name: itName };
      }
    }
  }
  return null;
}
