import { Link2, Plus, X } from "lucide-react";
import { COLORS } from "../theme";

/** Chips dos vínculos manuais de um item salvo, com botão para abrir o seletor e criar mais. */
export default function LinksEditor({ links, onOpenPicker, onRemove, onJump }) {
  return (
    <div className="flex items-center" style={{ flexWrap: "wrap", gap: "6px", marginTop: "9px" }} onClick={(e) => e.stopPropagation()}>
      {links.map((link) => (
        <span
          key={`${link.subjectKey}:${link.itemId}`}
          className="flex items-center gap-1"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "10px",
            color: COLORS.ink,
            background: "rgba(155,89,182,0.12)",
            border: "1.5px solid #9B59B6",
            borderRadius: "999px",
            padding: "2px 4px 2px 8px",
          }}
        >
          <button
            onClick={() => onJump(link)}
            title={`Ir para ${link.label} (${link.subjectDisplay})`}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, display: "flex", alignItems: "center", gap: "3px" }}
          >
            <Link2 size={9} /> {link.label}
          </button>
          <button
            onClick={() => onRemove(link)}
            aria-label={`Remover vínculo com ${link.label}`}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9B59B6", padding: "2px", display: "flex" }}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <button
        onClick={onOpenPicker}
        className="flex items-center gap-1"
        aria-label="Vincular a outro item"
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "10px",
          color: "#9B59B6",
          background: "transparent",
          border: "1.5px dashed #9B59B6",
          borderRadius: "999px",
          padding: "2px 8px",
          cursor: "pointer",
        }}
      >
        <Link2 size={10} /> <Plus size={10} />
      </button>
    </div>
  );
}
