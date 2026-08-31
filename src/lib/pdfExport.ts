import { jsPDF } from "jspdf";
import { slug } from "../theme";
import { groupItems, itemKind, categoryOfKind, type SavedState } from "./savedModel";
import { PLANT_ASPECTS } from "./anthropic";

const MARGIN = 15;
const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Assuntos com pelo menos um item da categoria pedida, já com os itens filtrados. */
function sectionsOf(saved: SavedState, category: string) {
  const out = [];
  for (const group of Object.values(saved || {})) {
    const items = groupItems(group).filter((it) => categoryOfKind(itemKind(it, group)) === category);
    if (items.length) out.push({ group, items });
  }
  return out;
}

/**
 * Compila toda a Pokédex (técnicas, conceitos, tipos e os guias já gerados)
 * num único PDF "livro de estudo", em vez do backup JSON técnico.
 */
export function buildPokedexPdf(saved, detailCache) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  function ensureSpace(lines = 1, lineHeight = 5) {
    if (y + lines * lineHeight > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function writeParagraph(text, { size = 10, style = "normal", color = "#222222", gap = 4 } = {}) {
    if (!text) return;
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
    ensureSpace(lines.length, size * 0.42);
    doc.text(lines, MARGIN, y);
    y += lines.length * size * 0.42 + gap;
  }

  function writeHeading(text, size = 16) {
    ensureSpace(2, size * 0.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor("#111111");
    doc.text(text, MARGIN, y);
    y += size * 0.5 + 2;
  }

  // Capa simples
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor("#111111");
  doc.text("Cognidex", MARGIN, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor("#555555");
  doc.text("Minha Pokédex de técnicas, conceitos, tipos e plantas", MARGIN, 70);
  doc.text(new Date().toLocaleDateString("pt-BR"), MARGIN, 78);
  doc.addPage();
  y = MARGIN;

  const techniqueSections = sectionsOf(saved, "technique");
  const knowledgeSections = sectionsOf(saved, "knowledge");
  const plantSections = sectionsOf(saved, "plants");

  function writeTechniqueGroup(displayName, techniques) {
    writeHeading(displayName);
    techniques.forEach((t) => {
      writeParagraph(`${t.name} (${t.type})`, { size: 12, style: "bold", gap: 1.5 });
      if (t.statLabels && t.stats) {
        const statsLine = t.statLabels.map((label, i) => `${label}: ${t.stats[i] ?? "?"}/5`).join("  ·  ");
        writeParagraph(statsLine, { size: 9, color: "#666666", gap: 1.5 });
      }
      writeParagraph(t.description, { size: 10 });
      if (t.bestFor) writeParagraph(`Ideal para: ${t.bestFor}`, { size: 9, style: "italic", color: "#555555" });

      const cacheKey = `${slug(displayName)}:${t.id}`;
      const detail = detailCache?.[cacheKey];
      if (detail) {
        writeParagraph("Guia passo a passo:", { size: 10, style: "bold", gap: 1.5 });
        (detail.steps || []).forEach((step, i) => {
          writeParagraph(`${i + 1}. ${step.title} — ${step.detail}`, { size: 9.5, gap: 1 });
        });
        if (detail.tip) writeParagraph(`Dica: ${detail.tip}`, { size: 9.5, style: "italic", color: "#555555" });
      }
      y += 3;
    });
  }

  function writeKnowledgeGroup(displayName, group, items) {
    writeHeading(displayName);
    items.forEach((it) => {
      if (itemKind(it, group) === "definition") {
        writeParagraph(`${it.term} (${it.category})`, { size: 12, style: "bold", gap: 1.5 });
        writeParagraph(it.definition, { size: 10 });
        (it.keyPoints || []).forEach((k) => writeParagraph(`• ${k}`, { size: 9.5, gap: 1 }));
        if (it.example) writeParagraph(`Exemplo: ${it.example}`, { size: 9.5, style: "italic", color: "#555555" });
      } else {
        writeParagraph(`${it.name}${it.category ? ` (${it.category})` : ""}`, { size: 12, style: "bold", gap: 1.5 });
        writeParagraph(it.description, { size: 10 });
      }
      y += 3;
    });
  }

  function writePlantGroup(displayName, items) {
    writeHeading(displayName);
    items.forEach((it) => {
      writeParagraph(it.commonNames?.[0] || it.scientificName || it.name, { size: 12, style: "bold", gap: 1.5 });
      if (it.scientificName) writeParagraph(it.scientificName, { size: 9.5, style: "italic", color: "#555555", gap: 1.5 });
      if ((it.commonNames || []).length > 1) {
        writeParagraph(`Também: ${it.commonNames.slice(1).join(", ")}`, { size: 9, color: "#666666", gap: 1.5 });
      }
      writeParagraph(it.summary, { size: 10 });
      PLANT_ASPECTS.forEach((aspect) => {
        const text = (it.aspects || {})[aspect.id];
        if (!text) return;
        writeParagraph(`${aspect.label}:`, { size: 10, style: "bold", gap: 1 });
        writeParagraph(text, { size: 9.5 });
      });
      y += 3;
    });
  }

  if (techniqueSections.length) {
    writeHeading("Técnicas", 20);
    techniqueSections.forEach(({ group, items }) => writeTechniqueGroup(group.displayName, items));
  }

  if (knowledgeSections.length) {
    doc.addPage();
    y = MARGIN;
    writeHeading("Conceitos & Tipos", 20);
    knowledgeSections.forEach(({ group, items }) => writeKnowledgeGroup(group.displayName, group, items));
  }

  if (plantSections.length) {
    doc.addPage();
    y = MARGIN;
    writeHeading("Plantas", 20);
    plantSections.forEach(({ group, items }) => writePlantGroup(group.displayName, items));
  }

  return doc;
}

export function downloadPokedexPdf(saved, detailCache, fileName = "cognidex-pokedex.pdf") {
  const doc = buildPokedexPdf(saved, detailCache);
  doc.save(fileName);
}

export function pokedexPdfBlob(saved, detailCache) {
  const doc = buildPokedexPdf(saved, detailCache);
  return doc.output("blob");
}
