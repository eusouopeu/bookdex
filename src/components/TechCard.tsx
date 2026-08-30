import { AlertTriangle, BookOpen, Lightbulb, Link2, Sparkles, ThumbsDown } from "lucide-react";
import { getTypeColor } from "../theme";
import CardShell, { CardIconButton } from "./CardShell";
import StatBar from "./StatBar";
import ShareButton from "./ShareButton";
import ConvertButton from "./ConvertButton";
import EnrichPrompt from "./EnrichPrompt";
import AspectButtons, { BLUE_TINT, aspectButtonStyle } from "./AspectButtons";
import { TECH_ASPECTS, fetchTechAspect } from "../lib/anthropic";
import { techniqueCardPdfBlob } from "../lib/cardPdf";
import { estimateCost, formatCost } from "../lib/models";

const ASPECT_ICONS = { mistakes: AlertTriangle, why: Lightbulb, combos: Link2 };
const TECH_ASPECTS_WITH_ICONS = TECH_ASPECTS.map((a) => ({ ...a, icon: ASPECT_ICONS[a.id] }));

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
  onAspectGenerated,
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
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic", marginBottom: "9px" }}>
          Ideal para: {technique.bestFor}
        </div>
      )}
      <AspectButtons
        aspects={TECH_ASPECTS_WITH_ICONS}
        saved={technique.aspects}
        onFetch={(id) => fetchTechAspect(subjectDisplay || "", technique, id)}
        onGenerated={onAspectGenerated}
        tint={BLUE_TINT}
        costLabel={formatCost(estimateCost("techAspect"))}
      />
      {onOpenDetail && (
        <div className="flex">
          <button
            onClick={onOpenDetail}
            aria-label={hasDetail ? "Ver guia passo a passo" : "Gerar guia passo a passo (com IA)"}
            title={hasDetail ? "Passo a passo" : `Passo a passo (~${formatCost(estimateCost("detail"))})`}
            style={{ ...aspectButtonStyle(hasDetail, false, BLUE_TINT), width: "100%" }}
          >
            {hasDetail ? <BookOpen size={15} /> : <Sparkles size={15} />}
          </button>
        </div>
      )}
    </CardShell>
  );
}
