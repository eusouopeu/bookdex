import { ThumbsDown } from "lucide-react";
import CardShell, { CardIconButton } from "./CardShell";
import ShareButton from "./ShareButton";
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
    <CardShell
      title={item.name}
      saved={saved}
      onToggle={onToggle}
      captureLabel="item"
      tags={item.tags}
      onTagsChange={onTagsChange}
      note={item.note}
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
          <ConvertButton kind="list" onConvert={onConvert} />
          <ShareButton title={item.name} render={() => listItemCardPdfBlob(subjectDisplay || "", item)} />
          <DeepDiveIconButton hasContent={!!deepDive.data} loading={deepDive.loading} onClick={deepDive.toggle} />
        </>
      }
    >
      <EnrichPrompt item={item} onEnrich={onEnrich} />
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.4 }}>
        {item.description}
      </p>
      <ConceptExpand term={item.name} category={item.category} onAddRelatedCard={onAddRelatedCard} deepDive={deepDive} />
    </CardShell>
  );
}
