/**
 * Prefixos que escolhem o modo de busca:
 *   tec:  -> comparação de técnicas (comportamento original)
 *   def:  -> definição/conceito único
 *   list: -> enumeração de tipos/categorias de algo
 *   cmp:  -> comparação direta entre 2-3 itens específicos nomeados pelo usuário
 * Sem prefixo, mantém o comportamento original (modo "technique") por
 * compatibilidade com o uso já existente do app.
 */
const PREFIXES = [
  { prefix: "tec:", mode: "technique" },
  { prefix: "def:", mode: "definition" },
  { prefix: "list:", mode: "list" },
  { prefix: "cmp:", mode: "compare" },
];

/** Quebra o termo de uma busca "cmp:" nos 2-3 itens a comparar (separados por "," ou " vs "). */
export function splitCompareTerms(term) {
  return (term || "")
    .split(/,| vs\.? | x /i)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function parseSearchQuery(raw) {
  const trimmed = (raw || "").trim();
  for (const { prefix, mode } of PREFIXES) {
    if (trimmed.toLowerCase().startsWith(prefix)) {
      return { mode, term: trimmed.slice(prefix.length).trim() };
    }
  }
  return { mode: "technique", term: trimmed };
}

export function hasExplicitPrefix(raw) {
  const trimmed = (raw || "").trim().toLowerCase();
  return PREFIXES.some(({ prefix }) => trimmed.startsWith(prefix));
}

export const MODE_LABELS = {
  technique: "Técnicas",
  definition: "Conceito",
  list: "Tipos",
  compare: "Comparar",
};

export const PLACEHOLDER_BY_MODE = {
  technique: "Ex.: respiração, canto, alongamentos para postura",
  definition: "Ex.: efeito placebo, juros compostos",
  list: "Ex.: tipos de memória, gêneros musicais",
  compare: "Ex.: melatonina, magnésio, ashwagandha",
};
