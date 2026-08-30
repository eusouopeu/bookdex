/**
 * Prefixos que escolhem o modo de busca:
 *   tec:  -> comparação de técnicas (comportamento original)
 *   def:  -> definição/conceito único
 *   list: -> enumeração de tipos/categorias de algo
 *   cmp:  -> comparação direta entre 2-3 itens específicos nomeados pelo usuário
 *   pal:  -> verbete de uma palavra (idioma, significado, radical/pinyin)
 *   plt:  -> ficha de uma planta (nome científico, nomes populares, resumo)
 * Sem prefixo, mantém o comportamento original (modo "technique") por
 * compatibilidade com o uso já existente do app.
 *
 * `pal:` existe porque a busca de palavras tinha um campo próprio dentro da
 * Pokédex — dois modelos mentais de busca no mesmo app. Agora toda busca sai
 * da mesma barra, e a Pokédex só guarda o que foi capturado.
 */
const PREFIXES = [
  { prefix: "tec:", mode: "technique" },
  { prefix: "def:", mode: "definition" },
  { prefix: "list:", mode: "list" },
  { prefix: "cmp:", mode: "compare" },
  { prefix: "pal:", mode: "word" },
  { prefix: "plt:", mode: "plant" },
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
  word: "Palavra",
  plant: "Planta",
};

export const MODE_PREFIXES = Object.fromEntries(PREFIXES.map(({ prefix, mode }) => [mode, prefix]));

export const PLACEHOLDER_BY_MODE = {
  technique: "Ex.: respiração, canto, alongamentos para postura",
  definition: "Ex.: efeito placebo, juros compostos",
  list: "Ex.: tipos de memória, gêneros musicais",
  compare: "Ex.: melatonina, magnésio, ashwagandha",
  word: "Ex.: sinistro, hodgepodge, 明白",
  plant: "Ex.: alecrim, boldo, Mentha piperita",
};

/** Modos cujo resultado vale a pena guardar em cache (ver lib/searchCache.js). */
export const CACHEABLE_MODES = ["technique", "definition", "list", "compare", "word", "plant"];
