/**
 * Gera um PDF de UM card salvo/pesquisado (técnica, conceito, item de lista
 * ou palavra), pra compartilhar/baixar — usado pelo botão "Compartilhar" dos
 * cards, no lugar do texto simples ou da imagem PNG.
 */
import { PdfWriter } from "./pdfLayout";
import { PLANT_ASPECTS } from "./anthropic";

export function techniqueCardPdfBlob(subjectDisplay: string, technique: any, statLabels: string[]) {
  const w = new PdfWriter({ margin: 18 });
  w.y = 22;
  w.meta(subjectDisplay);
  w.title(technique.name);
  w.meta(technique.type || "");
  w.y += 2;
  w.paragraph(technique.description || "");
  (statLabels || []).forEach((label, i) => {
    const v = technique.stats ? technique.stats[i] || 0 : 0;
    w.paragraph(`${label}: ${"●".repeat(v)}${"○".repeat(Math.max(0, 5 - v))} (${v}/5)`, { size: 10.5, gap: 3 });
  });
  w.y += 3;
  if (technique.bestFor) w.paragraph(`Ideal para: ${technique.bestFor}`, { size: 10.5, style: "italic", color: "#5c6b52" });
  w.footer();
  return w.doc.output("blob");
}

export function definitionCardPdfBlob(definition: any) {
  const w = new PdfWriter({ margin: 18 });
  w.y = 22;
  w.meta("Conceito");
  w.title(definition.term);
  w.meta(definition.category || "");
  w.y += 2;
  w.paragraph(definition.definition || "");
  if ((definition.keyPoints || []).length) {
    w.heading("Pontos-chave", 13);
    for (const p of definition.keyPoints) {
      w.paragraph(`•  ${p}`, { size: 10.5, gap: 3 });
    }
    w.y += 3;
  }
  if (definition.example) {
    w.paragraph(`Exemplo: ${definition.example}`, { size: 10.5, style: "italic", color: "#5c6b52" });
  }
  if ((definition.relatedTerms || []).length) {
    w.paragraph(`Relacionados: ${definition.relatedTerms.join(", ")}`, { size: 10, color: "#5c6b52" });
  }
  w.footer();
  return w.doc.output("blob");
}

export function listItemCardPdfBlob(subjectDisplay: string, item: any) {
  const w = new PdfWriter({ margin: 18 });
  w.y = 22;
  w.meta(subjectDisplay);
  w.title(item.name);
  w.meta(item.category || "");
  w.y += 2;
  w.paragraph(item.description || "");
  w.footer();
  return w.doc.output("blob");
}

export function wordCardPdfBlob(data: any) {
  const w = new PdfWriter({ margin: 18 });
  const isZh = (data.languageCode || "").toLowerCase() === "zh";
  w.y = 22;
  w.meta(data.language);
  w.title(data.word);
  if (isZh && data.pinyin) {
    w.meta(data.pinyin);
    w.y += 2;
  }
  w.paragraph(data.meaning || "");
  if (!isZh && data.radical) {
    w.paragraph(`Radical: ${data.radical}`, { size: 10.5, style: "italic", color: "#5c6b52" });
  }
  if (isZh && (data.characters || []).length) {
    w.heading("Por caractere", 13);
    for (const c of data.characters) {
      w.paragraph(`${c.hanzi} (${c.pinyin || ""})${c.meaning ? ` — ${c.meaning}` : ""}`, { size: 11, style: "bold", gap: 4 });
    }
  }
  w.footer();
  return w.doc.output("blob");
}

/**
 * Card de planta: a foto (quando existe) abre a página em tamanho fixo, e só
 * os aspectos já gerados entram — o PDF não dispara chamada nenhuma.
 */
export function plantCardPdfBlob(plant: any, aspects: Record<string, string>) {
  const w = new PdfWriter({ margin: 18 });
  w.y = 22;
  if (plant.images && plant.images[0]) {
    const h = 70;
    try {
      w.doc.addImage(plant.images[0], "JPEG", w.margin, w.y, w.contentWidth, h, undefined, "FAST");
      w.y += h + 8;
    } catch {
      /* imagem ilegível: segue sem ela em vez de derrubar o PDF inteiro */
    }
  }
  w.meta(plant.family || "Planta");
  w.title(plant.commonNames?.[0] || plant.scientificName || "");
  if (plant.scientificName) w.paragraph(plant.scientificName, { size: 11, style: "italic", color: "#5c6b52" });
  if ((plant.commonNames || []).length > 1) {
    w.paragraph(`Também conhecida como: ${plant.commonNames.slice(1).join(", ")}`, { size: 10, color: "#5c6b52" });
  }
  w.y += 2;
  w.paragraph(plant.summary || "");
  if (plant.idNote) w.paragraph(plant.idNote, { size: 10, style: "italic", color: "#5c6b52" });

  const source = aspects || plant.aspects || {};
  for (const aspect of PLANT_ASPECTS) {
    const text = source[aspect.id];
    if (!text) continue;
    w.ensureSpace(4, 10);
    w.heading(aspect.label, 13);
    w.paragraph(text, { size: 10.5 });
  }
  w.footer();
  return w.doc.output("blob");
}
