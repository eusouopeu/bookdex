import { BookOpen, Sparkles, ThumbsDown } from "lucide-react";
import { COLORS, getTypeColor } from "../theme";
import PokeballIcon from "./PokeballIcon";
import StatBar from "./StatBar";
import ShareButton from "./ShareButton";
import TagEditor from "./TagEditor";
import NoteEditor from "./NoteEditor";
import ConvertButton from "./ConvertButton";
import EnrichPrompt from "./EnrichPrompt";
import { techniqueCardPdfBlob } from "../lib/cardPdf";

export default function TechCard({
  index,
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
    <div
      onClick={selectable ? onSelectToggle : undefined}
      style={{
        background: COLORS.surface,
        border: `2px solid ${selectable && selected ? COLORS.lensBlue : COLORS.screenBorder}`,
        borderRadius: "10px",
        padding: "12px",
        marginBottom: "10px",
        cursor: selectable ? "pointer" : "default",
        boxShadow: selectable && selected ? `0 0 0 2px ${COLORS.lensBlue} inset` : "none",
        opacity: irrelevant ? 0.5 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-start gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={onSelectToggle}
              onClick={(e) => e.stopPropagation()}
              style={{ width: "18px", height: "18px", marginTop: "3px", flexShrink: 0 }}
              aria-label={`Selecionar ${technique.name}`}
            />
          )}
          <div>
            <h3
              style={{
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: "16px",
                color: COLORS.ink,
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              {technique.name}
            </h3>
          </div>
        </div>
        {!selectable && (
          <div className="flex items-center" style={{ flexShrink: 0, gap: "18px" }}>
            {onMarkIrrelevant && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkIrrelevant();
                }}
                aria-label={irrelevant ? "Desmarcar como pouco relevante" : "Marcar como pouco relevante"}
                title={irrelevant ? "Desmarcar como pouco relevante" : "Marcar como pouco relevante"}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "9px",
                  margin: "-9px",
                  flexShrink: 0,
                  color: irrelevant ? "var(--danger)" : COLORS.screenBorder,
                }}
              >
                <ThumbsDown size={15} fill={irrelevant ? "currentColor" : "none"} />
              </button>
            )}
            <ConvertButton kind="technique" onConvert={onConvert} />
            <ShareButton title={technique.name} render={() => techniqueCardPdfBlob(subjectDisplay || "", technique, statLabels)} />
            {onOpenDetail && (
              <button
                onClick={onOpenDetail}
                aria-label={hasDetail ? "Ver guia" : "Aprofundar (gera com IA)"}
                title={hasDetail ? "Ver guia" : "Aprofundar (gera com IA)"}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "9px",
                  margin: "-9px",
                  flexShrink: 0,
                  color: COLORS.screenBorder,
                }}
              >
                {hasDetail ? <BookOpen size={15} /> : <Sparkles size={15} />}
              </button>
            )}
            <button
              onClick={onToggle}
              aria-label={saved ? "Soltar da Pokédex" : "Capturar técnica"}
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
        )}
      </div>
      {onTagsChange && (
        <div style={{ marginBottom: "4px" }}>
          <TagEditor tags={technique.tags || []} onChange={onTagsChange} />
        </div>
      )}
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.4, marginBottom: "9px" }}>
        {technique.description}
      </p>
      <EnrichPrompt item={technique} onEnrich={onEnrich} />
      <div className="space-y-1.5" style={{ marginBottom: "8px" }}>
        {statLabels.map((label, i) => (
          <StatBar key={label + i} label={label} value={technique.stats ? technique.stats[i] : 0} color={color} />
        ))}
      </div>
      {technique.bestFor && (
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
          Ideal para: {technique.bestFor}
        </div>
      )}
      <div className="flex items-center" style={{ flexWrap: "wrap" }}>
        {onNoteChange && <NoteEditor note={technique.note} onChange={onNoteChange} />}
      </div>
    </div>
  );
}
