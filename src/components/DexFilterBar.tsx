import { Search, X, Tag, ArrowUpDown, Archive, ArchiveRestore, Scale, CheckSquare } from "lucide-react";
import { COLORS } from "../theme";

function badgeStyle(active) {
  return {
    borderRadius: "999px",
    border: `2px solid ${COLORS.screenBorder}`,
    cursor: "pointer",
    fontFamily: '"Baloo 2", sans-serif',
    fontWeight: 700,
    fontSize: "11.5px",
    letterSpacing: "0.01em",
    background: active ? COLORS.screenBorder : "transparent",
    color: active ? COLORS.white : COLORS.screenBorder,
    transition: "background 0.15s ease, color 0.15s ease",
  };
}

/**
 * Barra de filtro/ordenação da Pokédex: busca por texto, chips de tag, select
 * de ordenação e os 3 badges de modo (arquivados/comparar/selecionar).
 *
 * Extraído do DexView, que só passa dado e callback — nada de estado próprio
 * aqui além do que já vem de fora.
 */
export default function DexFilterBar({
  filterText,
  onFilterTextChange,
  allTags,
  activeTags,
  onToggleTag,
  sortBy,
  onSortByChange,
  category,
  showArchived,
  onToggleShowArchived,
  compareMode,
  onToggleCompare,
  selectMode,
  onToggleSelect,
  canCompare,
  canBulkSelect,
}) {
  return (
    <>
      <div className="flex items-center gap-2" style={{ marginBottom: "10px", position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: "11px", color: COLORS.screenBorder, pointerEvents: "none" }} />
        <input
          value={filterText}
          onChange={(e) => onFilterTextChange(e.target.value)}
          placeholder="Buscar na sua Pokédex..."
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
        {filterText && (
          <button
            onClick={() => onFilterTextChange("")}
            aria-label="Limpar busca"
            style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "4px" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="flex items-center" style={{ flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          <Tag size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          {allTags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => onToggleTag(tag)}
                aria-pressed={active}
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "10.5px",
                  padding: "3px 9px",
                  borderRadius: "999px",
                  border: `1.5px solid ${COLORS.lensBlue}`,
                  background: active ? COLORS.lensBlue : "transparent",
                  color: active ? COLORS.white : COLORS.lensBlue,
                  cursor: "pointer",
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2" style={{ marginBottom: "16px", justifyContent: "space-between" }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
          <ArrowUpDown size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            aria-label="Ordenar por"
            style={{
              borderRadius: "999px",
              border: `1.5px solid ${COLORS.screenBorder}`,
              background: COLORS.surface,
              color: COLORS.ink,
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11px",
              padding: "6px 10px",
              minHeight: "30px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="recent">Recentes</option>
            <option value="name">Nome</option>
          </select>
        </div>

        {((category === "technique" && canCompare) || canBulkSelect || onToggleShowArchived) && (
          <div className="flex gap-2" style={{ flexShrink: 0 }}>
            {onToggleShowArchived && (
              <button
                onClick={onToggleShowArchived}
                aria-label={showArchived ? "Ver itens ativos" : "Ver itens arquivados"}
                title={showArchived ? "Ver itens ativos" : "Ver itens arquivados"}
                style={{
                  ...badgeStyle(showArchived),
                  flex: "none",
                  width: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                {showArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              </button>
            )}
            {category === "technique" && canCompare && (
              <button
                onClick={onToggleCompare}
                aria-label="Comparar técnicas salvas"
                title="Comparar técnicas salvas"
                style={{
                  ...badgeStyle(compareMode),
                  flex: "none",
                  width: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <Scale size={14} />
              </button>
            )}
            {canBulkSelect && (
              <button
                onClick={onToggleSelect}
                aria-label="Selecionar vários itens"
                title="Selecionar vários itens"
                style={{
                  ...badgeStyle(selectMode),
                  flex: "none",
                  width: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <CheckSquare size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
