import { useState } from "react";
import { Image as ImageIcon, Check } from "lucide-react";
import { COLORS } from "../theme";
import { shareOrDownloadFile } from "../lib/share";
import { slug } from "../theme";

/** Compartilha/baixa um card salvo como imagem PNG (ao contrário do ShareButton, que envia texto). */
export default function ShareImageButton({ title, render, size = 15 }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClick(e) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) return;
      const fileName = `bookdex-${slug(title)}.png`;
      await shareOrDownloadFile(fileName, blob, "image/png", title);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label="Compartilhar como imagem"
      title={done ? "Pronto!" : "Compartilhar como imagem"}
      disabled={busy}
      className="flex items-center gap-1"
      style={{
        background: "none",
        border: "none",
        cursor: busy ? "default" : "pointer",
        padding: "9px",
        margin: "-9px",
        flexShrink: 0,
        color: done ? "var(--success)" : COLORS.screenBorder,
        opacity: busy ? 0.5 : 1,
      }}
    >
      {done ? <Check size={size} /> : <ImageIcon size={size} />}
    </button>
  );
}
