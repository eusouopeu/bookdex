import { COLORS, getTypeColor } from "../theme";
import PokeballIcon from "./PokeballIcon";
import ShareButton from "./ShareButton";
import TagEditor from "./TagEditor";
import { definitionShareText } from "../lib/share";

/**
 * Verbete de conceito/definição (modo "def:"). Ao contrário do TechCard, não
 * tem stats — tem pontos-chave, exemplo e termos relacionados.
 */
export default function DefinitionCard({ definition, saved, onToggle, onTagsChange, onSearchRelated }) {
  const color = getTypeColor(definition.category);
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `2px solid ${COLORS.screenBorder}`,
        borderRadius: "10px",
        padding: "14px",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "var(--text-faint)" }}>
            CONCEITO
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
            {definition.term}
          </h3>
        </div>
        <div className="flex items-center" style={{ flexShrink: 0 }}>
          <ShareButton title={definition.term} text={definitionShareText(definition)} />
          <button
            onClick={onToggle}
            aria-label={saved ? "Soltar da Pokédex" : "Capturar conceito"}
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
        </div>
      </div>
      <span
        style={{
          display: "inline-block",
          background: color.bg,
          color: color.text,
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 9px",
          borderRadius: "999px",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          marginBottom: "8px",
        }}
      >
        {definition.category}
      </span>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.45, marginBottom: "12px" }}>
        {definition.definition}
      </p>

      {!!(definition.keyPoints || []).length && (
        <div style={{ marginBottom: "12px" }}>
          <div
            style={{
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11.5px",
              color: COLORS.ink,
              marginBottom: "5px",
            }}
          >
            Pontos-chave
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {definition.keyPoints.map((k, i) => (
              <li
                key={i}
                style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text)", lineHeight: 1.5 }}
              >
                {k}
              </li>
            ))}
          </ul>
        </div>
      )}

      {definition.example && (
        <div
          style={{
            background: "rgba(255,201,71,0.25)",
            border: `2px solid ${COLORS.gold}`,
            borderRadius: "8px",
            padding: "8px 10px",
            marginBottom: "12px",
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            color: COLORS.ink,
            lineHeight: 1.4,
          }}
        >
          <strong style={{ fontFamily: '"Baloo 2", sans-serif' }}>Exemplo:</strong> {definition.example}
        </div>
      )}

      {!!(definition.relatedTerms || []).length && (
        <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginBottom: onTagsChange ? "10px" : 0 }}>
          {definition.relatedTerms.map((t, i) =>
            onSearchRelated ? (
              <button
                key={i}
                onClick={() => onSearchRelated(t)}
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "10.5px",
                  color: COLORS.lensBlue,
                  background: "rgba(46,134,222,0.1)",
                  border: `1.5px solid ${COLORS.lensBlue}`,
                  borderRadius: "999px",
                  padding: "2px 8px",
                  cursor: "pointer",
                }}
              >
                {t} →
              </button>
            ) : (
              <span
                key={i}
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "10.5px",
                  color: COLORS.screenBorder,
                  border: `1.5px solid ${COLORS.screenBorder}`,
                  borderRadius: "999px",
                  padding: "2px 8px",
                }}
              >
                {t}
              </span>
            )
          )}
        </div>
      )}

      {onTagsChange && <TagEditor tags={definition.tags || []} onChange={onTagsChange} />}
    </div>
  );
}
