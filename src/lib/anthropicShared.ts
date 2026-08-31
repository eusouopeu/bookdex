/**
 * Peças puras do cliente Anthropic compartilhadas entre o Cognidex
 * (`lib/anthropic.ts`) e o módulo Sinergia (`modules/sinergia/lib/anthropic.ts`).
 * O resto do cliente (chamada HTTP, credenciais, streaming de imagem/thinking)
 * diverge o bastante entre os dois módulos pra não valer a pena forçar numa
 * única implementação parametrizada.
 */
export function looksLikeApiKey(key?: string) {
  return /^sk-ant-[\w-]{10,}$/.test((key || "").trim());
}

export function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Formato inesperado");
  return text.slice(start, end + 1);
}
