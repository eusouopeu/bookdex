import { BookOpen, Sparkles, ThumbsDown } from "lucide-react";
import { COLORS, getTypeColor } from "../theme";
import PokeballIcon from "./PokeballIcon";
import StatBar from "./StatBar";
import ShareButton from "./ShareButton";
import ShareImageButton from "./ShareImageButton";
import TagEditor from "./TagEditor";
import NoteEditor from "./NoteEditor";
import ImageEditor from "./ImageEditor";
import LinksEditor from "./LinksEditor";
import { techniqueShareText } from "../lib/share";
import { renderTechniqueCardImage } from "../lib/cardImage";

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
  onImagesChange,
  selectable,
  selected,
  onSelectToggle,
  links,
  onOpenLinkPicker,
  onRemoveLink,
  onJumpLink,
  irrelevant,
  onMarkIrrelevant,
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
              aria-label={`Selecionar ${technique.name} para comparar`}
            />
          )}
          <div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "var(--text-faint)" }}>
              Nº {String(index + 1).padStart(3, "0")}
            </div>
            <h3
              style={{
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: "16px",
                color: COLORS.ink,
                lineHeight: 1.15,
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
            <ShareButton title={technique.name} text={techniqueShareText(subjectDisplay || "", technique, statLabels)} />
            <ShareImageButton
              title={technique.name}
              render={() => renderTechniqueCardImage(subjectDisplay || "", technique, statLabels)}
            />
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
      {(onTagsChange || onOpenLinkPicker) && (
        <div style={{ marginBottom: "4px" }}>
          {onTagsChange && <TagEditor tags={technique.tags || []} onChange={onTagsChange} />}
          {onOpenLinkPicker && (
            <LinksEditor links={links || []} onOpenPicker={onOpenLinkPicker} onRemove={onRemoveLink} onJump={onJumpLink} />
          )}
        </div>
      )}
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.4, marginBottom: "9px" }}>
        {technique.description}
      </p>
      <div className="space-y-1.5" style={{ marginBottom: "8px" }}>
        {statLabels.map((label, i) => (
          <StatBar key={label + i} label={label} value={technique.stats ? technique.stats[i] : 0} color={color} />
        ))}
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
        Ideal para: {technique.bestFor}
      </div>
      <div className="flex items-center" style={{ flexWrap: "wrap" }}>
        {onNoteChange && <NoteEditor note={technique.note} onChange={onNoteChange} />}
        {onImagesChange && <ImageEditor images={technique.images} onChange={onImagesChange} />}
      </div>
      {onOpenDetail && (
        <button
          onClick={onOpenDetail}
          className="flex items-center justify-center gap-1.5"
          style={{
            width: "100%",
            marginTop: "10px",
            minHeight: "40px",
            background: "transparent",
            border: `2px solid ${COLORS.screenBorder}`,
            borderRadius: "8px",
            color: COLORS.ink,
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          {hasDetail ? <BookOpen size={14} /> : <Sparkles size={14} />} Aprofundar
        </button>
      )}
    </div>
  );
}
