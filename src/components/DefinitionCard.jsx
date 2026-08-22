import { COLORS } from "../theme";
import CardShell from "./CardShell";
import ShareButton from "./ShareButton";
import ConceptExpand from "./ConceptExpand";
import DeepDiveIconButton from "./DeepDiveIconButton";
import { useConceptDeepDive } from "../lib/hooks";
import ConvertButton from "./ConvertButton";
import EnrichPrompt from "./EnrichPrompt";
import { definitionCardPdfBlob } from "../lib/cardPdf";

/**
 * Verbete de conceito/definição (modo "def:"). Ao contrário do TechCard, não
 * tem stats — tem pontos-chave, exemplo e termos relacionados.
 */
export default function DefinitionCard({
  definition,
  saved,
  onToggle,
  onTagsChange,
  onNoteChange,
  onSearchRelated,
  onAddRelatedCard,
  selectable,
  selected,
  onSelectToggle,
  onConvert,
  onEnrich,
}) {
  const deepDive = useConceptDeepDive(definition.term, definition.category, definition.definition);
  return (
    <CardShell
      eyebrow="CONCEITO"
      title={definition.term}
      titleSize={18}
      padding="14px"
      saved={saved}
      onToggle={onToggle}
      captureLabel="conceito"
      tags={definition.tags}
      onTagsChange={onTagsChange}
      note={definition.note}
      onNoteChange={onNoteChange}
      selectable={selectable}
      selected={selected}
      onSelectToggle={onSelectToggle}
      actions={
        <>
          <ConvertButton kind="definition" onConvert={onConvert} />
          <ShareButton title={definition.term} render={() => definitionCardPdfBlob(definition)} />
          <DeepDiveIconButton hasContent={!!deepDive.data} loading={deepDive.loading} onClick={deepDive.toggle} />
        </>
      }
    >
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.45, marginBottom: "12px" }}>
        {definition.definition}
      </p>
      <EnrichPrompt item={definition} onEnrich={onEnrich} />

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

      <ConceptExpand
        term={definition.term}
        category={definition.category}
        onAddRelatedCard={onAddRelatedCard}
        deepDive={deepDive}
      />
    </CardShell>
  );
}
