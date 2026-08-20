/**
 * Gera um PDF de UM card salvo/pesquisado (técnica, conceito, item de lista
 * ou palavra), pra compartilhar/baixar — usado pelo botão "Compartilhar" dos
 * cards, no lugar do texto simples ou da imagem PNG.
 */
import { jsPDF } from "jspdf";

const MARGIN = 18;
const CONTENT_WIDTH = 210 - MARGIN * 2;

function newDoc() {
  return new jsPDF({ unit: "mm", format: "a4" });
}

function writeMeta(doc, text, y) {
  if (!text) return y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#5c6b52");
  doc.text(text.toUpperCase(), MARGIN, y);
  return y + 7;
}

function writeTitle(doc, text, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor("#23291F");
  const lines = doc.splitTextToSize(text || "", CONTENT_WIDTH);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 9 + 4;
}

function writeParagraph(doc, text, y, { size = 11, color = "#3a3a30", style = "normal", gap = 5 } = {}) {
  if (!text) return y;
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(color);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
  doc.text(lines, MARGIN, y);
  return y + lines.length * size * 0.42 + gap;
}

function writeHeading(doc, text, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor("#23291F");
  doc.text(text, MARGIN, y);
  return y + 7;
}

function writeFooter(doc) {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor("#5c6b52");
  doc.text("via Bookdex", MARGIN, 285);
}

export function techniqueCardPdfBlob(subjectDisplay, technique, statLabels) {
  const doc = newDoc();
  let y = 22;
  y = writeMeta(doc, subjectDisplay, y);
  y = writeTitle(doc, technique.name, y);
  y = writeMeta(doc, technique.type || "", y) + 2;
  y = writeParagraph(doc, technique.description || "", y);
  (statLabels || []).forEach((label, i) => {
    const v = technique.stats ? technique.stats[i] || 0 : 0;
    y = writeParagraph(doc, `${label}: ${"●".repeat(v)}${"○".repeat(Math.max(0, 5 - v))} (${v}/5)`, y, { size: 10.5, gap: 3 });
  });
  y += 3;
  if (technique.bestFor) y = writeParagraph(doc, `Ideal para: ${technique.bestFor}`, y, { size: 10.5, style: "italic", color: "#5c6b52" });
  writeFooter(doc);
  return doc.output("blob");
}

export function definitionCardPdfBlob(definition) {
  const doc = newDoc();
  let y = 22;
  y = writeMeta(doc, "Conceito", y);
  y = writeTitle(doc, definition.term, y);
  y = writeMeta(doc, definition.category || "", y) + 2;
  y = writeParagraph(doc, definition.definition || "", y);
  if ((definition.keyPoints || []).length) {
    y = writeHeading(doc, "Pontos-chave", y);
    for (const p of definition.keyPoints) {
      y = writeParagraph(doc, `•  ${p}`, y, { size: 10.5, gap: 3 });
    }
    y += 3;
  }
  if (definition.example) {
    y = writeParagraph(doc, `Exemplo: ${definition.example}`, y, { size: 10.5, style: "italic", color: "#5c6b52" });
  }
  if ((definition.relatedTerms || []).length) {
    y = writeParagraph(doc, `Relacionados: ${definition.relatedTerms.join(", ")}`, y, { size: 10, color: "#5c6b52" });
  }
  writeFooter(doc);
  return doc.output("blob");
}

export function listItemCardPdfBlob(subjectDisplay, item) {
  const doc = newDoc();
  let y = 22;
  y = writeMeta(doc, subjectDisplay, y);
  y = writeTitle(doc, item.name, y);
  y = writeMeta(doc, item.category || "", y) + 2;
  y = writeParagraph(doc, item.description || "", y);
  writeFooter(doc);
  return doc.output("blob");
}

export function wordCardPdfBlob(data) {
  const doc = newDoc();
  const isZh = (data.languageCode || "").toLowerCase() === "zh";
  let y = 22;
  y = writeMeta(doc, data.language, y);
  y = writeTitle(doc, data.word, y);
  if (isZh && data.pinyin) y = writeMeta(doc, data.pinyin, y) + 2;
  y = writeParagraph(doc, data.meaning || "", y);
  if (!isZh && data.radical) {
    y = writeParagraph(doc, `Radical: ${data.radical}`, y, { size: 10.5, style: "italic", color: "#5c6b52" });
  }
  if (isZh && (data.characters || []).length) {
    y = writeHeading(doc, "Por caractere", y);
    for (const c of data.characters) {
      const comps = [c.semanticComponent && `S: ${c.semanticComponent}`, c.phoneticComponent && `F: ${c.phoneticComponent}`]
        .filter(Boolean)
        .join("   ");
      y = writeParagraph(doc, `${c.hanzi} (${c.pinyin || ""})${c.meaning ? ` — ${c.meaning}` : ""}`, y, { size: 11, style: "bold", gap: 2 });
      if (comps) y = writeParagraph(doc, comps, y, { size: 10, color: "#5c6b52" });
      y += 2;
    }
  }
  writeFooter(doc);
  return doc.output("blob");
}
