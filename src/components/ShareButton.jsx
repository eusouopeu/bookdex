import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { COLORS } from "../theme";
import { shareOrCopyText } from "../lib/share";

/** Botão de compartilhar reutilizável: Web Share nativo, com fallback de clipboard. */
export default function ShareButton({ title, text, size = 15, label }) {
  const [justCopied, setJustCopied] = useState(false);

  async function handleClick(e) {
    e.stopPropagation();
    const outcome = await shareOrCopyText(title, text);
    if (outcome === "copied") {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1600);
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label="Compartilhar"
      title={justCopied ? "Copiado!" : "Compartilhar"}
      className="flex items-center gap-1"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: label ? "6px 8px" : "9px",
        margin: label ? 0 : "-9px",
        flexShrink: 0,
        color: justCopied ? "var(--success)" : COLORS.screenBorder,
        fontFamily: '"Baloo 2", sans-serif',
        fontWeight: 700,
        fontSize: "11px",
      }}
    >
      {justCopied ? <Check size={size} /> : <Share2 size={size} />}
      {label && (justCopied ? "Copiado!" : label)}
    </button>
  );
}
