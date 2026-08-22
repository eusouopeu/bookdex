/**
 * Exporta a Pokédex inteira (técnicas, conceitos, tipos e os guias já
 * cacheados) num único arquivo Markdown — pensado para levar o conteúdo
 * para Obsidian, Notion ou qualquer editor de texto puro.
 */
import { slug } from "../theme";
import { groupItems, itemKind, isKnowledgeKind } from "./savedModel";

/**
 * Como um assunto pode misturar técnicas, conceitos e tipos, cada seção do
 * arquivo pega só os itens do seu naipe e ignora os assuntos que ficaram sem
 * nenhum.
 */
function sectionsOf(saved, wantKnowledge) {
  const out = [];
  for (const group of Object.values(saved || {})) {
    const items = groupItems(group).filter((it) => isKnowledgeKind(itemKind(it, group)) === wantKnowledge);
    if (items.length) out.push({ group, items });
  }
  return out;
}

function writeTechnique(lines, displayName, t, detailCache) {
  lines.push(`### ${t.name} (${t.type})`, "");
  if (t.statLabels && t.stats) {
    lines.push(t.statLabels.map((label, i) => `**${label}:** ${t.stats[i] ?? "?"}/5`).join("  ·  "), "");
  }
  if (t.description) lines.push(t.description, "");
  if (t.bestFor) lines.push(`_Ideal para: ${t.bestFor}_`, "");

  const detail = detailCache?.[`${slug(displayName)}:${t.id}`];
  if (detail) {
    lines.push("**Guia passo a passo:**", "");
    (detail.steps || []).forEach((step, i) => {
      lines.push(`${i + 1}. **${step.title}** — ${step.detail}`);
    });
    if (detail.steps?.length) lines.push("");
    if (detail.tip) lines.push(`> Dica: ${detail.tip}`, "");
  }

  if (t.tags?.length) lines.push(`Tags: ${t.tags.map((tag) => `\`${tag}\``).join(" ")}`, "");
  if (t.note) lines.push(`Nota pessoal: ${t.note}`, "");
  lines.push("---", "");
}

function writeKnowledgeItem(lines, group, it) {
  if (itemKind(it, group) === "definition") {
    lines.push(`### ${it.term}${it.category ? ` (${it.category})` : ""}`, "");
    if (it.definition) lines.push(it.definition, "");
    (it.keyPoints || []).forEach((k) => lines.push(`- ${k}`));
    if (it.keyPoints?.length) lines.push("");
    if (it.example) lines.push(`_Exemplo: ${it.example}_`, "");
  } else {
    lines.push(`### ${it.name}${it.category ? ` (${it.category})` : ""}`, "");
    if (it.description) lines.push(it.description, "");
  }
  if (it.tags?.length) lines.push(`Tags: ${it.tags.map((tag) => `\`${tag}\``).join(" ")}`, "");
  if (it.note) lines.push(`Nota pessoal: ${it.note}`, "");
  lines.push("---", "");
}

export function buildPokedexMarkdown(saved, detailCache) {
  const lines = ["# Bookdex — minha Pokédex", "", `_Exportado em ${new Date().toLocaleDateString("pt-BR")}_`, ""];

  const techniqueSections = sectionsOf(saved, false);
  const knowledgeSections = sectionsOf(saved, true);

  if (techniqueSections.length) {
    lines.push("## Técnicas", "");
    for (const { group, items } of techniqueSections) {
      lines.push(`## ${group.displayName}`, "");
      for (const t of items) writeTechnique(lines, group.displayName, t, detailCache);
    }
  }

  if (knowledgeSections.length) {
    lines.push("## Conceitos & Tipos", "");
    for (const { group, items } of knowledgeSections) {
      lines.push(`## ${group.displayName}`, "");
      for (const it of items) writeKnowledgeItem(lines, group, it);
    }
  }

  return lines.join("\n");
}

export function countMarkdownItems(saved) {
  return Object.values(saved || {}).reduce((sum, group) => sum + groupItems(group).length, 0);
}
