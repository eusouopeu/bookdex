import { BookOpen } from "lucide-react";
import { COLORS, getTypeColor } from "../theme";
import PokeballIcon from "./PokeballIcon";
import StatBar from "./StatBar";

export default function TechCard({ index, technique, statLabels, saved, onToggle, onOpenDetail }) {
  const color = getTypeColor(technique.type);
  return (
    <div
      style={{
        background: COLORS.white,
        border: `2px solid ${COLORS.screenBorder}`,
        borderRadius: "10px",
        padding: "12px",
        marginBottom: "10px",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "#8a8a7a" }}>
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
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "#3a3a30", lineHeight: 1.4, marginBottom: "9px" }}>
        {technique.description}
      </p>
      <div className="space-y-1.5" style={{ marginBottom: "8px" }}>
        {statLabels.map((label, i) => (
          <StatBar key={label + i} label={label} value={technique.stats ? technique.stats[i] : 0} color={color} />
        ))}
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#5c6b52", fontStyle: "italic" }}>
        Ideal para: {technique.bestFor}
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
          <BookOpen size={14} /> Aprofundar
        </button>
      )}
    </div>
  );
}
