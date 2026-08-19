import { COLORS } from "../theme";
import { isMandarin } from "../lib/words";
import PokeballIcon from "./PokeballIcon";
import ShareButton from "./ShareButton";
import ShareImageButton from "./ShareImageButton";
import TagEditor from "./TagEditor";
import NoteEditor from "./NoteEditor";
import WordEtymology from "./WordEtymology";
import { wordShareText } from "../lib/share";
import { renderWordCardImage } from "../lib/cardImage";

/**
 * Card de uma palavra pesquisada/salva na aba "Palavras" — significado (sempre
 * em português), radical e, no caso do mandarim, componentes semântico e
 * fonético. Em vez de "Aprofundar", tem o botão "Etimologia" (WordEtymology).
 */
export default function WordCard({ data, saved, onToggle, onTagsChange, onNoteChange }) {
  const mandarin = isMandarin(data.languageCode);
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `2px solid ${COLORS.screenBorder}`,
        borderRadius: "10px",
        padding: "14px",
        marginBottom: "10px",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "var(--text-faint)" }}>
            {(data.language || "").toUpperCase()}
          </div>
          <h3
            style={{
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "18px",
              color: COLORS.ink,
              lineHeight: 1.15,
            }}
          >
            {data.word}
          </h3>
        </div>
        <div className="flex items-center" style={{ flexShrink: 0, gap: "18px" }}>
          <ShareButton title={data.word} text={wordShareText(data)} />
          <ShareImageButton title={data.word} render={() => renderWordCardImage(data)} />
          {onToggle && (
            <button
              onClick={onToggle}
              aria-label={saved ? "Soltar das Palavras" : "Capturar palavra"}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "9px",
                margin: "-9px",
                flexShrink: 0,
              }}
            >
              <PokeballIcon filled={saved} size={26} />
            </button>
          )}
        </div>
      </div>

      {onTagsChange && (
        <div style={{ marginBottom: "4px" }}>
          <TagEditor tags={data.tags || []} onChange={onTagsChange} />
        </div>
      )}

      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.45, marginBottom: "10px" }}>
        {data.meaning}
      </p>

      {(data.radical || (mandarin && (data.semanticComponent || data.phoneticComponent))) && (
        <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
          {data.radical && (
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "11px",
                color: COLORS.ink,
                background: "rgba(46,134,222,0.1)",
                border: `1.5px solid ${COLORS.lensBlue}`,
                borderRadius: "8px",
                padding: "4px 9px",
                lineHeight: 1.35,
              }}
            >
              <strong style={{ fontFamily: '"Baloo 2", sans-serif' }}>Radical:</strong> {data.radical}
            </span>
          )}
          {mandarin && data.semanticComponent && (
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "11px",
                color: COLORS.ink,
                background: "rgba(106,153,85,0.15)",
                border: "1.5px solid #6A9955",
                borderRadius: "8px",
                padding: "4px 9px",
                lineHeight: 1.35,
              }}
            >
              <strong style={{ fontFamily: '"Baloo 2", sans-serif' }}>Componente semântico:</strong> {data.semanticComponent}
            </span>
          )}
          {mandarin && data.phoneticComponent && (
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "11px",
                color: COLORS.ink,
                background: "rgba(142,124,195,0.15)",
                border: "1.5px solid #8E7CC3",
                borderRadius: "8px",
                padding: "4px 9px",
                lineHeight: 1.35,
              }}
            >
              <strong style={{ fontFamily: '"Baloo 2", sans-serif' }}>Componente fonético:</strong> {data.phoneticComponent}
            </span>
          )}
        </div>
      )}

      <WordEtymology word={data.word} language={data.language} />

      {onNoteChange && (
        <div className="flex items-center" style={{ flexWrap: "wrap" }}>
          <NoteEditor note={data.note} onChange={onNoteChange} />
        </div>
      )}
    </div>
  );
}
