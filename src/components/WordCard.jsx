import { COLORS } from "../theme";
import { isMandarin } from "../lib/words";
import CardShell from "./CardShell";
import ShareButton from "./ShareButton";
import WordEtymology from "./WordEtymology";
import { wordCardPdfBlob } from "../lib/cardPdf";

/**
 * Card de uma palavra pesquisada/salva — significado (sempre em português),
 * radical com origem (não-mandarim) ou pinyin + o sentido de cada hanzi
 * (mandarim).
 *
 * A identificação dos componentes semântico e fonético de cada hanzi saiu do
 * app: rendia pouco perto do custo de uma chamada por caractere. O que sobrou
 * do mandarim é a decomposição simples — hanzi, pinyin e significado —, que já
 * vem pronta no próprio verbete.
 */
export default function WordCard({ data, saved, onToggle, onTagsChange, onNoteChange }) {
  const mandarin = isMandarin(data.languageCode);
  const characters = mandarin ? data.characters || [] : [];
  const isCompound = characters.length > 1;

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
      actions={<ShareButton title={data.word} render={() => wordCardPdfBlob(data)} />}
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Etimologia desligada pra mandarim por enquanto — ver pedido do usuário. */}
      {!mandarin && <WordEtymology word={data.word} language={data.language} />}
    </CardShell>
  );
}
