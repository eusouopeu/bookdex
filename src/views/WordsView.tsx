import { useState } from "react";
import { Languages, ChevronDown, ChevronRight, Trash2, X, Type } from "lucide-react";
import { COLORS } from "../theme";
import WordCard from "../components/WordCard";
import { useData } from "../state/DataContext";

const CONFIRM_THRESHOLD = 3;

/**
 * Categoria "Palavras" da Pokédex: só o acervo, em pastas por idioma.
 *
 * A busca de palavras tinha um campo próprio aqui dentro — o que dava ao app
 * dois modelos mentais de busca, um na barra de baixo e outro no meio da
 * Pokédex. Agora ela é o modo "pal:" da barra única, e esta tela faz o mesmo
 * que as outras categorias: mostra o que já foi capturado.
 */
export default function WordsView(_props: { searchEffort?: string } = {}) {
  const {
    words,
    storageLoaded,
    toggleWordSave: onToggleWord,
    removeWordGroup: onRemoveGroup,
    updateWordTags: onUpdateTags,
    updateWordNote: onUpdateNote,
  } = useData();
  const [collapsed, setCollapsed] = useState({});
  const [confirmingRemove, setConfirmingRemove] = useState(null);

  function requestRemoveGroup(key, count) {
    if (count <= CONFIRM_THRESHOLD || confirmingRemove === key) {
      onRemoveGroup(key);
      setConfirmingRemove(null);
    } else {
      setConfirmingRemove(key);
    }
  }

  const groups = Object.entries(words || {}).sort((a, b) => a[1].displayName.localeCompare(b[1].displayName, "pt-BR"));
  const totalWords = Object.values(words || {}).reduce((sum, g) => sum + g.words.length, 0);

  return (
    <div>
      {storageLoaded && totalWords === 0 && (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "260px", color: COLORS.screenBorder }}>
          <Type size={32} strokeWidth={1.5} style={{ marginBottom: "10px" }} />
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", maxWidth: "230px" }}>
            Nenhuma palavra capturada ainda. Busque com pal: na barra de baixo e toque na pokébola para guardá-la.
          </p>
        </div>
      )}

      {totalWords > 0 &&
        groups.map(([key, group]) => {
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
                    onToggle={onToggleWord}
                    onTagsChange={(tags) => onUpdateTags(key, w.id, tags)}
                    onNoteChange={(note) => onUpdateNote(key, w.id, note)}
                  />
                ))}
            </div>
          );
        })}
    </div>
  );
}
