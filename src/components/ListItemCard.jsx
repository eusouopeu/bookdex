import { COLORS, getTypeColor } from "../theme";
import PokeballIcon from "./PokeballIcon";

/**
 * Card de um item de enumeração/tipo (modo "list:"). Como TechCard, mas sem
 * stats — apenas nome, categoria e descrição.
 */
export default function ListItemCard({ index, item, saved, onToggle }) {
  const color = getTypeColor(item.category);
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
            {item.name}
          </h3>
        </div>
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
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "#3a3a30", lineHeight: 1.4 }}>
        {item.description}
      </p>
    </div>
  );
}
