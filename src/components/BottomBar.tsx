import { RefObject } from "react";
import { Camera, History } from "lucide-react";
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
  onCancelSearch: () => void;
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
  onCancelSearch,
  onRunHistoryTerm,
  onShowHistorySuggestions,
  onPhotoSearch,
}: BottomBarProps) {
  const canSearch = loading || !!query.trim();
  return (
    <div className="shrink-0 bg-shell-red-dark pt-[9px] pr-[calc(16px+env(safe-area-inset-right))] pb-[calc(9px+env(safe-area-inset-bottom))] pl-[calc(16px+env(safe-area-inset-left))]">
      {showSearchBar ? (
        <div className="w-full min-w-0">
          {CRITERIA_MODES.includes(searchMode) && (
            <input
              value={criteria}
              onChange={(e) => onSetCriteria(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              placeholder="Critérios de comparação (opcional) — ex.: custo, dificuldade, tempo"
              aria-label="Critérios de comparação"
              className="mb-1.5 min-h-8 w-full rounded-lg border-0 bg-white/85 px-3 py-2 font-body text-[12.5px] outline-none"
            />
          )}
          {appModule === "bookdex" && (
            <div className="mb-1.5 grid grid-cols-4 gap-1.5" role="group" aria-label="Modo de busca">
              {SEARCH_MODES.map(({ mode, label }) => (
                <button key={mode} onClick={() => onSetMode(mode)} aria-pressed={searchMode === mode} className="mode-pill">
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="relative flex gap-2">
            {showHistorySuggestions && matchingHistory.length > 0 && (
              <div className="absolute right-0 bottom-[calc(100%+6px)] left-0 z-10 overflow-hidden rounded-lg border-2 border-solid border-screen-border bg-surface shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
                {matchingHistory.map((h, i) => (
                  <button
                    key={h.mode + h.term + i}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onShowHistorySuggestions(false);
                      onRunHistoryTerm(h.mode, h.term);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-[9px] text-left font-body text-[12.5px] text-ink ${
                      i < matchingHistory.length - 1 ? "border-b border-solid border-screen-border" : ""
                    }`}
                  >
                    <History size={12} className="shrink-0 text-muted" />
                    <span className="flex-1 truncate">{h.term}</span>
                    <span className="font-mono text-[9.5px] text-muted">{MODE_LABELS_SHORT[h.mode] || h.mode}</span>
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
              aria-label="Termo de busca"
              enterKeyHint="search"
              className="min-h-10 w-full min-w-0 flex-1 rounded-lg border-0 px-3 py-2.5 font-body text-base outline-none"
            />
            {searchMode === "plant" && (
              <>
                <button
                  onClick={() => photoInput.current && photoInput.current.click()}
                  disabled={loading}
                  aria-label="Identificar planta por foto"
                  title="Identificar planta por foto"
                  className={`flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border-0 bg-white/18 text-cream ${
                    loading ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  <Camera size={17} />
                </button>
                <input ref={photoInput} type="file" accept="image/*" capture="environment" onChange={onPhotoSearch} className="hidden" />
              </>
            )}
            <button
              onClick={loading ? onCancelSearch : onSearch}
              disabled={!canSearch}
              aria-label={loading ? "Cancelar busca" : "Escanear"}
              className={`min-h-10 shrink-0 rounded-lg px-3.5 py-[9px] font-display text-[13px] font-extrabold whitespace-nowrap ${
                loading
                  ? "border-2 border-solid border-white/60 bg-transparent text-cream"
                  : "border-0 bg-gold text-gold-ink"
              } ${canSearch ? "cursor-pointer opacity-100" : "cursor-default opacity-60"}`}
            >
              {loading ? "CANCELAR" : "ESCANEAR"}
            </button>
          </div>
        </div>
      ) : showDexNav && appModule === "bookdex" ? (
        <DexCategoryNav counts={{ techniques: countsTechniques, knowledge: countsKnowledge, words: countsWords }} />
      ) : (
        <div className="text-center font-mono text-[11px] text-white/75">
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
