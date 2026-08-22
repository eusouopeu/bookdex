import { ThumbsDown } from "lucide-react";
import { COLORS } from "../theme";
import PokeballIcon from "./PokeballIcon";
import ShareButton from "./ShareButton";
import TagEditor from "./TagEditor";
import NoteEditor from "./NoteEditor";
import ConceptExpand from "./ConceptExpand";
import DeepDiveIconButton from "./DeepDiveIconButton";
import { useConceptDeepDive } from "../lib/hooks";
import ConvertButton from "./ConvertButton";
import EnrichPrompt from "./EnrichPrompt";
import { listItemCardPdfBlob } from "../lib/cardPdf";

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
  onAddRelatedCard,
  selectable,
  selected,
  onSelectToggle,
  irrelevant,
  onMarkIrrelevant,
  onConvert,
  onEnrich,
}) {
  const deepDive = useConceptDeepDive(item.name, item.category, item.description);
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
              aria-label={`Selecionar ${item.name}`}
            />
          )}
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
            {item.name}
          </h3>
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
          <ConvertButton kind="list" onConvert={onConvert} />
          <ShareButton title={item.name} render={() => listItemCardPdfBlob(subjectDisplay || "", item)} />
          <DeepDiveIconButton hasContent={!!deepDive.data} loading={deepDive.loading} onClick={deepDive.toggle} />
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
        )}
      </div>
      {onTagsChange && (
        <div style={{ marginBottom: "4px" }}>
          <TagEditor tags={item.tags || []} onChange={onTagsChange} />
        </div>
      )}
      <EnrichPrompt item={item} onEnrich={onEnrich} />
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.4 }}>
        {item.description}
      </p>
      <ConceptExpand term={item.name} category={item.category} onAddRelatedCard={onAddRelatedCard} deepDive={deepDive} />
      <div className="flex items-center" style={{ flexWrap: "wrap" }}>
        {onNoteChange && <NoteEditor note={item.note} onChange={onNoteChange} />}
      </div>
    </div>
  );
}
