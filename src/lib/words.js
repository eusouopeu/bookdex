import { slug } from "../theme";

/** Chave da "pasta" de idioma dentro de `words`, a partir do código ou nome retornado pela API. */
export function wordLangKey(languageCode, language) {
  return slug(languageCode || language || "outro");
}

export function isMandarin(languageCode) {
  return (languageCode || "").toLowerCase() === "zh";
}
