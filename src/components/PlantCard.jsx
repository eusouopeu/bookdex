import { useState } from "react";
import { Loader2, Sprout, Leaf, MapPin, ScanEye, CloudSun } from "lucide-react";
import { COLORS } from "../theme";
import CardShell from "./CardShell";
import ShareButton from "./ShareButton";
import PlantPhoto from "./PlantPhoto";
import { PLANT_ASPECTS, fetchPlantAspect, MissingApiKeyError } from "../lib/anthropic";
import { plantCardPdfBlob } from "../lib/cardPdf";

const ASPECT_ICONS = {
  origin: MapPin,
  identification: ScanEye,
  cultivation: CloudSun,
  medicinal: Leaf,
};

function aspectButtonStyle(filled, loading) {
  return {
    flex: 1,
    minWidth: 0,
    minHeight: "38px",
    borderRadius: "8px",
    border: `1.5px solid ${filled ? "#6A9955" : COLORS.screenBorder}`,
    background: filled ? "rgba(106,153,85,0.15)" : "transparent",
    color: filled ? "#4a6b3b" : COLORS.screenBorder,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: loading ? "default" : "pointer",
    opacity: loading ? 0.6 : 1,
  };
}

/**
 * Card de uma planta. Nasce enxuto — foto, nome científico, nomes populares e
 * um resumo de 2-3 linhas — e cada um dos quatro botões-ícone gera, sob demanda
 * e numa chamada curta, um bloco de 3 a 5 linhas sobre aquele aspecto. Tocar
 * de novo num aspecto já gerado só recolhe o bloco: nada é pedido duas vezes.
 *
 * `onAspectGenerated` só existe em card salvo (persiste o texto); no resultado
 * de busca o conteúdo vive no estado local até a captura.
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
  const [local, setLocal] = useState({});
  const [open, setOpen] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  const aspects = { ...(plant.aspects || {}), ...local };
  const title = plant.commonNames?.[0] || plant.scientificName || plant.name || "Planta";

  async function toggleAspect(id) {
    if (aspects[id]) {
      setOpen((o) => (o === id ? null : id));
      return;
    }
    if (loadingId) return;
    setLoadingId(id);
    setError(null);
    try {
      const text = await fetchPlantAspect(plant, id);
      setLocal((prev) => ({ ...prev, [id]: text }));
      setOpen(id);
      if (onAspectGenerated) onAspectGenerated(id, text);
    } catch (err) {
      setError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Falhou.");
    } finally {
      setLoadingId(null);
    }
  }

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

      <div className="flex gap-1.5" style={{ marginBottom: "8px" }} onClick={(e) => e.stopPropagation()}>
        {PLANT_ASPECTS.map((aspect) => {
          const Icon = ASPECT_ICONS[aspect.id] || Sprout;
          const filled = !!aspects[aspect.id];
          const loading = loadingId === aspect.id;
          return (
            <button
              key={aspect.id}
              onClick={() => toggleAspect(aspect.id)}
              disabled={!!loadingId}
              aria-label={filled ? `${aspect.label} — mostrar/ocultar` : `${aspect.label} (gera com IA)`}
              title={aspect.label}
              style={aspectButtonStyle(filled, loading)}
            >
              {loading ? <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} /> : <Icon size={15} />}
            </button>
          );
        })}
      </div>

      {error && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginBottom: "8px" }}>{error}</p>
      )}

      {open && aspects[open] && (
        <div
          style={{
            background: "rgba(106,153,85,0.12)",
            border: "1.5px solid #6A9955",
            borderRadius: "8px",
            padding: "9px 11px",
            marginBottom: "6px",
          }}
        >
          <div
            style={{
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11.5px",
              color: COLORS.ink,
              marginBottom: "4px",
            }}
          >
            {PLANT_ASPECTS.find((a) => a.id === open)?.label}
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text)", lineHeight: 1.5, margin: 0 }}>
            {aspects[open]}
          </p>
        </div>
      )}
    </CardShell>
  );
}
