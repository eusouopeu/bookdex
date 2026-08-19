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

function componentTag(label, value, color) {
  if (!value) return null;
  return (
    <span
      style={{
        fontFamily: "Inter, sans-serif",
        fontSize: "10.5px",
        color: COLORS.ink,
        background: color.bg,
        border: `1.5px solid ${color.border}`,
        borderRadius: "8px",
        padding: "3px 8px",
        lineHeight: 1.35,
      }}
    >
      <strong style={{ fontFamily: '"Baloo 2", sans-serif' }}>{label}:</strong> {value}
    </span>
  );
}

const SEMANTIC_COLOR = { bg: "rgba(106,153,85,0.15)", border: "#6A9955" };
const PHONETIC_COLOR = { bg: "rgba(142,124,195,0.15)", border: "#8E7CC3" };

/**
 * Card de uma palavra pesquisada/salva na aba "Palavras" — significado (sempre
 * em português), radical (não-mandarim) ou pinyin + decomposição por hanzi
 * (mandarim). Em palavra composta (2+ hanzi), cada caractere aparece com seu
 * próprio significado e componentes semântico/fonético, agrupados por hanzi.
 * Em vez de "Aprofundar", tem o botão "Etimologia" (WordEtymology).
 */
export default function WordCard({ data, saved, onToggle, onTagsChange, onNoteChange }) {
  const mandarin = isMandarin(data.languageCode);
  const characters = mandarin ? data.characters || [] : [];
  const isCompound = characters.length > 1;

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
          {mandarin && data.pinyin && (
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              {data.pinyin}
            </div>
          )}
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

      {!mandarin && data.radical && (
        <div style={{ marginBottom: "6px" }}>
          {componentTag("Radical", data.radical, { bg: "rgba(46,134,222,0.1)", border: COLORS.lensBlue })}
        </div>
      )}

      {mandarin && !isCompound && (data.semanticComponent || data.phoneticComponent) && (
        <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
          {componentTag("Componente semântico", data.semanticComponent, SEMANTIC_COLOR)}
          {componentTag("Componente fonético", data.phoneticComponent, PHONETIC_COLOR)}
        </div>
      )}

      {mandarin && isCompound && (
        <div style={{ marginBottom: "8px" }}>
          <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: COLORS.ink, marginBottom: "6px" }}>
            Por caractere
          </div>
          <div className="flex flex-col" style={{ gap: "6px" }}>
            {characters.map((c, i) => (
              <div
                key={i}
                style={{
                  border: `1.5px solid ${COLORS.screenBorder}`,
                  borderRadius: "8px",
                  padding: "8px 10px",
                  background: "rgba(0,0,0,0.02)",
                }}
              >
                <div className="flex items-baseline gap-2" style={{ marginBottom: "4px" }}>
                  <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "16px", color: COLORS.ink }}>
                    {c.hanzi}
                  </span>
                  {c.pinyin && (
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11.5px", color: "var(--text-muted)" }}>
                      {c.pinyin}
                    </span>
                  )}
                  {c.meaning && (
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)" }}>— {c.meaning}</span>
                  )}
                </div>
                <div className="flex" style={{ flexWrap: "wrap", gap: "6px" }}>
                  {componentTag("Semântico", c.semanticComponent, SEMANTIC_COLOR)}
                  {componentTag("Fonético", c.phoneticComponent, PHONETIC_COLOR)}
                </div>
              </div>
            ))}
          </div>
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
