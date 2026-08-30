import { useState } from "react";
import { Volume2 } from "lucide-react";
import { COLORS } from "../theme";
import { isMandarin } from "../lib/words";
import CardShell, { CardIconButton } from "./CardShell";
import ShareButton from "./ShareButton";
import WordEtymology from "./WordEtymology";
import { wordCardPdfBlob } from "../lib/cardPdf";
import { isSpeechSupported, speak } from "../lib/speech";

/**
 * Card de uma palavra pesquisada/salva — significado (sempre em português),
 * radical com origem (não-mandarim) ou pinyin + o sentido de cada hanzi
 * (mandarim).
 *
 * A identificação dos componentes semântico e fonético de cada hanzi saiu do
 * app: rendia pouco perto do custo de uma chamada por caractere. O que sobrou
 * do mandarim é a decomposição simples — hanzi, pinyin e significado —, que já
 * vem pronta no próprio verbete.
 *
 * A pronúncia usa o `speechSynthesis` do próprio sistema — offline, sem custo
 * de API (ver lib/speech.js).
 */
interface WordCardProps {
  data: any;
  saved: boolean;
  onToggle?: (data: any) => void;
  onTagsChange?: (tags: string[]) => void;
  onNoteChange?: (note: string) => void;
}

export default function WordCard({ data, saved, onToggle, onTagsChange, onNoteChange }: WordCardProps) {
  const mandarin = isMandarin(data.languageCode);
  const characters = mandarin ? data.characters || [] : [];
  const isCompound = characters.length > 1;
  const [speechError, setSpeechError] = useState(null);
  const speechSupported = isSpeechSupported();

  /** Fala a palavra (ou um hanzi) no idioma do card, usando a voz do sistema. */
  function pronounce(text) {
    const result = speak(text, data.languageCode || data.language);
    setSpeechError(
      result === "unsupported"
        ? "Este dispositivo não tem síntese de voz."
        : result === "no-voice"
          ? `Nenhuma voz de ${data.language} instalada neste dispositivo.`
          : null
    );
  }

  return (
    <CardShell
      eyebrow={(data.language || "").toUpperCase()}
      title={data.word}
      titleSize={18}
      padding="14px"
      subtitle={
        mandarin && data.pinyin ? (
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
            {data.pinyin}
          </div>
        ) : null
      }
      saved={saved}
      onToggle={onToggle ? () => onToggle(data) : undefined}
      captureLabel="palavra"
      tags={data.tags}
      onTagsChange={onTagsChange}
      note={data.note}
      onNoteChange={onNoteChange}
      actions={
        <>
          {speechSupported && (
            <CardIconButton onClick={() => pronounce(data.word)} label={`Ouvir a pronúncia de ${data.word}`}>
              <Volume2 size={16} />
            </CardIconButton>
          )}
          <ShareButton title={data.word} render={() => wordCardPdfBlob(data)} />
        </>
      }
    >
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
                  {speechSupported && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        pronounce(c.hanzi);
                      }}
                      aria-label={`Ouvir a pronúncia de ${c.hanzi}`}
                      title="Ouvir a pronúncia"
                      style={{
                        marginLeft: "auto",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: COLORS.screenBorder,
                        padding: "2px",
                        display: "flex",
                        flexShrink: 0,
                      }}
                    >
                      <Volume2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {speechError && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>{speechError}</p>
      )}

      {/* Etimologia desligada pra mandarim por enquanto — ver pedido do usuário. */}
      {!mandarin && <WordEtymology word={data.word} language={data.language} />}
    </CardShell>
  );
}
