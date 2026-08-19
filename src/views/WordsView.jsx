import { useState } from "react";
import { Search, Languages, ChevronDown, ChevronRight, Trash2, X, RefreshCw, Type } from "lucide-react";
import { COLORS, slug, primaryButtonStyle } from "../theme";
import { fetchWord, MissingApiKeyError } from "../lib/anthropic";
import WordCard from "../components/WordCard";
import SkeletonList from "../components/Skeleton";

const CONFIRM_THRESHOLD = 3;

/**
 * Aba "Palavras", separada da Pokédex: pesquisa de palavras em qualquer
 * idioma (significado sempre em português, radical, e componentes
 * semântico/fonético no caso do mandarim) com etimologia sob demanda.
 * Palavras capturadas ficam organizadas em pastas por idioma.
 */
export default function WordsView({
  words,
  storageLoaded,
  searchEffort,
  onToggleWord,
  isWordSaved,
  onRemoveGroup,
  onUpdateTags,
  onUpdateNote,
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [filterText, setFilterText] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [confirmingRemove, setConfirmingRemove] = useState(null);

  async function handleSearch() {
    const term = query.trim();
    if (!term || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWord(term, [], searchEffort);
      setResult(data);
    } catch (e) {
      setError(
        e instanceof MissingApiKeyError
          ? "Configure sua API key em Configurações para pesquisar palavras."
          : e.message || "Não foi possível pesquisar essa palavra agora."
      );
    } finally {
      setLoading(false);
    }
  }

  function requestRemoveGroup(key, count) {
    if (count <= CONFIRM_THRESHOLD || confirmingRemove === key) {
      onRemoveGroup(key);
      setConfirmingRemove(null);
    } else {
      setConfirmingRemove(key);
    }
  }

  const groups = Object.entries(words || {})
    .map(([key, group]) => {
      if (!filterText.trim()) return [key, group];
      const q = slug(filterText.trim());
      const subjectMatches = slug(group.displayName).includes(q);
      const finalWords = group.words.filter(
        (w) => subjectMatches || slug(w.word).includes(q) || slug(w.meaning || "").includes(q) || slug(w.radical || "").includes(q)
      );
      return finalWords.length ? [key, { ...group, words: finalWords }] : null;
    })
    .filter(Boolean)
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName, "pt-BR"));

  const totalWords = Object.values(words || {}).reduce((sum, g) => sum + g.words.length, 0);

  return (
    <div>
      <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink, marginBottom: "4px" }}>
        Palavras
      </h2>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px", lineHeight: 1.4 }}>
        Pesquise uma palavra em qualquer idioma — significado (sempre em português), radical e etimologia.
      </p>

      <div className="flex gap-2" style={{ marginBottom: "14px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          placeholder="Ex.: sinistro, hodgepodge, 明白"
          enterKeyHint="search"
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: "8px",
            border: `2px solid ${COLORS.screenBorder}`,
            padding: "10px 12px",
            minHeight: "42px",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
            background: COLORS.surface,
            color: COLORS.ink,
            outline: "none",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          style={{ ...primaryButtonStyle, minHeight: "42px", padding: "0 16px", opacity: loading || !query.trim() ? 0.6 : 1 }}
        >
          {loading ? "..." : "Buscar"}
        </button>
      </div>

      {loading && <SkeletonList count={1} />}

      {error && !loading && (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ minHeight: "140px", color: COLORS.screenBorder }}
        >
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--danger)", maxWidth: "260px", marginBottom: "10px" }}>
            {error}
          </p>
          <button onClick={handleSearch} className="flex items-center gap-1.5" style={primaryButtonStyle}>
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      )}

      {result && !loading && !error && (
        <div style={{ marginBottom: "18px", animation: "flicker 0.4s ease-out" }}>
          <WordCard
            data={result}
            saved={isWordSaved(result.languageCode, result.language, result.word)}
            onToggle={() => onToggleWord(result)}
          />
        </div>
      )}

      {storageLoaded && totalWords === 0 && !result && !loading && !error && (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "260px", color: COLORS.screenBorder }}>
          <Type size={32} strokeWidth={1.5} style={{ marginBottom: "10px" }} />
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", maxWidth: "230px" }}>
            Nenhuma palavra capturada ainda. Pesquise uma palavra acima e toque na pokébola para guardá-la.
          </p>
        </div>
      )}

      {totalWords > 0 && (
        <>
          <div className="flex items-center gap-2" style={{ marginBottom: "12px", position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "11px", color: COLORS.screenBorder, pointerEvents: "none" }} />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Buscar nas palavras salvas..."
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
                onClick={() => setFilterText("")}
                aria-label="Limpar busca"
                style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "4px" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {groups.length === 0 && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text-muted)", textAlign: "center", marginTop: "20px" }}>
              Nada encontrado para "{filterText}".
            </p>
          )}

          {groups.map(([key, group]) => {
            const open = !collapsed[key];
            const confirming = confirmingRemove === key;
            return (
              <div key={key} style={{ marginBottom: "18px" }}>
                <div className="flex items-center gap-1.5" style={{ borderBottom: `2px solid ${COLORS.screenBorder}`, marginBottom: "9px" }}>
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                    className="flex items-center gap-1.5"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: "none",
                      border: "none",
                      padding: "6px 0 5px",
                      minHeight: "40px",
                      cursor: "pointer",
                      textAlign: "left",
                      color: COLORS.ink,
                    }}
                  >
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Languages size={14} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
                    <h3
                      style={{
                        fontFamily: '"Baloo 2", sans-serif',
                        fontWeight: 800,
                        fontSize: "15px",
                        color: COLORS.ink,
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {group.displayName}{" "}
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", fontWeight: 400 }}>
                        ({group.words.length})
                      </span>
                    </h3>
                  </button>
                  {confirming ? (
                    <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--danger)", whiteSpace: "nowrap" }}>
                        Remover {group.words.length}?
                      </span>
                      <button
                        onClick={() => requestRemoveGroup(key, group.words.length)}
                        aria-label={`Confirmar remoção de "${group.displayName}"`}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "9px 4px" }}
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmingRemove(null)}
                        aria-label="Cancelar remoção"
                        style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "9px 4px" }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => requestRemoveGroup(key, group.words.length)}
                      aria-label={`Remover idioma "${group.displayName}" inteiro`}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "9px 4px", flexShrink: 0 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {open &&
                  group.words.map((w) => (
                    <WordCard
                      key={w.id}
                      data={w}
                      saved={true}
                      onToggle={() => onToggleWord(w)}
                      onTagsChange={(tags) => onUpdateTags(key, w.id, tags)}
                      onNoteChange={(note) => onUpdateNote(key, w.id, note)}
                    />
                  ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
