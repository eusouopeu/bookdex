/**
 * Gera um PDF de UM card salvo/pesquisado (técnica, conceito, item de lista
 * ou palavra), pra compartilhar/baixar — usado pelo botão "Compartilhar" dos
 * cards, no lugar do texto simples ou da imagem PNG.
 */
import { jsPDF } from "jspdf";
import { PLANT_ASPECTS } from "./anthropic";

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
      y = writeParagraph(doc, `${c.hanzi} (${c.pinyin || ""})${c.meaning ? ` — ${c.meaning}` : ""}`, y, { size: 11, style: "bold", gap: 4 });
    }
  }
  writeFooter(doc);
  return doc.output("blob");
}

/**
 * Card de planta: a foto (quando existe) abre a página em tamanho fixo, e só
 * os aspectos já gerados entram — o PDF não dispara chamada nenhuma.
 */
export function plantCardPdfBlob(plant, aspects) {
  const doc = newDoc();
  let y = 22;
  if (plant.images && plant.images[0]) {
    const w = CONTENT_WIDTH;
    const h = 70;
    try {
      doc.addImage(plant.images[0], "JPEG", MARGIN, y, w, h, undefined, "FAST");
      y += h + 8;
    } catch {
      /* imagem ilegível: segue sem ela em vez de derrubar o PDF inteiro */
    }
  }
  y = writeMeta(doc, plant.family || "Planta", y);
  y = writeTitle(doc, plant.commonNames?.[0] || plant.scientificName || "", y);
  if (plant.scientificName) y = writeParagraph(doc, plant.scientificName, y, { size: 11, style: "italic", color: "#5c6b52" });
  if ((plant.commonNames || []).length > 1) {
    y = writeParagraph(doc, `Também conhecida como: ${plant.commonNames.slice(1).join(", ")}`, y, { size: 10, color: "#5c6b52" });
  }
  y += 2;
  y = writeParagraph(doc, plant.summary || "", y);
  if (plant.idNote) y = writeParagraph(doc, plant.idNote, y, { size: 10, style: "italic", color: "#5c6b52" });

  for (const aspect of PLANT_ASPECTS) {
    const text = (aspects || plant.aspects || {})[aspect.id];
    if (!text) continue;
    if (y > 250) {
      doc.addPage();
      y = 22;
    }
    y = writeHeading(doc, aspect.label, y);
    y = writeParagraph(doc, text, y, { size: 10.5 });
  }
  writeFooter(doc);
  return doc.output("blob");
}
