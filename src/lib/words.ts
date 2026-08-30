import { slug } from "../theme";

export interface WordItem {
  id: string;
  word: string;
  language: string;
  languageCode: string;
  meaning?: string;
  pinyin?: string;
  radical?: string;
  characters?: unknown[];
  savedAt?: number;
  tags?: string[];
  note?: string;
  [key: string]: unknown;
}

export interface WordGroup {
  displayName: string;
  words: WordItem[];
}

export type WordsState = Record<string, WordGroup>;

/** Chave da "pasta" de idioma dentro de `words`, a partir do código ou nome retornado pela API. */
export function wordLangKey(languageCode?: string, language?: string) {
  return slug(languageCode || language || "outro");
}

export function isMandarin(languageCode?: string) {
  return (languageCode || "").toLowerCase() === "zh";
}

/**
 * Id estável para uma palavra salva. `slug()` zera pra escritas não-latinas
 * (mandarim, japonês, etc. — sem letras a-z), então nesse caso cai pra uma
 * codificação por codepoint, senão palavras diferentes colidiriam todas no
 * mesmo id "".
 */
export function wordItemId(word: string) {
  const base = slug(word);
  if (base) return base;
  return (
    "w-" +
    Array.from(word || "")
      .map((c) => (c.codePointAt(0) ?? 0).toString(36))
      .join("")
  );
}

/** Núcleo aproximado de uma palavra pra casar variações de plural/gênero — só
 * faz sentido em escrita latina; `slug()` vazio (CJK etc.) nunca "casa" com nada. */
function wordCoreKey(word: string) {
  let w = slug(word);
  if (!w) return "";
  w = w.replace(/oes$/, "ao").replace(/aes$/, "ao").replace(/ais$/, "al");
  if (w.length > 4 && /res$/.test(w)) w = w.replace(/res$/, "r");
  else if (w.length > 3 && /es$/.test(w)) w = w.replace(/es$/, "");
  else if (w.length > 3 && /s$/.test(w)) w = w.replace(/s$/, "");
  if (w.length > 3 && /[oa]$/.test(w)) w = w.slice(0, -1);
  return w;
}

/**
 * Procura, entre as palavras já salvas, uma que corresponda à busca — primeiro
 * por igualdade exata (texto bruto ou slug), depois por uma aproximação de
 * plural/gênero (só em escrita latina). Retorna `{ item, exact }` ou `null`.
 */
export function findSavedWord(words: WordsState | undefined | null, query: string) {
  const raw = (query || "").trim();
  if (!raw) return null;
  const qSlug = slug(raw);

  for (const group of Object.values(words || {})) {
    for (const item of group.words) {
      if (item.word.trim().toLowerCase() === raw.toLowerCase()) return { item, exact: true };
      if (qSlug && slug(item.word) === qSlug) return { item, exact: true };
    }
  }

  const qCore = wordCoreKey(raw);
  if (qCore) {
    for (const group of Object.values(words || {})) {
      for (const item of group.words) {
        if (wordCoreKey(item.word) === qCore) return { item, exact: false };
      }
    }
  }

  return null;
}
