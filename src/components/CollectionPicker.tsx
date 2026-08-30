import { useState } from "react";
import { Folder, Plus, X } from "lucide-react";
import { COLORS, primaryButtonStyle } from "../theme";

/**
 * Bottom sheet para escolher (ou criar) uma coleção ao adicionar itens
 * selecionados em lote. `onPick(collectionId, newName?)`: `collectionId` nulo
 * significa "criar uma coleção nova com este nome".
 */
export default function CollectionPicker({ collections, onPick, onClose }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const list = Object.values(collections || {}).sort((a, b) => b.createdAt - a.createdAt);

  function submitNew() {
    const clean = name.trim();
    if (!clean) return;
    onPick(null, clean);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          background: COLORS.surface,
          borderTop: `3px solid ${COLORS.screenBorder}`,
          borderRadius: "16px 16px 0 0",
          padding: "16px calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))",
          maxHeight: "70vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
          <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "15px", color: COLORS.ink, margin: 0 }}>
            Adicionar à coleção
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "4px" }}
          >
            <X size={18} />
          </button>
        </div>

        {list.map((col) => (
          <button
            key={col.id}
            onClick={() => onPick(col.id)}
            className="flex items-center gap-2"
            style={{
              width: "100%",
              minHeight: "44px",
              background: "transparent",
              border: `2px solid ${COLORS.screenBorder}`,
              borderRadius: "8px",
              padding: "0 12px",
              marginBottom: "8px",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
              color: COLORS.ink,
              textAlign: "left",
            }}
          >
            <Folder size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.name}</span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", color: "var(--text-muted)" }}>
              {(col.refs || []).length}
            </span>
          </button>
        ))}

        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-1.5"
            style={{
              ...primaryButtonStyle,
              width: "100%",
              background: "transparent",
              color: COLORS.ink,
              border: `2px dashed ${COLORS.screenBorder}`,
            }}
          >
            <Plus size={16} /> Nova coleção
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNew();
              }}
              placeholder="Nome da coleção"
              style={{
                flex: 1,
                borderRadius: "8px",
                border: `2px solid ${COLORS.screenBorder}`,
                padding: "10px 12px",
                minHeight: "44px",
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                background: COLORS.surface,
                color: COLORS.ink,
                outline: "none",
              }}
            />
            <button
              onClick={submitNew}
              disabled={!name.trim()}
              style={{ ...primaryButtonStyle, opacity: name.trim() ? 1 : 0.5, flexShrink: 0 }}
            >
              Criar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
