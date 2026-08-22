import { BookOpen, Sparkles, ThumbsDown } from "lucide-react";
import { COLORS, getTypeColor } from "../theme";
import CardShell, { CardIconButton } from "./CardShell";
import StatBar from "./StatBar";
import ShareButton from "./ShareButton";
import ConvertButton from "./ConvertButton";
import EnrichPrompt from "./EnrichPrompt";
import { techniqueCardPdfBlob } from "../lib/cardPdf";

export default function TechCard({
  subjectDisplay,
  technique,
  statLabels,
  saved,
  onToggle,
  onOpenDetail,
  hasDetail,
  onTagsChange,
  onNoteChange,
  selectable,
  selected,
  onSelectToggle,
  irrelevant,
  onMarkIrrelevant,
  onConvert,
  onEnrich,
}) {
  const color = getTypeColor(technique.type);
  return (
    <CardShell
      title={technique.name}
      saved={saved}
      onToggle={onToggle}
      captureLabel="técnica"
      tags={technique.tags}
      onTagsChange={onTagsChange}
      note={technique.note}
      onNoteChange={onNoteChange}
      selectable={selectable}
      selected={selected}
      onSelectToggle={onSelectToggle}
      irrelevant={irrelevant}
      actions={
        <>
          {onMarkIrrelevant && (
            <CardIconButton
              onClick={(e) => {
                e.stopPropagation();
                onMarkIrrelevant();
              }}
              label={irrelevant ? "Desmarcar como pouco relevante" : "Marcar como pouco relevante"}
              active={irrelevant}
            >
              <ThumbsDown size={15} fill={irrelevant ? "currentColor" : "none"} />
            </CardIconButton>
          )}
          <ConvertButton kind="technique" onConvert={onConvert} />
          <ShareButton title={technique.name} render={() => techniqueCardPdfBlob(subjectDisplay || "", technique, statLabels)} />
          {onOpenDetail && (
            <CardIconButton onClick={onOpenDetail} label={hasDetail ? "Ver guia" : "Aprofundar (gera com IA)"}>
              {hasDetail ? <BookOpen size={15} /> : <Sparkles size={15} />}
            </CardIconButton>
          )}
        </>
      }
    >
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.4, marginBottom: "9px" }}>
        {technique.description}
      </p>
      <EnrichPrompt item={technique} onEnrich={onEnrich} />
      <div className="space-y-1.5" style={{ marginBottom: "8px" }}>
        {(statLabels || []).map((label, i) => (
          <StatBar key={label + i} label={label} value={technique.stats ? technique.stats[i] : 0} color={color} />
        ))}
      </div>
      {technique.bestFor && (
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
          Ideal para: {technique.bestFor}
        </div>
      )}
    </CardShell>
  );
}
