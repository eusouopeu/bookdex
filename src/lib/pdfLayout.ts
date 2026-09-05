/**
 * Camada fina sobre jsPDF pra fluxo de texto: parágrafo/título que quebram
 * linha e avançam `y` sozinhos, com salto de página automático quando o
 * conteúdo não cabe. Usada por `pdfExport.ts` (livro inteiro, múltiplas
 * seções) e `cardPdf.ts` (um card só) — antes cada um reimplementava essa
 * mesma mecânica com nomes e assinaturas diferentes.
 */
import { jsPDF } from "jspdf";

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

interface ParagraphOpts {
  size?: number;
  style?: "normal" | "bold" | "italic";
  color?: string;
  gap?: number;
}

export class PdfWriter {
  doc: jsPDF;
  margin: number;
  contentWidth: number;
  pageHeight: number;
  y: number;

  constructor({ margin = 15, pageHeight = A4_HEIGHT_MM }: { margin?: number; pageHeight?: number } = {}) {
    this.doc = new jsPDF({ unit: "mm", format: "a4" });
    this.margin = margin;
    this.contentWidth = A4_WIDTH_MM - margin * 2;
    this.pageHeight = pageHeight;
    this.y = margin;
  }

  ensureSpace(lines = 1, lineHeight = 5) {
    if (this.y + lines * lineHeight > this.pageHeight - this.margin) {
      this.addPage();
    }
  }

  addPage() {
    this.doc.addPage();
    this.y = this.margin;
  }

  paragraph(text: string | undefined, { size = 10, style = "normal", color = "#222222", gap = 4 }: ParagraphOpts = {}) {
    if (!text) return;
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(color);
    const lines = this.doc.splitTextToSize(text, this.contentWidth) as string[];
    this.ensureSpace(lines.length, size * 0.42);
    this.doc.text(lines, this.margin, this.y);
    this.y += lines.length * size * 0.42 + gap;
  }

  heading(text: string, size = 16) {
    this.ensureSpace(2, size * 0.5);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(size);
    this.doc.setTextColor("#111111");
    this.doc.text(text, this.margin, this.y);
    this.y += size * 0.5 + 2;
  }

  meta(text: string | undefined, color = "#5c6b52") {
    if (!text) return;
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.doc.setTextColor(color);
    this.doc.text(text.toUpperCase(), this.margin, this.y);
    this.y += 7;
  }

  title(text: string | undefined) {
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(22);
    this.doc.setTextColor("#23291F");
    const lines = this.doc.splitTextToSize(text || "", this.contentWidth) as string[];
    this.doc.text(lines, this.margin, this.y);
    this.y += lines.length * 9 + 4;
  }

  footer(text = "via Cognidex") {
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(9);
    this.doc.setTextColor("#5c6b52");
    this.doc.text(text, this.margin, this.pageHeight - 12);
  }
}
