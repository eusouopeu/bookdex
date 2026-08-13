import { ArrowLeft } from "lucide-react";
import { COLORS, getTypeColor } from "../theme";
import StatBar from "../components/StatBar";

/**
 * Comparação lado a lado de 2-3 técnicas já salvas, possivelmente de assuntos
 * (e portanto statLabels) diferentes — por isso cada técnica mostra suas
 * próprias labels em vez de assumir um conjunto compartilhado.
 */
export default function CompareView({ items, onBack }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5"
        style={{
          background: "none",
          border: "none",
          color: COLORS.ink,
          fontFamily: '"Baloo 2", sans-serif',
          fontWeight: 700,
          fontSize: "12.5px",
          cursor: "pointer",
          padding: "8px 8px 8px 0",
          minHeight: "40px",
          marginBottom: "4px",
        }}
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink, marginBottom: "12px" }}>
        Comparando {items.length} técnicas
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          gap: "8px",
        }}
      >
        {items.map(({ subjectDisplay, technique }, i) => {
          const color = getTypeColor(technique.type);
          const statLabels = technique.statLabels || [];
          return (
            <div
              key={i}
              style={{
                background: COLORS.surface,
                border: `2px solid ${COLORS.screenBorder}`,
                borderRadius: "10px",
                padding: "10px",
                minWidth: 0,
              }}
            >
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "9px", color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {subjectDisplay}
              </div>
              <h3
                style={{
                  fontFamily: '"Baloo 2", sans-serif',
                  fontWeight: 700,
                  fontSize: "13px",
                  color: COLORS.ink,
                  lineHeight: 1.15,
                  marginBottom: "5px",
                  minHeight: "32px",
                }}
              >
                {technique.name}
              </h3>
              <span
                style={{
                  display: "inline-block",
                  background: color.bg,
                  color: color.text,
                  fontSize: "9px",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: "999px",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                {technique.type}
              </span>
              <div className="space-y-1.5">
                {statLabels.map((label, si) => (
                  <StatBar key={label + si} label={label} value={technique.stats ? technique.stats[si] : 0} color={color} />
                ))}
              </div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text)", lineHeight: 1.35, marginTop: "8px" }}>
                {technique.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
