import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Library } from "lucide-react";
import { COLORS } from "../theme";
import TechCard from "../components/TechCard";
import DefinitionCard from "../components/DefinitionCard";
import ListItemCard from "../components/ListItemCard";

function badgeStyle(active) {
  return {
    flex: 1,
    padding: "8px 10px",
    minHeight: "38px",
    borderRadius: "999px",
    border: `2px solid ${COLORS.screenBorder}`,
    cursor: "pointer",
    fontFamily: '"Baloo 2", sans-serif',
    fontWeight: 700,
    fontSize: "11.5px",
    letterSpacing: "0.01em",
    background: active ? COLORS.screenBorder : "transparent",
    color: active ? COLORS.white : COLORS.screenBorder,
    transition: "background 0.15s ease, color 0.15s ease",
  };
}

export default function DexView({ saved, storageLoaded, onToggleSave, onOpenDetail }) {
  const [collapsed, setCollapsed] = useState({});
  const [category, setCategory] = useState("technique"); // "technique" | "knowledge"

  const entries = Object.entries(saved);
  const techniqueEntries = useMemo(
    () => entries.filter(([, g]) => !g.kind || g.kind === "technique"),
    [entries]
  );
  const knowledgeEntries = useMemo(
    () => entries.filter(([, g]) => g.kind === "definition" || g.kind === "list"),
    [entries]
  );

  function toggleFolder(key) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  if (storageLoaded && entries.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ minHeight: "380px", color: COLORS.screenBorder }}
      >
        <BookOpen size={36} strokeWidth={1.5} style={{ marginBottom: "10px" }} />
        <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "15px", color: COLORS.ink }}>
          Sua Pokédex está vazia
        </p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", maxWidth: "230px", marginTop: "4px" }}>
          Busque um assunto (tec: / def: / list:) e capture o que quiser guardar — ou importe o que você já capturou.
        </p>
      </div>
    );
  }

  const activeEntries = category === "technique" ? techniqueEntries : knowledgeEntries;

  return (
    <>
      <div className="flex gap-2" style={{ marginBottom: "16px" }}>
        <button onClick={() => setCategory("technique")} style={badgeStyle(category === "technique")}>
          Técnicas ({techniqueEntries.reduce((s, [, g]) => s + g.techniques.length, 0)})
        </button>
        <button onClick={() => setCategory("knowledge")} style={badgeStyle(category === "knowledge")}>
          Conceitos &amp; Tipos ({knowledgeEntries.reduce((s, [, g]) => s + g.items.length, 0)})
        </button>
      </div>

      {activeEntries.length === 0 && (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ minHeight: "260px", color: COLORS.screenBorder }}
        >
          <Library size={32} strokeWidth={1.5} style={{ marginBottom: "10px" }} />
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", maxWidth: "220px" }}>
            {category === "technique"
              ? "Nenhuma técnica capturada ainda. Busque com tec: ou sem prefixo."
              : "Nenhum conceito ou tipo capturado ainda. Busque com def: ou list:."}
          </p>
        </div>
      )}

      {activeEntries.map(([key, group]) => {
        const open = !collapsed[key];
        const isKnowledge = group.kind === "definition" || group.kind === "list";
        const count = isKnowledge ? group.items.length : group.techniques.length;
        return (
          <div key={key} style={{ marginBottom: "18px" }}>
            <button
              onClick={() => toggleFolder(key)}
              className="flex items-center gap-1.5"
              style={{
                width: "100%",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${COLORS.screenBorder}`,
                padding: "6px 0 5px",
                marginBottom: "9px",
                minHeight: "40px",
                cursor: "pointer",
                textAlign: "left",
                color: COLORS.ink,
              }}
            >
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <h3
                style={{
                  fontFamily: '"Baloo 2", sans-serif',
                  fontWeight: 800,
                  fontSize: "15px",
                  color: COLORS.ink,
                  margin: 0,
                }}
              >
                {group.displayName}{" "}
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", fontWeight: 400 }}>
                  ({count})
                </span>
              </h3>
            </button>
            {open && !isKnowledge &&
              group.techniques.map((t, i) => (
                <TechCard
                  key={t.id}
                  index={i}
                  technique={t}
                  statLabels={t.statLabels || []}
                  saved={true}
                  onToggle={() => onToggleSave("technique", group.displayName, { technique: t, statLabels: t.statLabels })}
                  onOpenDetail={() => onOpenDetail(group.displayName, t)}
                />
              ))}
            {open && group.kind === "definition" &&
              group.items.map((d) => (
                <DefinitionCard
                  key={d.id}
                  definition={d}
                  saved={true}
                  onToggle={() => onToggleSave("definition", group.displayName, { definition: d })}
                />
              ))}
            {open && group.kind === "list" &&
              group.items.map((it, i) => (
                <ListItemCard
                  key={it.id}
                  index={i}
                  item={it}
                  saved={true}
                  onToggle={() => onToggleSave("list", group.displayName, { item: it })}
                />
              ))}
          </div>
        );
      })}
    </>
  );
}
