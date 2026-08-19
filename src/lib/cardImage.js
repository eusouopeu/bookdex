/**
 * Renderiza um card salvo (técnica/conceito/item) num canvas off-screen e
 * devolve um PNG (Blob), pra compartilhar/baixar como imagem — ao contrário
 * do ShareButton (texto), isso produz algo pronto pra postar num story/print.
 *
 * Paleta fixa (não segue o tema claro/escuro do app): a imagem precisa ficar
 * legível em qualquer lugar pra onde for compartilhada.
 */
const PALETTE = {
  bg: "#F5F5F0",
  border: "#5C6B52",
  ink: "#23291F",
  text: "#3a3a30",
  textMuted: "#5c6b52",
  gold: "#FFC947",
  goldInk: "#4A3300",
};

const TYPE_COLORS = [
  { bg: "#2A9D8F", text: "#FFFFFF" },
  { bg: "#E9B44C", text: "#3D2B00" },
  { bg: "#8E7CC3", text: "#FFFFFF" },
  { bg: "#F4845F", text: "#3D1400" },
  { bg: "#4A7C9E", text: "#FFFFFF" },
  { bg: "#6A9955", text: "#FFFFFF" },
  { bg: "#C2558B", text: "#FFFFFF" },
  { bg: "#6C7A89", text: "#FFFFFF" },
];

function typeColor(type) {
  let hash = 0;
  const s = type || "geral";
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return TYPE_COLORS[Math.abs(hash) % TYPE_COLORS.length];
}

const WIDTH = 880;
const PAD = 40;

function wrapLines(ctx, text, maxWidth) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  const lines = wrapLines(ctx, text, maxWidth);
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTypeBadge(ctx, type, x, y) {
  const color = typeColor(type);
  ctx.font = "700 15px Arial";
  const w = ctx.measureText(type.toUpperCase()).width + 24;
  roundRect(ctx, x, y, w, 30, 15);
  ctx.fillStyle = color.bg;
  ctx.fill();
  ctx.fillStyle = color.text;
  ctx.textBaseline = "middle";
  ctx.fillText(type.toUpperCase(), x + 12, y + 16);
  ctx.textBaseline = "alphabetic";
  return y + 30;
}

function drawStatBars(ctx, statLabels, stats, x, y, color) {
  ctx.font = "700 13px 'Courier New', monospace";
  for (let i = 0; i < (statLabels || []).length; i++) {
    const label = statLabels[i];
    const value = stats ? stats[i] || 0 : 0;
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(label.toUpperCase(), x, y + 12);
    let bx = x + 190;
    for (let n = 1; n <= 5; n++) {
      const filled = n <= value;
      ctx.fillStyle = filled ? color.bg : "transparent";
      roundRect(ctx, bx, y + 2, 26, 14, 3);
      if (filled) ctx.fill();
      ctx.strokeStyle = filled ? color.bg : PALETTE.border;
      ctx.globalAlpha = filled ? 1 : 0.4;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      bx += 32;
    }
    y += 30;
  }
  return y;
}

function drawFooter(ctx, height) {
  ctx.font = "700 13px Arial";
  ctx.fillStyle = PALETTE.textMuted;
  ctx.fillText("via Bookdex", PAD, height - 20);
}

function newCanvas(height) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.strokeStyle = PALETTE.border;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, WIDTH - 4, height - 4);
  return { canvas, ctx };
}

function toPngBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export async function renderTechniqueCardImage(subjectDisplay, technique, statLabels) {
  const labels = statLabels || technique.statLabels || [];
  const height = 260 + labels.length * 30 + (subjectDisplay ? 30 : 0);
  const { canvas, ctx } = newCanvas(height);
  const color = typeColor(technique.type);
  let y = PAD;

  if (subjectDisplay) {
    ctx.font = "700 15px 'Courier New', monospace";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.fillText(subjectDisplay.toUpperCase(), PAD, y + 12);
    y += 30;
  }

  ctx.font = "800 34px Arial";
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(technique.name, PAD, y + 28);
  y += 46;

  y = drawTypeBadge(ctx, technique.type || "geral", PAD, y) + 20;

  y = drawWrapped(ctx, technique.description || "", PAD, y, WIDTH - PAD * 2, 26, "400 18px Arial", PALETTE.text) + 14;

  y = drawStatBars(ctx, labels, technique.stats, PAD, y, color) + 10;

  if (technique.bestFor) {
    ctx.font = "italic 400 15px Arial";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.fillText(`Ideal para: ${technique.bestFor}`, PAD, y + 14);
  }

  drawFooter(ctx, height);
  return toPngBlob(canvas);
}

