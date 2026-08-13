import { jsPDF } from "jspdf";
import { slug } from "../theme";

const MARGIN = 15;
const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function isKnowledgeGroup(group) {
  return group.kind === "definition" || group.kind === "list";
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
  doc.text("Bookdex", MARGIN, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor("#555555");
  doc.text("Minha Pokédex de técnicas, conceitos e tipos", MARGIN, 70);
  doc.text(new Date().toLocaleDateString("pt-BR"), MARGIN, 78);
  doc.addPage();
  y = MARGIN;

  const entries = Object.entries(saved || {});
  const techniqueEntries = entries.filter(([, g]) => !isKnowledgeGroup(g));
  const knowledgeEntries = entries.filter(([, g]) => isKnowledgeGroup(g));

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

  function writeKnowledgeGroup(displayName, group) {
    writeHeading(displayName);
    group.items.forEach((it) => {
      if (group.kind === "definition") {
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

  if (techniqueEntries.length) {
    writeHeading("Técnicas", 20);
    techniqueEntries.forEach(([, group]) => writeTechniqueGroup(group.displayName, group.techniques));
  }

  if (knowledgeEntries.length) {
    doc.addPage();
    y = MARGIN;
    writeHeading("Conceitos & Tipos", 20);
    knowledgeEntries.forEach(([, group]) => writeKnowledgeGroup(group.displayName, group));
  }

  return doc;
}

export function downloadPokedexPdf(saved, detailCache, fileName = "bookdex-pokedex.pdf") {
  const doc = buildPokedexPdf(saved, detailCache);
  doc.save(fileName);
}

export function pokedexPdfBlob(saved, detailCache) {
  const doc = buildPokedexPdf(saved, detailCache);
  return doc.output("blob");
}
