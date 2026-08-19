import { useState } from "react";
import { Loader2 } from "lucide-react";
import { COLORS } from "../theme";
import { isMandarin } from "../lib/words";
import { fetchHanziComponent, MissingApiKeyError } from "../lib/anthropic";
import PokeballIcon from "./PokeballIcon";
import ShareButton from "./ShareButton";
import ShareImageButton from "./ShareImageButton";
import TagEditor from "./TagEditor";
import NoteEditor from "./NoteEditor";
import WordEtymology from "./WordEtymology";
import { wordShareText } from "../lib/share";
import { renderWordCardImage } from "../lib/cardImage";

const SEMANTIC_COLOR = { bg: "rgba(106,153,85,0.15)", border: "#6A9955" };
const PHONETIC_COLOR = { bg: "rgba(142,124,195,0.15)", border: "#8E7CC3" };

function pillStyle(color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
    fontFamily: "Inter, sans-serif",
    fontSize: "11px",
    color: COLORS.ink,
    background: color.bg,
    border: `1.5px solid ${color.border}`,
    borderRadius: "8px",
    padding: "3px 8px",
    lineHeight: 1.3,
  };
}

const hanziTagStyle = { fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "13.75px" };

function SemanticTag({ value }) {
  if (!value) return null;
  return (
    <span style={pillStyle(SEMANTIC_COLOR)}>
      <span style={hanziTagStyle}>{value}</span>
    </span>
  );
}

function PhoneticTag({ value, pinyin }) {
  if (!value) return null;
  return (
    <span style={pillStyle(PHONETIC_COLOR)}>
      <span style={hanziTagStyle}>{value}</span>
      {pinyin && <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px" }}>({pinyin})</span>}
    </span>
  );
}

function sfButtonStyle(color, loading) {
  return {
    width: "22px",
    height: "22px",
    borderRadius: "6px",
    border: `1.5px solid ${color}`,
    background: "transparent",
    color,
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: 700,
    fontSize: "11px",
    cursor: loading ? "default" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    opacity: loading ? 0.6 : 1,
  };
}

/**
 * Card de uma palavra pesquisada/salva na aba "Palavras" — significado (sempre
 * em português), radical (não-mandarim, já com origem+significado) ou pinyin
 * + decomposição por hanzi (mandarim). Os componentes semântico ("S") e
 * fonético ("F") de cada hanzi são identificados só sob demanda — cada
 * caractere tem seus próprios botões, que somem assim que o componente já
 * foi identificado pra ele.
 */
export default function WordCard({ data, saved, onToggle, onTagsChange, onNoteChange, onUpdateCharacterComponent }) {
  const mandarin = isMandarin(data.languageCode);
  const baseCharacters = mandarin ? data.characters || [] : [];
  const [overrides, setOverrides] = useState({}); // { [index]: { semanticComponent, phoneticComponent, phoneticComponentPinyin } }
  const [loadingKey, setLoadingKey] = useState(null); // "<index>-<kind>"
  const [componentError, setComponentError] = useState(null);

  const characters = baseCharacters.map((c, i) => ({ ...c, ...(overrides[i] || {}) }));
  const isCompound = characters.length > 1;

  async function fetchComponent(index, kind) {
    const key = `${index}-${kind}`;
    if (loadingKey) return;
    setLoadingKey(key);
    setComponentError(null);
    try {
      const hanzi = characters[index].hanzi;
      const res = await fetchHanziComponent(hanzi, kind, data.word);
      setOverrides((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          ...(kind === "semantic"
            ? { semanticComponent: res.component || "—" }
            : { phoneticComponent: res.component || "—", phoneticComponentPinyin: res.pinyin || "" }),
        },
      }));
      if (onUpdateCharacterComponent) onUpdateCharacterComponent(index, kind, res);
    } catch (err) {
      setComponentError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Falhou.");
    } finally {
      setLoadingKey(null);
    }
  }

  function sfButtons(index, c) {
    return (
      <div className="flex gap-1" style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        {!c.semanticComponent && (
          <button
            onClick={() => fetchComponent(index, "semantic")}
            disabled={!!loadingKey}
            aria-label={`Identificar componente semântico de ${c.hanzi}`}
            title="Identificar componente semântico"
            style={sfButtonStyle(SEMANTIC_COLOR.border, loadingKey === `${index}-semantic`)}
          >
            {loadingKey === `${index}-semantic` ? <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} /> : "S"}
          </button>
        )}
        {!c.phoneticComponent && (
          <button
            onClick={() => fetchComponent(index, "phonetic")}
            disabled={!!loadingKey}
            aria-label={`Identificar componente fonético de ${c.hanzi}`}
            title="Identificar componente fonético"
            style={sfButtonStyle(PHONETIC_COLOR.border, loadingKey === `${index}-phonetic`)}
          >
            {loadingKey === `${index}-phonetic` ? <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} /> : "F"}
          </button>
        )}
      </div>
    );
  }

  function toggleWithCharacters() {
    if (!onToggle) return;
    onToggle(mandarin && baseCharacters.length ? { ...data, characters } : data);
  }

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
          <ShareButton title={data.word} text={wordShareText({ ...data, characters })} />
          <ShareImageButton title={data.word} render={() => renderWordCardImage({ ...data, characters })} />
          {onToggle && (
            <button
              onClick={toggleWithCharacters}
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
        </div>
      )}

      {mandarin && characters.length === 1 && (
        <div style={{ marginBottom: "8px" }}>
          <div className="flex items-center justify-between gap-2">
            <div />
            {sfButtons(0, characters[0])}
          </div>
          {(characters[0].semanticComponent || characters[0].phoneticComponent) && (
            <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
              <SemanticTag value={characters[0].semanticComponent} />
              <PhoneticTag value={characters[0].phoneticComponent} pinyin={characters[0].phoneticComponentPinyin} />
            </div>
          )}
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2" style={{ minWidth: 0, flexWrap: "wrap" }}>
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
                  {sfButtons(i, c)}
                </div>
                {(c.semanticComponent || c.phoneticComponent) && (
                  <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                    <SemanticTag value={c.semanticComponent} />
                    <PhoneticTag value={c.phoneticComponent} pinyin={c.phoneticComponentPinyin} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {componentError && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginBottom: "6px" }}>{componentError}</p>
      )}

      {/* Etimologia desligada pra mandarim por enquanto — ver pedido do usuário. */}
      {!mandarin && <WordEtymology word={data.word} language={data.language} />}

      {onNoteChange && (
        <div className="flex items-center" style={{ flexWrap: "wrap" }}>
          <NoteEditor note={data.note} onChange={onNoteChange} />
        </div>
      )}
    </div>
  );
}