export async function renderDefinitionCardImage(definition) {
  const points = definition.keyPoints || [];
  const height = 260 + points.length * 26 + (definition.example ? 60 : 0);
  const { canvas, ctx } = newCanvas(height);
  let y = PAD;

  ctx.font = "700 15px 'Courier New', monospace";
  ctx.fillStyle = PALETTE.textMuted;
  ctx.fillText("CONCEITO", PAD, y + 12);
  y += 30;

  ctx.font = "800 34px Arial";
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(definition.term, PAD, y + 28);
  y += 50;

  y = drawWrapped(ctx, definition.definition || "", PAD, y, WIDTH - PAD * 2, 26, "400 18px Arial", PALETTE.text) + 14;

  if (points.length) {
    ctx.font = "700 16px Arial";
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText("Pontos-chave", PAD, y + 14);
    y += 28;
    for (const p of points) {
      y = drawWrapped(ctx, `• ${p}`, PAD, y, WIDTH - PAD * 2, 22, "400 15px Arial", PALETTE.text) + 4;
    }
    y += 10;
  }

  if (definition.example) {
    roundRect(ctx, PAD, y, WIDTH - PAD * 2, 50, 8);
    ctx.fillStyle = "rgba(255,201,71,0.3)";
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "400 14px Arial";
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(`Exemplo: ${definition.example}`, PAD + 12, y + 30);
  }

  drawFooter(ctx, height);
  return toPngBlob(canvas);
}

export async function renderWordCardImage(data) {
  const isZh = (data.languageCode || "").toLowerCase() === "zh";
  const characters = isZh ? data.characters || [] : [];
  const compLine = (c) => [c.semanticComponent && `S: ${c.semanticComponent}`, c.phoneticComponent && `F: ${c.phoneticComponent}`].filter(Boolean).length;
  const height = 260 + (!isZh && data.radical ? 30 : 0) + characters.reduce((sum, c) => sum + 46 + (compLine(c) ? 24 : 0), 0);
  const { canvas, ctx } = newCanvas(height);
  let y = PAD;

  ctx.font = "700 15px 'Courier New', monospace";
  ctx.fillStyle = PALETTE.textMuted;
  ctx.fillText((data.language || "").toUpperCase(), PAD, y + 12);
  y += 30;

  ctx.font = "800 34px Arial";
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(data.word, PAD, y + 28);
  if (isZh && data.pinyin) {
    const wordWidth = ctx.measureText(data.word).width;
    ctx.font = "400 18px 'Courier New', monospace";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.fillText(data.pinyin, PAD + wordWidth + 16, y + 28);
  }
  y += 50;

  y = drawWrapped(ctx, data.meaning || "", PAD, y, WIDTH - PAD * 2, 26, "400 18px Arial", PALETTE.text) + 10;

  if (!isZh && data.radical) {
    y = drawWrapped(ctx, `Radical: ${data.radical}`, PAD, y, WIDTH - PAD * 2, 22, "italic 400 15px Arial", PALETTE.textMuted) + 6;
  }
  if (isZh && characters.length) {
    y += 6;
    for (const c of characters) {
      ctx.font = "700 18px Arial";
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText(`${c.hanzi} (${c.pinyin || ""})`, PAD, y + 16);
      y += 24;
      y = drawWrapped(ctx, c.meaning || "", PAD, y, WIDTH - PAD * 2, 20, "400 14px Arial", PALETTE.textMuted) + 6;
      const comps = [c.semanticComponent && `S: ${c.semanticComponent}`, c.phoneticComponent && `F: ${c.phoneticComponent}`].filter(Boolean);
      if (comps.length) {
        y = drawWrapped(ctx, comps.join("   "), PAD, y, WIDTH - PAD * 2, 20, "400 15px Arial", PALETTE.textMuted) + 6;
      }
      y += 6;
    }
  }

  drawFooter(ctx, height);
  return toPngBlob(canvas);
}

export async function renderListItemCardImage(subjectDisplay, item) {
  const height = 260;
  const { canvas, ctx } = newCanvas(height);
  let y = PAD;

  if (subjectDisplay) {
    ctx.font = "700 15px 'Courier New', monospace";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.fillText(subjectDisplay.toUpperCase(), PAD, y + 12);
    y += 30;
  }

  ctx.font = "800 34px Arial";
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(item.name, PAD, y + 28);
  y += 46;

  y = drawTypeBadge(ctx, item.category || "geral", PAD, y) + 20;

  drawWrapped(ctx, item.description || "", PAD, y, WIDTH - PAD * 2, 26, "400 18px Arial", PALETTE.text);

  drawFooter(ctx, height);
  return toPngBlob(canvas);
}
