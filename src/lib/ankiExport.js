/**
 * Exporta a Pokédex inteira num CSV compatível com o importador do Anki
 * (Arquivo → Importar). O Bookdex não tem revisão/flashcard próprio: quem
 * quiser memorizar leva os cartões pro Anki por aqui. O verso traz o conteúdo
 * completo do item, incluindo o guia passo a passo já cacheado, quando existir.
 */
import { slug } from "../theme";

function escapeCsvField(value) {
  const str = String(value ?? "");
  if (/[;"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function isKnowledgeGroup(group) {
  return group.kind === "definition" || group.kind === "list";
}

function frontOf(kind, item) {
  return kind === "definition" ? item.term : item.name;
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

export function buildAnkiCsv(saved, detailCache) {
  const rows = ["#separator:Semicolon", "#html:false", "#tags column:3"];
  for (const group of Object.values(saved || {})) {
    const kind = group.kind || "technique";
    const isKnowledge = isKnowledgeGroup(group);
    const items = isKnowledge ? group.items : group.techniques;
    for (const item of items || []) {
      const detail = !isKnowledge ? detailCache?.[`${slug(group.displayName)}:${item.id}`] : null;
      const row = [frontOf(kind, item), backOf(kind, item, detail), tagsOf(group.displayName, kind, item)]
        .map(escapeCsvField)
        .join(";");
      rows.push(row);
    }
  }
  return rows.join("\n");
}

export function countAnkiRows(saved) {
  return Object.values(saved || {}).reduce((sum, group) => {
    const items = isKnowledgeGroup(group) ? group.items : group.techniques;
    return sum + (items ? items.length : 0);
  }, 0);
}
