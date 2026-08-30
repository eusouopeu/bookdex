import { useState, type MouseEvent } from "react";
import { Share2, Check, Loader2 } from "lucide-react";
import { COLORS, slug } from "../theme";
import { shareOrDownloadFile } from "../lib/share";

/** Botão de compartilhar reutilizável: gera um PDF do card sob demanda (via `render`) e compartilha/baixa. */
interface ShareButtonProps {
  title: string;
  render: () => Promise<Blob | null> | Blob | null;
  size?: number;
  label?: string;
}

export default function ShareButton({ title, render, size = 15, label }: ShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const [justShared, setJustShared] = useState(false);

  async function handleClick(e: MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) return;
      const fileName = `bookdex-${slug(title)}.pdf`;
      const outcome = await shareOrDownloadFile(fileName, blob, "application/pdf", title);
      if (outcome !== "cancelled") {
        setJustShared(true);
        setTimeout(() => setJustShared(false), 1600);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      aria-label="Compartilhar em PDF"
      title={justShared ? "Pronto!" : "Compartilhar em PDF"}
      className="flex items-center gap-1"
      style={{
        background: "none",
        border: "none",
        cursor: busy ? "default" : "pointer",
        padding: label ? "6px 8px" : "9px",
        margin: label ? 0 : "-9px",
        flexShrink: 0,
        opacity: busy ? 0.6 : 1,
        color: justShared ? "var(--success)" : COLORS.screenBorder,
        fontFamily: '"Baloo 2", sans-serif',
        fontWeight: 700,
        fontSize: "11px",
      }}
    >
      {busy ? (
        <Loader2 size={size} style={{ animation: "spin 0.9s linear infinite" }} />
      ) : justShared ? (
        <Check size={size} />
      ) : (
        <Share2 size={size} />
      )}
      {label && (justShared ? "Pronto!" : label)}
    </button>
  );
}
