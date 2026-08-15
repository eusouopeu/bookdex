import { BookOpen } from "lucide-react";
import { COLORS, getTypeColor } from "../theme";
import PokeballIcon from "./PokeballIcon";
import StatBar from "./StatBar";
import ShareButton from "./ShareButton";
import TagEditor from "./TagEditor";
import NoteEditor from "./NoteEditor";
import LinksEditor from "./LinksEditor";
import { techniqueShareText } from "../lib/share";

export default function TechCard({
  index,
  subjectDisplay,
  technique,
  statLabels,
  saved,
  onToggle,
  onOpenDetail,
  onTagsChange,
  onNoteChange,
  selectable,
  selected,
  onSelectToggle,
  links,
  onOpenLinkPicker,
  onRemoveLink,
  onJumpLink,
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
          <div className="flex items-center" style={{ flexShrink: 0 }}>
            <ShareButton title={technique.name} text={techniqueShareText(subjectDisplay || "", technique, statLabels)} />
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
        {technique.type}
      </span>
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
      {onTagsChange && <TagEditor tags={technique.tags || []} onChange={onTagsChange} />}
      {onNoteChange && <NoteEditor note={technique.note} onChange={onNoteChange} />}
      {onOpenLinkPicker && (
        <LinksEditor links={links || []} onOpenPicker={onOpenLinkPicker} onRemove={onRemoveLink} onJump={onJumpLink} />
      )}
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
          <BookOpen size={14} /> Aprofundar
        </button>
      )}
    </div>
  );
}
