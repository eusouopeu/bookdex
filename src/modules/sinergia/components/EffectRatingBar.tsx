import { Minus, Plus } from "lucide-react";
import { COLORS } from "../theme";
import { clampRating, probabilityWeight, probabilityLabel, confidenceLabel } from "../lib/effectProfiles";

const CONFIDENCE_BORDER: Record<string, string> = {
  anedota: "1.5px dashed",
  mecanismo: "1.5px solid",
  estudo: "2px solid",
  consenso: "2.5px solid",
};

/**
 * Barra de 5 blocos: verde quando o item MELHORA o critério (nota positiva),
 * vermelho quando PIORA (nota negativa), preenchida proporcionalmente ao
 * valor absoluto da nota (de -5 a +5) — sempre um valor só, largura fixa
 * independente do conteúdo. Com `onChange` vira editável, com botões de
 * +/- pra ajustar o valor; sem ele, é só leitura (sem os botões).
 *
 * `probability`/`confidence` (opcionais, faixas — nunca número exato) codificam
 * a incerteza da aresta: probabilidade baixa reduz a opacidade dos blocos
 * preenchidos, confiança baixa deixa a borda tracejada. Sem esses dados
 * (notas antigas, sem meta), a barra renderiza igual a antes.
 */
export default function EffectRatingBar({
  label,
  value,
  editable,
  onChange,
  unrated,
  originalValue,
  probability,
  confidence,
}: {
  label: string;
  value: number;
  editable?: boolean;
  onChange?: (v: number) => void;
  unrated?: boolean;
  originalValue?: number | null;
  probability?: string;
  confidence?: string;
}) {
  const v = value || 0;
  const abs = Math.abs(v);
  const color = unrated ? "var(--text-faint)" : v > 0 ? "var(--success)" : v < 0 ? "var(--danger)" : "var(--text-muted)";
  const originalAbs = originalValue != null ? Math.abs(originalValue) : null;
  const showOriginalMarker = originalValue != null && originalValue !== v;
  const fillOpacity = probability ? Math.max(0.4, probabilityWeight(probability) / probabilityWeight("quase_certo")) : 1;
  const blockBorderStyle = confidence ? CONFIDENCE_BORDER[confidence] || CONFIDENCE_BORDER.mecanismo : null;
  const uncertaintyTitle =
    probability || confidence
      ? [probability && `Probabilidade: ${probabilityLabel(probability)}`, confidence && `Confiança: ${confidenceLabel(confidence)}`].filter(Boolean).join(" · ")
      : undefined;

  if (unrated) {
    return (
      <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "9.5px",
            color: COLORS.ink,
            width: "84px",
            flexShrink: 0,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            lineHeight: 1.15,
          }}
        >
          {label}
        </span>
        <div
          className="flex items-center"
          style={{ flex: 1, minWidth: 0, borderTop: `1.5px dashed ${COLORS.screenBorder}`, opacity: 0.5 }}
        />
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-faint)", flexShrink: 0 }}>
          não avaliado
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
      <span
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "9.5px",
          color: COLORS.ink,
          width: "84px",
          flexShrink: 0,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          lineHeight: 1.15,
        }}
      >
        {label}
      </span>
      {editable && (
        <button
          onClick={() => onChange && onChange(clampRating(v - 1))}
          disabled={v <= -5}
          aria-label={`Diminuir nota de ${label}`}
          style={{
            width: "20px",
            height: "20px",
            flexShrink: 0,
            borderRadius: "5px",
            border: `1.5px solid ${COLORS.screenBorder}`,
            background: "transparent",
            color: COLORS.ink,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: v <= -5 ? "default" : "pointer",
            opacity: v <= -5 ? 0.4 : 1,
          }}
        >
          <Minus size={10} />
        </button>
      )}
      <div className="flex" style={{ flex: 1, gap: "2px", minWidth: 0 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= abs;
          const isOriginalEdge = showOriginalMarker && n === originalAbs;
          return (
            <div
              key={n}
              aria-hidden="true"
              title={(showOriginalMarker && isOriginalEdge ? `Estimativa da IA: ${(originalValue as number) > 0 ? "+" : ""}${originalValue}` : uncertaintyTitle) || undefined}
              style={{
                position: "relative",
                flex: 1,
                height: "8px",
                borderRadius: "2px",
                background: filled ? color : "transparent",
                border: `${filled && blockBorderStyle ? blockBorderStyle : "1.5px solid"} ${filled ? color : COLORS.screenBorder}`,
                opacity: filled ? fillOpacity : 0.3,
              }}
            >
              {isOriginalEdge && (
                <div
                  style={{
                    position: "absolute",
                    top: "-3px",
                    bottom: "-3px",
                    [originalAbs === 0 ? "left" : "right"]: "-1px",
                    width: "2px",
                    background: COLORS.gold,
                    borderRadius: "1px",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {editable && (
        <button
          onClick={() => onChange && onChange(clampRating(v + 1))}
          disabled={v >= 5}
          aria-label={`Aumentar nota de ${label}`}
          style={{
            width: "20px",
            height: "20px",
            flexShrink: 0,
            borderRadius: "5px",
            border: `1.5px solid ${COLORS.screenBorder}`,
            background: "transparent",
            color: COLORS.ink,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: v >= 5 ? "default" : "pointer",
            opacity: v >= 5 ? 0.4 : 1,
          }}
        >
          <Plus size={10} />
        </button>
      )}
      <span
        style={{
          width: "22px",
          flexShrink: 0,
          textAlign: "right",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "10.5px",
          fontWeight: 700,
          color,
        }}
      >
        {v > 0 ? `+${v}` : v}
      </span>
    </div>
  );
}
