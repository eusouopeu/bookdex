import { Check, FolderPlus, Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import { COLORS } from "../theme";

const bulkBtnStyle = (color, border, disabled) => ({
  background: "transparent",
  color,
  border: `1.5px solid ${border}`,
  borderRadius: "8px",
  width: "30px",
  height: "30px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

/**
 * Faixa de aviso do modo comparar + barra flutuante "Comparar (N) / Cancelar".
 * Extraído do DexView junto com `SelectToolbar` — os dois modos de seleção
 * (comparar técnicas, selecionar em massa) tinham a mesma aparência de
 * checkbox no card mas cada um sua própria barra; separar em componentes deixa
 * o DexView só com a lógica de estado.
 */
export function CompareBanner({ count, max }) {
  return (
    <div
      style={{
        background: "rgba(46,134,222,0.1)",
        border: `2px solid ${COLORS.lensBlue}`,
        borderRadius: "10px",
        padding: "8px 10px",
        marginBottom: "10px",
        fontFamily: "Inter, sans-serif",
        fontSize: "11.5px",
        color: COLORS.ink,
      }}
    >
      Selecione de 2 a {max} técnicas para comparar lado a lado ({count}/{max}).
    </div>
  );
}

export function CompareBar({ count, onLaunch, onCancel }) {
  return (
    <div style={{ position: "sticky", bottom: "4px", display: "flex", justifyContent: "center", marginTop: "14px" }}>
      <div className="flex gap-2">
        <button
          onClick={onLaunch}
          disabled={count < 2}
          style={{
            background: COLORS.lensBlue,
            color: "#fff",
            border: "none",
            borderRadius: "999px",
            padding: "10px 18px",
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "12.5px",
            cursor: count < 2 ? "default" : "pointer",
            opacity: count < 2 ? 0.5 : 1,
            boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
          }}
        >
          Comparar ({count})
        </button>
        <button
          onClick={onCancel}
          style={{
            background: "#23291F",
            color: "#fff",
            border: "none",
            borderRadius: "999px",
            padding: "10px 16px",
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "12.5px",
            cursor: "pointer",
            boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Barra flutuante do modo "selecionar em massa": tag, coleção, arquivar, excluir. */
export function SelectBar({
  count,
  tagDraft,
  onTagDraftChange,
  onApplyTag,
  onPickCollection,
  canAddToCollection,
  onArchive,
  canArchive,
  showArchived,
  onDelete,
  confirmingDelete,
  onCancel,
}) {
  return (
    <div style={{ position: "sticky", bottom: "4px", display: "flex", justifyContent: "center", marginTop: "14px" }}>
      <div
        className="flex items-center"
        style={{
          gap: "5px",
          background: COLORS.surface,
          border: `2px solid ${COLORS.screenBorder}`,
          borderRadius: "10px",
          padding: "7px 6px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "100%",
        }}
      >
        <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink, whiteSpace: "nowrap" }}>
          {count} selecionado(s)
        </span>
        <input
          value={tagDraft}
          onChange={(e) => onTagDraftChange(e.target.value)}
          placeholder="tag..."
          style={{
            width: "50px",
            minWidth: 0,
            borderRadius: "8px",
            border: `1.5px solid ${COLORS.screenBorder}`,
            padding: "5px 6px",
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "10.5px",
            outline: "none",
          }}
        />
        <button
          onClick={onApplyTag}
          disabled={count === 0 || !tagDraft.trim()}
          aria-label="Marcar com a tag"
          title="Marcar com a tag"
          style={{
            background: COLORS.lensBlue,
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            cursor: "pointer",
            opacity: count === 0 || !tagDraft.trim() ? 0.5 : 1,
          }}
        >
          <Check size={14} />
        </button>
        {canAddToCollection && (
          <button
            onClick={onPickCollection}
            disabled={count === 0}
            aria-label="Adicionar a uma coleção"
            title="Adicionar a uma coleção"
            style={bulkBtnStyle(COLORS.ink, COLORS.screenBorder, count === 0)}
          >
            <FolderPlus size={14} />
          </button>
        )}
        {canArchive && (
          <button
            onClick={onArchive}
            disabled={count === 0}
            aria-label={showArchived ? "Desarquivar selecionados" : "Arquivar selecionados"}
            title={showArchived ? "Desarquivar selecionados" : "Arquivar selecionados"}
            style={bulkBtnStyle(COLORS.ink, COLORS.screenBorder, count === 0)}
          >
            {showArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </button>
        )}
        <button
          onClick={onDelete}
          disabled={count === 0}
          aria-label={confirmingDelete ? "Confirmar exclusão" : "Excluir selecionados"}
          title={confirmingDelete ? "Confirmar exclusão" : "Excluir selecionados"}
          style={bulkBtnStyle("var(--danger)", "var(--danger)", count === 0)}
        >
          <Trash2 size={14} />
        </button>
        <button
          onClick={onCancel}
          aria-label="Cancelar seleção"
          title="Cancelar seleção"
          style={bulkBtnStyle(COLORS.ink, COLORS.screenBorder, false)}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
