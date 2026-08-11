import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Library, Search, X, Download, Trash2, ArrowDownAZ, Clock } from "lucide-react";
import { COLORS, slug } from "../theme";
import { getJSON, KEYS } from "../lib/storage";
import TechCard from "../components/TechCard";
import DefinitionCard from "../components/DefinitionCard";
import ListItemCard from "../components/ListItemCard";

const BACKUP_REMINDER_DAYS = 14;

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

export default function DexView({ saved, storageLoaded, onToggleSave, onOpenDetail, onOpenImport, onRemoveGroup }) {
  const [collapsed, setCollapsed] = useState({});
  const [category, setCategory] = useState("technique"); // "technique" | "knowledge"
  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // "recent" | "name"
  const [lastBackup, setLastBackup] = useState(undefined); // undefined = ainda não carregado
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      setLastBackup(await getJSON(KEYS.lastBackup, null));
    })();
  }, []);

  const entries = Object.entries(saved);
  const techniqueEntries = useMemo(
    () => entries.filter(([, g]) => !g.kind || g.kind === "technique"),
    [entries]
  );
  const knowledgeEntries = useMemo(
    () => entries.filter(([, g]) => g.kind === "definition" || g.kind === "list"),
    [entries]
  );

  function itemLabel(kind, item) {
    return kind === "definition" ? item.term : item.name;
  }

  function filterEntries(list) {
    const q = slug(filterText.trim());
    if (!q) return list;
    return list
      .map(([key, group]) => {
        const isKnowledge = group.kind === "definition" || group.kind === "list";
        const items = isKnowledge ? group.items : group.techniques;
        if (slug(group.displayName).includes(q)) return [key, group];
        const matchedItems = items.filter((it) => slug(itemLabel(group.kind, it)).includes(q));
        if (matchedItems.length === 0) return null;
        return [key, isKnowledge ? { ...group, items: matchedItems } : { ...group, techniques: matchedItems }];
      })
      .filter(Boolean);
  }

  function groupItems(group) {
    return group.kind === "definition" || group.kind === "list" ? group.items : group.techniques;
  }

  function sortEntries(list) {
    const copy = [...list];
    if (sortBy === "name") {
      copy.sort((a, b) => a[1].displayName.localeCompare(b[1].displayName, "pt-BR"));
    } else {
      copy.sort((a, b) => {
        const aMax = Math.max(0, ...groupItems(a[1]).map((it) => it.savedAt || 0));
        const bMax = Math.max(0, ...groupItems(b[1]).map((it) => it.savedAt || 0));
        return bMax - aMax;
      });
    }
    return copy;
  }

  function toggleFolder(key) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : null;
  const showBackupReminder =
    storageLoaded &&
    entries.length > 0 &&
    !bannerDismissed &&
    (lastBackup === null || (daysSinceBackup !== null && daysSinceBackup >= BACKUP_REMINDER_DAYS));

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
  const visibleEntries = sortEntries(filterEntries(activeEntries));

  return (
    <>
      {showBackupReminder && (
        <div
          className="flex items-center gap-2"
          style={{
            background: "rgba(255,201,71,0.25)",
            border: `2px solid ${COLORS.gold}`,
            borderRadius: "10px",
            padding: "9px 10px",
            marginBottom: "14px",
          }}
        >
          <Download size={16} style={{ flexShrink: 0, color: "#4A3300" }} />
          <p style={{ flex: 1, fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: COLORS.ink, lineHeight: 1.35, margin: 0 }}>
            {lastBackup ? `Faz ${daysSinceBackup} dias que você não faz backup dos seus dados.` : "Você ainda não fez backup dos seus dados."}
          </p>
          <button
            onClick={onOpenImport}
            style={{
              background: "none",
              border: "none",
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11.5px",
              color: COLORS.lensBlue,
              cursor: "pointer",
              whiteSpace: "nowrap",
              padding: "4px",
            }}
          >
            Fazer backup
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="Dispensar aviso de backup"
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "4px", flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex gap-2" style={{ marginBottom: "10px" }}>
        <button onClick={() => setCategory("technique")} style={badgeStyle(category === "technique")}>
          Técnicas ({techniqueEntries.reduce((s, [, g]) => s + g.techniques.length, 0)})
        </button>
        <button onClick={() => setCategory("knowledge")} style={badgeStyle(category === "knowledge")}>
          Conceitos &amp; Tipos ({knowledgeEntries.reduce((s, [, g]) => s + g.items.length, 0)})
        </button>
      </div>

      <div className="flex items-center gap-2" style={{ marginBottom: "10px", position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: "11px", color: COLORS.screenBorder, pointerEvents: "none" }} />
        <input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Buscar na sua Pokédex..."
          style={{
            width: "100%",
            borderRadius: "8px",
            border: `2px solid ${COLORS.screenBorder}`,
            padding: "9px 12px 9px 32px",
            minHeight: "38px",
            fontFamily: "Inter, sans-serif",
            fontSize: "12.5px",
            background: COLORS.white,
            color: COLORS.ink,
            outline: "none",
          }}
        />
        {filterText && (
          <button
            onClick={() => setFilterText("")}
            aria-label="Limpar busca"
            style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "4px" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5" style={{ marginBottom: "16px" }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#5c6b52", marginRight: "2px" }}>Ordenar:</span>
        <button
          onClick={() => setSortBy("recent")}
          className="flex items-center gap-1"
          style={{
            padding: "5px 10px",
            borderRadius: "999px",
            border: `1.5px solid ${COLORS.screenBorder}`,
            background: sortBy === "recent" ? COLORS.screenBorder : "transparent",
            color: sortBy === "recent" ? COLORS.white : COLORS.screenBorder,
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "10.5px",
            cursor: "pointer",
          }}
        >
          <Clock size={11} /> Recentes
        </button>
        <button
          onClick={() => setSortBy("name")}
          className="flex items-center gap-1"
          style={{
            padding: "5px 10px",
            borderRadius: "999px",
            border: `1.5px solid ${COLORS.screenBorder}`,
            background: sortBy === "name" ? COLORS.screenBorder : "transparent",
            color: sortBy === "name" ? COLORS.white : COLORS.screenBorder,
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "10.5px",
            cursor: "pointer",
          }}
        >
          <ArrowDownAZ size={11} /> Nome
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

      {activeEntries.length > 0 && visibleEntries.length === 0 && (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ minHeight: "180px", color: COLORS.screenBorder }}
        >
          <Search size={28} strokeWidth={1.5} style={{ marginBottom: "8px" }} />
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", maxWidth: "220px" }}>
            Nada encontrado para "{filterText}".
          </p>
        </div>
      )}

      {visibleEntries.map(([key, group]) => {
        const open = !collapsed[key];
        const isKnowledge = group.kind === "definition" || group.kind === "list";
        const count = isKnowledge ? group.items.length : group.techniques.length;
        return (
          <div key={key} style={{ marginBottom: "18px" }}>
            <div
              className="flex items-center gap-1.5"
              style={{
                borderBottom: `2px solid ${COLORS.screenBorder}`,
                marginBottom: "9px",
              }}
            >
              <button
                onClick={() => toggleFolder(key)}
                className="flex items-center gap-1.5"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "none",
                  border: "none",
                  padding: "6px 0 5px",
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
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {group.displayName}{" "}
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", fontWeight: 400 }}>
                    ({count})
                  </span>
                </h3>
              </button>
              <button
                onClick={() => onRemoveGroup(key)}
                aria-label={`Remover assunto "${group.displayName}" inteiro`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#8a1f1f",
                  padding: "9px 4px",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
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
