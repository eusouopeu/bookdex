/**
 * Exporta a Pokédex inteira num CSV compatível com o importador do Anki
 * (Arquivo → Importar). O Bookdex não tem revisão/flashcard próprio: quem
 * quiser memorizar leva os cartões pro Anki por aqui. O verso traz o conteúdo
 * completo do item, incluindo o guia passo a passo já cacheado, quando existir.
 */
import { slug } from "../theme";
import { groupItems, itemKind, isKnowledgeKind } from "./savedModel";
import { PLANT_ASPECTS } from "./anthropic";

function escapeCsvField(value) {
  const str = String(value ?? "");
  if (/[;"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function frontOf(kind, item) {
  if (kind === "definition") return item.term;
  if (kind === "plant") return item.commonNames?.[0] || item.scientificName || item.name;
  return item.name;
}

function backOf(kind, item, detail) {
  if (kind === "definition") {
    return [
      item.definition,
      ...(item.keyPoints || []).map((k) => `• ${k}`),
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
      ...PLANT_ASPECTS.map((a) => (item.aspects?.[a.id] ? `${a.label}: ${item.aspects[a.id]}` : "")),
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

function tagsOf(displayName, kind, item) {
  const tags = ["bookdex", `bookdex::${kind}`, `assunto::${slug(displayName)}`];
  for (const t of item.tags || []) tags.push(slug(t));
  return tags.join(" ");
}

/**
 * Verso de uma palavra capturada. Sempre em português no significado, com o
 * pinyin/radical e a decomposição por caractere quando houver — é o que faz o
 * cartão servir pra revisar vocabulário fora do app.
 */
function wordBack(w) {
  return [
    w.meaning || "",
    w.pinyin ? `Pinyin: ${w.pinyin}` : "",
    w.radical ? `Radical: ${w.radical}` : "",
    ...(w.characters || []).map((c) => `${c.hanzi} (${c.pinyin || ""}) — ${c.meaning || ""}`),
    w.note ? `Nota: ${w.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function wordTags(group, w) {
  const tags = ["bookdex", "bookdex::palavra", `idioma::${slug(group.displayName)}`];
  for (const t of w.tags || []) tags.push(slug(t));
  return tags.join(" ");
}

export function buildAnkiCsv(saved, detailCache, words) {
  const rows = ["#separator:Semicolon", "#html:false", "#tags column:3"];
  for (const group of Object.values(saved || {})) {
    for (const item of groupItems(group)) {
      const kind = itemKind(item, group);
      const detail = kind === "technique" ? detailCache?.[`${slug(group.displayName)}:${item.id}`] : null;
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

export function countAnkiRows(saved, words) {
  const items = Object.values(saved || {}).reduce((sum, group) => sum + groupItems(group).length, 0);
  const vocab = Object.values(words || {}).reduce((sum, group) => sum + (group.words || []).length, 0);
  return items + vocab;
}
