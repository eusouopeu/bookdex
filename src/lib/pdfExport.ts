import { PdfWriter } from "./pdfLayout";
import { itemKind, type SavedState } from "./savedModel";
import { sectionsOf, techniqueGuide, plantAspectEntries } from "./exportModel";

/**
 * Compila toda a Pokédex (técnicas, conceitos, tipos e os guias já gerados)
 * num único PDF "livro de estudo", em vez do backup JSON técnico.
 */
export function buildPokedexPdf(saved: SavedState, detailCache: Record<string, any>) {
  const w = new PdfWriter();

  // Capa simples
  w.doc.setFont("helvetica", "bold");
  w.doc.setFontSize(28);
  w.doc.setTextColor("#111111");
  w.doc.text("Cognidex", w.margin, 60);
  w.doc.setFont("helvetica", "normal");
  w.doc.setFontSize(12);
  w.doc.setTextColor("#555555");
  w.doc.text("Minha Pokédex de técnicas, conceitos, tipos e plantas", w.margin, 70);
  w.doc.text(new Date().toLocaleDateString("pt-BR"), w.margin, 78);
  w.addPage();

  const techniqueSections = sectionsOf(saved, "technique");
  const knowledgeSections = sectionsOf(saved, "knowledge");
  const plantSections = sectionsOf(saved, "plants");

  function writeTechniqueGroup(displayName: string, techniques: any[]) {
    w.heading(displayName);
    techniques.forEach((t) => {
      w.paragraph(`${t.name} (${t.type})`, { size: 12, style: "bold", gap: 1.5 });
      if (t.statLabels && t.stats) {
        const statsLine = t.statLabels.map((label: string, i: number) => `${label}: ${t.stats[i] ?? "?"}/5`).join("  ·  ");
        w.paragraph(statsLine, { size: 9, color: "#666666", gap: 1.5 });
      }
      w.paragraph(t.description, { size: 10 });
      if (t.bestFor) w.paragraph(`Ideal para: ${t.bestFor}`, { size: 9, style: "italic", color: "#555555" });

      const detail = techniqueGuide(displayName, t, detailCache);
      if (detail) {
        w.paragraph("Guia passo a passo:", { size: 10, style: "bold", gap: 1.5 });
        (detail.steps || []).forEach((step: any, i: number) => {
          w.paragraph(`${i + 1}. ${step.title} — ${step.detail}`, { size: 9.5, gap: 1 });
        });
        if (detail.tip) w.paragraph(`Dica: ${detail.tip}`, { size: 9.5, style: "italic", color: "#555555" });
      }
      w.y += 3;
    });
  }

  function writeKnowledgeGroup(displayName: string, group: any, items: any[]) {
    w.heading(displayName);
    items.forEach((it) => {
      if (itemKind(it, group) === "definition") {
        w.paragraph(`${it.term} (${it.category})`, { size: 12, style: "bold", gap: 1.5 });
        w.paragraph(it.definition, { size: 10 });
        (it.keyPoints || []).forEach((k: string) => w.paragraph(`• ${k}`, { size: 9.5, gap: 1 }));
        if (it.example) w.paragraph(`Exemplo: ${it.example}`, { size: 9.5, style: "italic", color: "#555555" });
      } else {
        w.paragraph(`${it.name}${it.category ? ` (${it.category})` : ""}`, { size: 12, style: "bold", gap: 1.5 });
        w.paragraph(it.description, { size: 10 });
      }
      w.y += 3;
    });
  }

  function writePlantGroup(displayName: string, items: any[]) {
    w.heading(displayName);
    items.forEach((it) => {
      w.paragraph(it.commonNames?.[0] || it.scientificName || it.name, { size: 12, style: "bold", gap: 1.5 });
      if (it.scientificName) w.paragraph(it.scientificName, { size: 9.5, style: "italic", color: "#555555", gap: 1.5 });
      if ((it.commonNames || []).length > 1) {
        w.paragraph(`Também: ${it.commonNames.slice(1).join(", ")}`, { size: 9, color: "#666666", gap: 1.5 });
      }
      w.paragraph(it.summary, { size: 10 });
      for (const { label, text } of plantAspectEntries(it)) {
        w.paragraph(`${label}:`, { size: 10, style: "bold", gap: 1 });
        w.paragraph(text, { size: 9.5 });
      }
      w.y += 3;
    });
  }

  if (techniqueSections.length) {
    w.heading("Técnicas", 20);
    techniqueSections.forEach(({ group, items }) => writeTechniqueGroup(group.displayName || "", items));
  }

  if (knowledgeSections.length) {
    w.addPage();
    w.heading("Conceitos & Tipos", 20);
    knowledgeSections.forEach(({ group, items }) => writeKnowledgeGroup(group.displayName || "", group, items));
  }

  if (plantSections.length) {
    w.addPage();
    w.heading("Plantas", 20);
    plantSections.forEach(({ group, items }) => writePlantGroup(group.displayName || "", items));
  }

  return w.doc;
}

export function downloadPokedexPdf(saved: SavedState, detailCache: Record<string, any>, fileName = "cognidex-pokedex.pdf") {
  const doc = buildPokedexPdf(saved, detailCache);
  doc.save(fileName);
}

export function pokedexPdfBlob(saved: SavedState, detailCache: Record<string, any>) {
  const doc = buildPokedexPdf(saved, detailCache);
  return doc.output("blob");
}
