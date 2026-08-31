/**
 * Compartilhamento e exportação de itens individuais.
 *
 * Web Share API quando disponível (mobile/PWA instalado); em desktop ou
 * quando indisponível, cai para clipboard (texto) ou download de arquivo (md).
 */

export async function shareOrCopyText(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      // segue para o fallback de clipboard se o share nativo falhar
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export function downloadTextFile(fileName, content, mime = "text/markdown") {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareOrDownloadFile(fileName, content, mime, title) {
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([content], fileName, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, files: [file] });
        return "shared";
      }
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      // segue para download
    }
  }
  downloadTextFile(fileName, content, mime);
  return "downloaded";
}

export function guideMarkdown(subjectDisplay, technique, detail) {
  const lines = [
    `# ${technique.name}`,
    "",
    `_${subjectDisplay} · ${technique.type}_`,
    "",
    detail.overview,
    "",
    "## Passo a passo",
    "",
    ...(detail.steps || []).flatMap((s, i) => [`${i + 1}. **${s.title}** — ${s.detail}`]),
  ];
  if ((detail.rightSigns || []).length) {
    lines.push("", "## Sinais de que está certo", "", ...detail.rightSigns.map((s) => `- ✅ ${s}`));
  }
  if ((detail.wrongSigns || []).length) {
    lines.push("", "## Sinais de que está errado", "", ...detail.wrongSigns.map((s) => `- ❌ ${s}`));
  }
  if (detail.tip) {
    lines.push("", `> **Dica:** ${detail.tip}`);
  }
  lines.push("", "---", "_Exportado do Cognidex_");
  return lines.join("\n");
}
