import { useState } from "react";
import { Sprout, Leaf, MapPin, ScanEye, CloudSun } from "lucide-react";
import { COLORS } from "../theme";
import CardShell from "./CardShell";
import ShareButton from "./ShareButton";
import PlantPhoto from "./PlantPhoto";
import AspectButtons, { GREEN_TINT } from "./AspectButtons";
import { PLANT_ASPECTS, fetchPlantAspect } from "../lib/anthropic";
import { plantCardPdfBlob } from "../lib/cardPdf";

const ASPECT_ICONS = {
  origin: MapPin,
  identification: ScanEye,
  cultivation: CloudSun,
  medicinal: Leaf,
};

const PLANT_ASPECTS_WITH_ICONS = PLANT_ASPECTS.map((a) => ({ ...a, icon: ASPECT_ICONS[a.id] || Sprout }));

/**
 * Card de uma planta. Nasce enxuto — foto, nome científico, nomes populares e
 * um resumo de 2-3 linhas — e cada um dos quatro botões-ícone gera, sob demanda
 * e numa chamada curta, um bloco de 3 a 5 linhas sobre aquele aspecto (ver
 * AspectButtons — mesmo componente usado por TechCard e DefinitionCard).
 *
 * `onAspectGenerated` só existe em card salvo (persiste o texto); no resultado
 * de busca o conteúdo vive no estado local até a captura, mas ainda entra no
 * PDF de compartilhar via `localAspects` (ver onLocalChange).
 */
export default function PlantCard({
  plant,
  saved,
  onToggle,
  onTagsChange,
  onNoteChange,
  onImagesChange,
  onAspectGenerated,
  selectable,
  selected,
  onSelectToggle,
}) {
  const [localAspects, setLocalAspects] = useState({});
  const title = plant.commonNames?.[0] || plant.scientificName || plant.name || "Planta";
  const aspects = { ...(plant.aspects || {}), ...localAspects };

  return (
    <CardShell
      eyebrow={plant.family ? plant.family.toUpperCase() : "PLANTA"}
      title={title}
      titleSize={18}
      padding="14px"
      media={<PlantPhoto images={plant.images} onChange={onImagesChange} />}
      subtitle={
        plant.scientificName ? (
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontStyle: "italic",
              fontSize: "12.5px",
              color: "var(--text-muted)",
              marginTop: "2px",
            }}
          >
            {plant.scientificName}
          </div>
        ) : null
      }
      saved={saved}
      onToggle={onToggle}
      captureLabel="planta"
      tags={plant.tags}
      onTagsChange={onTagsChange}
      note={plant.note}
      onNoteChange={onNoteChange}
      selectable={selectable}
      selected={selected}
      onSelectToggle={onSelectToggle}
      actions={<ShareButton title={title} render={() => plantCardPdfBlob(plant, aspects)} />}
    >
      {(plant.commonNames || []).length > 1 && (
        <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          {plant.commonNames.slice(1).map((n, i) => (
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
              {n}
            </span>
          ))}
        </div>
      )}

      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.45, marginBottom: "10px" }}>
        {plant.summary}
      </p>

      {plant.idNote && (
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            fontStyle: "italic",
            color: "var(--text-muted)",
            lineHeight: 1.4,
            marginBottom: "10px",
          }}
        >
          {plant.idNote}
        </p>
      )}

      <AspectButtons
        aspects={PLANT_ASPECTS_WITH_ICONS}
        saved={plant.aspects}
        onFetch={(id) => fetchPlantAspect(plant, id)}
        onGenerated={onAspectGenerated}
        onLocalChange={setLocalAspects}
        tint={GREEN_TINT}
      />
    </CardShell>
  );
}
