import { useState } from "react";
import { Search, Link2, X } from "lucide-react";
import { COLORS } from "../theme";
import { slug } from "../theme";

/**
 * Bottom sheet para escolher outro item já salvo e criar um vínculo manual
 * bidirecional com ele. `items` já vem sem o próprio item e sem quem já
 * está vinculado. `onPick(item)`.
 */
export default function LinkPicker({ items, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const q = slug(query.trim());
  const filtered = q
    ? items.filter((it) => slug(it.label).includes(q) || slug(it.subjectDisplay).includes(q))
    : items;

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
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
          <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "15px", color: COLORS.ink, margin: 0 }}>
            Vincular a outro item
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "4px" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2" style={{ marginBottom: "10px", position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: "11px", color: COLORS.screenBorder, pointerEvents: "none" }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar item salvo..."
            style={{
              width: "100%",
              borderRadius: "8px",
              border: `2px solid ${COLORS.screenBorder}`,
              padding: "9px 12px 9px 32px",
              minHeight: "38px",
              fontFamily: "Inter, sans-serif",
              fontSize: "12.5px",
              background: COLORS.surface,
              color: COLORS.ink,
              outline: "none",
            }}
          />
        </div>

        <div style={{ overflowY: "auto" }}>
          {filtered.length === 0 && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", padding: "8px 2px" }}>
              Nada encontrado.
            </p>
          )}
          {filtered.map((it) => (
            <button
              key={`${it.subjectKey}:${it.itemId}`}
              onClick={() => onPick(it)}
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
              <Link2 size={15} style={{ flexShrink: 0, color: COLORS.lensBlue }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.label}
                <span style={{ color: "var(--text-muted)", fontSize: "11px" }}> — {it.subjectDisplay}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
