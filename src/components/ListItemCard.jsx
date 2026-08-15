import { ThumbsDown } from "lucide-react";
import { COLORS, getTypeColor } from "../theme";
import PokeballIcon from "./PokeballIcon";
import ShareButton from "./ShareButton";
import TagEditor from "./TagEditor";
import NoteEditor from "./NoteEditor";
import ImageEditor from "./ImageEditor";
import LinksEditor from "./LinksEditor";
import ConceptExpand from "./ConceptExpand";
import { listItemShareText } from "../lib/share";

/**
 * Card de um item de enumeração/tipo (modo "list:"). Como TechCard, mas sem
 * stats — apenas nome, categoria e descrição.
 */
export default function ListItemCard({
  index,
  subjectDisplay,
  item,
  saved,
  onToggle,
  onTagsChange,
  onNoteChange,
  onImagesChange,
  onAddRelatedCard,
  links,
  onOpenLinkPicker,
  onRemoveLink,
  onJumpLink,
  irrelevant,
  onMarkIrrelevant,
}) {
  const color = getTypeColor(item.category);
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `2px solid ${COLORS.screenBorder}`,
        borderRadius: "10px",
        padding: "12px",
        marginBottom: "10px",
        opacity: irrelevant ? 0.5 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
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
            {item.name}
          </h3>
        </div>
        <div className="flex items-center" style={{ flexShrink: 0 }}>
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
          <ShareButton title={item.name} text={listItemShareText(subjectDisplay || "", item)} />
          <button
            onClick={onToggle}
            aria-label={saved ? "Soltar da Pokédex" : "Capturar item"}
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
      {item.category && (
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
          {item.category}
        </span>
      )}
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.4 }}>
        {item.description}
      </p>
      <ConceptExpand term={item.name} category={item.category} summary={item.description} onAddRelatedCard={onAddRelatedCard} />
      {onTagsChange && <TagEditor tags={item.tags || []} onChange={onTagsChange} />}
      <div className="flex items-center" style={{ flexWrap: "wrap" }}>
        {onNoteChange && <NoteEditor note={item.note} onChange={onNoteChange} />}
        {onImagesChange && <ImageEditor images={item.images} onChange={onImagesChange} />}
      </div>
      {onOpenLinkPicker && (
        <LinksEditor links={links || []} onOpenPicker={onOpenLinkPicker} onRemove={onRemoveLink} onJump={onJumpLink} />
      )}
    </div>
  );
}
