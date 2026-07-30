/**
 * Prefixos que escolhem o modo de busca:
 *   tec:  -> comparação de técnicas (comportamento original)
 *   def:  -> definição/conceito único
 *   list: -> enumeração de tipos/categorias de algo
 * Sem prefixo, mantém o comportamento original (modo "technique") por
 * compatibilidade com o uso já existente do app.
 */
const PREFIXES = [
  { prefix: "tec:", mode: "technique" },
  { prefix: "def:", mode: "definition" },
  { prefix: "list:", mode: "list" },
];

export function parseSearchQuery(raw) {
  const trimmed = (raw || "").trim();
  for (const { prefix, mode } of PREFIXES) {
    if (trimmed.toLowerCase().startsWith(prefix)) {
      return { mode, term: trimmed.slice(prefix.length).trim() };
    }
  }
  return { mode: "technique", term: trimmed };
}

export const MODE_LABELS = {
  technique: "Técnicas",
  definition: "Conceito",
  list: "Tipos",
};
