/**
 * Gera o Markdown da Pokédex inteira (técnicas, conceitos, tipos e os guias
 * já cacheados). Não existe mais botão de exportação manual pra isso — o
 * conteúdo é espelhado automaticamente em `.md` a cada mudança relevante
 * (ver `lib/autoMdMirror.ts`), pensado pra abrir direto no Obsidian/Notion/
 * qualquer editor de texto puro sem precisar exportar nada à mão.
 */
import { itemKind, type SavedState } from "./savedModel";
import { sectionsOf, techniqueGuide, plantAspectEntries } from "./exportModel";

function writeTechnique(lines: string[], displayName: string, t: any, detailCache: Record<string, any>) {
  lines.push(`### ${t.name} (${t.type})`, "");
  if (t.statLabels && t.stats) {
    lines.push(t.statLabels.map((label: string, i: number) => `**${label}:** ${t.stats[i] ?? "?"}/5`).join("  ·  "), "");
  }
  if (t.description) lines.push(t.description, "");
  if (t.bestFor) lines.push(`_Ideal para: ${t.bestFor}_`, "");

  const detail = techniqueGuide(displayName, t, detailCache);
  if (detail) {
    lines.push("**Guia passo a passo:**", "");
    (detail.steps || []).forEach((step: any, i: number) => {
      lines.push(`${i + 1}. **${step.title}** — ${step.detail}`);
    });
    if (detail.steps?.length) lines.push("");
    if (detail.tip) lines.push(`> Dica: ${detail.tip}`, "");
  }

  if (t.tags?.length) lines.push(`Tags: ${t.tags.map((tag: string) => `\`${tag}\``).join(" ")}`, "");
  if (t.note) lines.push(`Nota pessoal: ${t.note}`, "");
  lines.push("---", "");
}

function writeKnowledgeItem(lines: string[], group: any, it: any) {
  if (itemKind(it, group) === "definition") {
    lines.push(`### ${it.term}${it.category ? ` (${it.category})` : ""}`, "");
    if (it.definition) lines.push(it.definition, "");
    (it.keyPoints || []).forEach((k: string) => lines.push(`- ${k}`));
    if (it.keyPoints?.length) lines.push("");
    if (it.example) lines.push(`_Exemplo: ${it.example}_`, "");
  } else {
    lines.push(`### ${it.name}${it.category ? ` (${it.category})` : ""}`, "");
    if (it.description) lines.push(it.description, "");
  }
  if (it.tags?.length) lines.push(`Tags: ${it.tags.map((tag: string) => `\`${tag}\``).join(" ")}`, "");
  if (it.note) lines.push(`Nota pessoal: ${it.note}`, "");
  lines.push("---", "");
}

function writePlant(lines: string[], it: any) {
  lines.push(`### ${it.commonNames?.[0] || it.scientificName || it.name}`, "");
  if (it.scientificName) lines.push(`*${it.scientificName}*`, "");
  if ((it.commonNames || []).length > 1) lines.push(`Também conhecida como: ${it.commonNames.slice(1).join(", ")}`, "");
  if (it.summary) lines.push(it.summary, "");
  for (const { label, text } of plantAspectEntries(it)) lines.push(`**${label}:** ${text}`, "");
  if (it.tags?.length) lines.push(`Tags: ${it.tags.map((tag: string) => `\`${tag}\``).join(" ")}`, "");
  if (it.note) lines.push(`Nota pessoal: ${it.note}`, "");
  lines.push("---", "");
}

export function buildPokedexMarkdown(saved: SavedState, detailCache: Record<string, any>) {
  const lines = ["# Cognidex — minha Pokédex", "", `_Atualizado em ${new Date().toLocaleDateString("pt-BR")}_`, ""];

  const techniqueSections = sectionsOf(saved, "technique");
  const knowledgeSections = sectionsOf(saved, "knowledge");
  const plantSections = sectionsOf(saved, "plants");

  if (techniqueSections.length) {
    lines.push("## Técnicas", "");
    for (const { group, items } of techniqueSections) {
      lines.push(`## ${group.displayName}`, "");
      for (const t of items) writeTechnique(lines, group.displayName || "", t, detailCache);
    }
  }

  if (knowledgeSections.length) {
    lines.push("## Conceitos & Tipos", "");
    for (const { group, items } of knowledgeSections) {
      lines.push(`## ${group.displayName}`, "");
      for (const it of items) writeKnowledgeItem(lines, group, it);
    }
  }

  if (plantSections.length) {
    lines.push("## Plantas", "");
    for (const { group, items } of plantSections) {
      lines.push(`## ${group.displayName}`, "");
      for (const it of items) writePlant(lines, it);
    }
  }

  return lines.join("\n");
}
