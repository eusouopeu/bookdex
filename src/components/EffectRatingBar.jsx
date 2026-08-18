import { Minus, Plus } from "lucide-react";
import { COLORS } from "../theme";
import { clampRating } from "../lib/effectProfiles";

const SEGMENTS = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

/**
 * Barra divergente de -5 a +5: segmentos vermelhos crescem pra esquerda
 * (o item PIORA o critério), verdes pra direita (o item MELHORA). Com
 * `onChange` vira editável, com botões de +/- pra ajustar a nota.
 */
export default function EffectRatingBar({ label, value, editable, onChange }) {
  const v = value || 0;
  const color = v > 0 ? "var(--success)" : v < 0 ? "var(--danger)" : "var(--text-muted)";

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
          onClick={() => onChange(clampRating(v - 1))}
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
        {SEGMENTS.map((n) => {
          const filled = (v > 0 && n > 0 && n <= v) || (v < 0 && n < 0 && n >= v);
          const segColor = n > 0 ? "var(--success)" : "var(--danger)";
          return (
            <div
              key={n}
              aria-hidden="true"
              style={{
                flex: 1,
                height: "8px",
                borderRadius: "2px",
                background: filled ? segColor : "transparent",
                border: `1.5px solid ${filled ? segColor : COLORS.screenBorder}`,
                opacity: filled ? 1 : 0.3,
              }}
            />
          );
        })}
      </div>
      {editable && (
        <button
          onClick={() => onChange(clampRating(v + 1))}
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
