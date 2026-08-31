import { RefObject } from "react";
import { Camera, History } from "lucide-react";
import { COLORS } from "../theme";
import { PLACEHOLDER_BY_MODE } from "../lib/searchQuery";
import DexCategoryNav from "./DexCategoryNav";
import type { AppModule, AppScreen } from "./AppHeader";

/**
 * Modos de busca escolhíveis na barra inferior. "Comparar" fica de fora —
 * continua acessível pelo prefixo `cmp:` na busca (ver lib/searchQuery.ts) e
 * pela comparação de itens já salvos na Pokédex (DexView) — mas não ocupa
 * espaço na grade principal, que agora cabe numa linha só.
 */
const SEARCH_MODES = [
  { mode: "definition", label: "Conceito" },
  { mode: "word", label: "Palavras" },
  { mode: "technique", label: "Técnicas" },
  { mode: "list", label: "Tipos" },
];
const MODE_LABELS_SHORT: Record<string, string> = {
  technique: "téc",
  definition: "def",
  list: "list",
  compare: "cmp",
  word: "pal",
  plant: "plt",
};
const CRITERIA_MODES = ["technique", "list", "compare"];

interface HistoryEntry {
  mode: string;
  term: string;
}

interface BottomBarProps {
  appModule: AppModule;
  view: AppScreen;
  showSearchBar: boolean;
  showDexNav: boolean;
  isTab: boolean;
  hasDetailTarget: boolean;
  searchMode: string;
  criteria: string;
  query: string;
  loading: boolean;
  moduleLabel: string;
  countsTotal: number;
  countsSubjects: number;
  countsCollections: number;
  countsTechniques: number;
  countsKnowledge: number;
  countsWords: number;
  showHistorySuggestions: boolean;
  matchingHistory: HistoryEntry[];
  photoInput: RefObject<HTMLInputElement>;
  onSetCriteria: (value: string) => void;
  onSetMode: (mode: string) => void;
  onSetQuery: (value: string) => void;
  onSearch: () => void;
  onRunHistoryTerm: (mode: string, term: string) => void;
  onShowHistorySuggestions: (show: boolean) => void;
  onPhotoSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** Barra vermelha de baixo: formulário de busca, navegação da Pokédex, ou status. */
export default function BottomBar({
  appModule,
  view,
  showSearchBar,
  showDexNav,
  isTab,
  hasDetailTarget,
  searchMode,
  criteria,
  query,
  loading,
  moduleLabel,
  countsTotal,
  countsSubjects,
  countsCollections,
  countsTechniques,
  countsKnowledge,
  countsWords,
  showHistorySuggestions,
  matchingHistory,
  photoInput,
  onSetCriteria,
  onSetMode,
  onSetQuery,
  onSearch,
  onRunHistoryTerm,
  onShowHistorySuggestions,
  onPhotoSearch,
}: BottomBarProps) {
  return (
    <div
      style={{
        background: COLORS.shellRedDark,
        padding:
          "9px calc(16px + env(safe-area-inset-right)) calc(9px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))",
        flexShrink: 0,
      }}
    >
      {showSearchBar ? (
        <div style={{ width: "100%", minWidth: 0 }}>
          {CRITERIA_MODES.includes(searchMode) && (
            <input
              value={criteria}
              onChange={(e) => onSetCriteria(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              placeholder="Critérios de comparação (opcional) — ex.: custo, dificuldade, tempo"
              style={{
                width: "100%",
                marginBottom: "6px",
                borderRadius: "8px",
                border: "none",
                padding: "8px 12px",
                minHeight: "32px",
                fontFamily: "Inter, sans-serif",
                fontSize: "12.5px",
                outline: "none",
                background: "rgba(255,255,255,0.85)",
              }}
            />
          )}
          {appModule === "bookdex" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "6px",
                marginBottom: "6px",
              }}
            >
              {SEARCH_MODES.map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => onSetMode(mode)}
                  style={{
                    padding: "6px 8px",
                    minHeight: "28px",
                    borderRadius: "999px",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: '"Baloo 2", sans-serif',
                    fontWeight: 700,
                    fontSize: "11px",
                    background: searchMode === mode ? COLORS.gold : "rgba(255,255,255,0.18)",
                    color: searchMode === mode ? "#4A3300" : COLORS.white,
                    transition: "background 0.15s ease",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2" style={{ position: "relative" }}>
            {showHistorySuggestions && matchingHistory.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  background: COLORS.surface,
                  border: `2px solid ${COLORS.screenBorder}`,
                  borderRadius: "8px",
                  overflow: "hidden",
                  zIndex: 10,
                  boxShadow: "0 -4px 10px rgba(0,0,0,0.3)",
                }}
              >
                {matchingHistory.map((h, i) => (
                  <button
                    key={h.mode + h.term + i}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onShowHistorySuggestions(false);
                      onRunHistoryTerm(h.mode, h.term);
                    }}
                    className="flex items-center gap-2"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      background: "none",
                      border: "none",
                      borderBottom: i < matchingHistory.length - 1 ? `1px solid ${COLORS.screenBorder}` : "none",
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                      fontSize: "12.5px",
                      color: COLORS.ink,
                      textAlign: "left",
                    }}
                  >
                    <History size={12} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.term}</span>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "9.5px", color: "var(--text-muted)" }}>
                      {MODE_LABELS_SHORT[h.mode] || h.mode}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <input
              value={query}
              onChange={(e) => onSetQuery(e.target.value)}
              onFocus={() => onShowHistorySuggestions(true)}
              onBlur={() => onShowHistorySuggestions(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onShowHistorySuggestions(false);
                  onSearch();
                }
              }}
              placeholder={PLACEHOLDER_BY_MODE[searchMode]}
              enterKeyHint="search"
              style={{
                flex: "1 1 0%",
                minWidth: 0,
                width: "100%",
                borderRadius: "8px",
                border: "none",
                padding: "10px 12px",
                minHeight: "40px",
                fontFamily: "Inter, sans-serif",
                fontSize: "16px",
                outline: "none",
              }}
            />
            {searchMode === "plant" && (
              <>
                <button
                  onClick={() => photoInput.current && photoInput.current.click()}
                  disabled={loading}
                  aria-label="Identificar planta por foto"
                  title="Identificar planta por foto"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    color: COLORS.white,
                    border: "none",
                    borderRadius: "8px",
                    minWidth: "40px",
                    minHeight: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: loading ? "default" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  <Camera size={17} />
                </button>
                <input ref={photoInput} type="file" accept="image/*" capture="environment" onChange={onPhotoSearch} style={{ display: "none" }} />
              </>
            )}
            <button
              onClick={onSearch}
              disabled={loading || !query.trim()}
              style={{
                background: COLORS.gold,
                color: "#4A3300",
                fontWeight: 800,
                border: "none",
                borderRadius: "8px",
                padding: "9px 14px",
                minHeight: "40px",
                fontFamily: '"Baloo 2", sans-serif',
                fontSize: "13px",
                whiteSpace: "nowrap",
                cursor: loading || !query.trim() ? "default" : "pointer",
                opacity: loading || !query.trim() ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              {loading ? "..." : "ESCANEAR"}
            </button>
          </div>
        </div>
      ) : showDexNav && appModule === "bookdex" ? (
        <DexCategoryNav counts={{ techniques: countsTechniques, knowledge: countsKnowledge, words: countsWords }} />
      ) : (
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
          {view === "collections"
            ? `${countsCollections} coleções`
            : isTab || hasDetailTarget
              ? `${countsTotal} item(ns) registrado(s) em ${countsSubjects} assunto(s)`
              : moduleLabel}
        </div>
      )}
    </div>
  );
}
