import { useState } from "react";
import { StickyNote } from "lucide-react";
import { COLORS } from "../../../theme";

/** Anotação pessoal livre num item salvo — chip para abrir/fechar um textarea, salva ao perder o foco. */
export default function NoteEditor({ note, onChange }: { note?: string; onChange: (note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note || "");

  function commit() {
    const clean = draft.trim();
    if (clean !== (note || "")) onChange(clean);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDraft(note || "");
          setOpen(true);
        }}
        className="flex items-center gap-1"
        aria-label={note ? "Editar anotação" : "Adicionar anotação"}
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "10px",
          color: note ? "#7A5A00" : COLORS.screenBorder,
          background: note ? "rgba(255,201,71,0.22)" : "transparent",
          border: `1.5px ${note ? "solid" : "dashed"} ${note ? COLORS.gold : COLORS.screenBorder}`,
          borderRadius: "999px",
          padding: "2px 8px",
          marginTop: "9px",
          cursor: "pointer",
        }}
      >
        <StickyNote size={10} /> {note ? "Nota" : "Anotar"}
      </button>
    );
  }

  return (
    <div style={{ marginTop: "9px" }} onClick={(e) => e.stopPropagation()}>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(note || "");
            setOpen(false);
          }
        }}
        placeholder="Sua anotação pessoal sobre este item..."
        rows={3}
        style={{
          width: "100%",
          borderRadius: "8px",
          border: `1.5px solid ${COLORS.gold}`,
          padding: "8px 10px",
          fontFamily: "Inter, sans-serif",
          fontSize: "12px",
          lineHeight: 1.4,
          background: COLORS.surface,
          color: COLORS.ink,
          outline: "none",
          resize: "vertical",
        }}
      />
      <div className="flex justify-end" style={{ marginTop: "4px" }}>
        <button
          onClick={commit}
          style={{
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "10.5px",
            color: COLORS.lensBlue,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          Salvar nota
        </button>
      </div>
    </div>
  );
}
