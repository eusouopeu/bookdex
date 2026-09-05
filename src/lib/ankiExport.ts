/**
 * Exporta a Pokédex inteira num CSV compatível com o importador do Anki
 * (Arquivo → Importar). O Cognidex não tem revisão/flashcard próprio: quem
 * quiser memorizar leva os cartões pro Anki por aqui. O verso traz o conteúdo
 * completo do item, incluindo o guia passo a passo já cacheado, quando existir.
 */
import { slug } from "../theme";
import { groupItems, itemKind, type SavedState, type SavedItem } from "./savedModel";
import { techniqueCacheKey, plantAspectEntries } from "./exportModel";
import type { WordsState, WordItem, WordGroup } from "./words";

function escapeCsvField(value: unknown) {
  const str = String(value ?? "");
  if (/[;"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function frontOf(kind: string, item: SavedItem) {
  if (kind === "definition") return item.term;
  if (kind === "plant") return item.commonNames?.[0] || item.scientificName || item.name;
  return item.name;
}

function backOf(kind: string, item: SavedItem, detail: any) {
  if (kind === "definition") {
    return [
      item.definition,
      ...((item.keyPoints as string[]) || []).map((k) => `• ${k}`),
      item.example ? `Exemplo: ${item.example}` : "",
      item.note ? `Nota: ${item.note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (kind === "plant") {
    return [
      item.scientificName ? `Nome científico: ${item.scientificName}` : "",
      (item.commonNames || []).length > 1 ? `Também: ${item.commonNames.slice(1).join(", ")}` : "",
      item.summary || "",
      ...plantAspectEntries(item).map(({ label, text }) => `${label}: ${text}`),
      item.note ? `Nota: ${item.note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (kind === "list") {
    return [item.description || "", item.note ? `Nota: ${item.note}` : ""].filter(Boolean).join("\n");
  }
  const lines = [item.description || ""];
  if (item.bestFor) lines.push(`Ideal para: ${item.bestFor}`);
  if (detail) {
    lines.push(...(detail.steps || []).map((s, i) => `${i + 1}. ${s.title}: ${s.detail}`));
    if (detail.tip) lines.push(`Dica: ${detail.tip}`);
  }
  if (item.note) lines.push(`Nota: ${item.note}`);
  return lines.filter(Boolean).join("\n");
}

function tagsOf(displayName: string | undefined, kind: string, item: SavedItem) {
  const tags = ["bookdex", `bookdex::${kind}`, `assunto::${slug(displayName)}`];
  for (const t of item.tags || []) tags.push(slug(t));
  return tags.join(" ");
}

/**
 * Verso de uma palavra capturada. Sempre em português no significado, com o
 * pinyin/radical e a decomposição por caractere quando houver — é o que faz o
 * cartão servir pra revisar vocabulário fora do app.
 */
function wordBack(w: WordItem) {
  return [
    w.meaning || "",
    w.pinyin ? `Pinyin: ${w.pinyin}` : "",
    w.radical ? `Radical: ${w.radical}` : "",
    ...((w.characters as { hanzi: string; pinyin?: string; meaning?: string }[]) || []).map(
      (c) => `${c.hanzi} (${c.pinyin || ""}) — ${c.meaning || ""}`
    ),
    w.note ? `Nota: ${w.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function wordTags(group: WordGroup, w: WordItem) {
  const tags = ["bookdex", "bookdex::palavra", `idioma::${slug(group.displayName)}`];
  for (const t of w.tags || []) tags.push(slug(t));
  return tags.join(" ");
}

export function buildAnkiCsv(saved: SavedState, detailCache: Record<string, any>, words: WordsState) {
  const rows = ["#separator:Semicolon", "#html:false", "#tags column:3"];
  for (const group of Object.values(saved || {})) {
    for (const item of groupItems(group)) {
      const kind = itemKind(item, group);
      const detail = kind === "technique" ? detailCache?.[techniqueCacheKey(group.displayName, item.id)] : null;
      const row = [frontOf(kind, item), backOf(kind, item, detail), tagsOf(group.displayName, kind, item)]
        .map(escapeCsvField)
        .join(";");
      rows.push(row);
    }
  }
  for (const group of Object.values(words || {})) {
    for (const w of group.words || []) {
      rows.push([w.word, wordBack(w), wordTags(group, w)].map(escapeCsvField).join(";"));
    }
  }
  return rows.join("\n");
}

export function countAnkiRows(saved: SavedState, words: WordsState) {
  const items = Object.values(saved || {}).reduce((sum: number, group) => sum + groupItems(group).length, 0);
  const vocab = Object.values(words || {}).reduce((sum: number, group) => sum + (group.words || []).length, 0);
  return items + vocab;
}
