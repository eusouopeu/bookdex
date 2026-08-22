import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Library,
  Search,
  X,
  Download,
  Trash2,
  ArrowUpDown,
  Scale,
  Tag,
  CheckSquare,
  Check,
  FolderPlus,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { COLORS, slug } from "../theme";
import { getJSON, KEYS } from "../lib/storage";
import TechCard from "../components/TechCard";
import DefinitionCard from "../components/DefinitionCard";
import ListItemCard from "../components/ListItemCard";
import PlantCard from "../components/PlantCard";
import CollectionPicker from "../components/CollectionPicker";
import WordsView from "./WordsView";
import { useData } from "../state/DataContext";
import { usePrefs } from "../state/PrefsContext";
import { groupItems, itemKind, itemLabel, categoryOfKind, withItems } from "../lib/savedModel";
import { plantFreeText } from "../lib/plants";

const BACKUP_REMINDER_DAYS = 14;
const CONFIRM_THRESHOLD = 3; // grupos com mais itens do que isso pedem confirmação antes de apagar
const MAX_COMPARE = 3;

const EXAMPLE_SEARCHES = [
  { mode: "technique", term: "técnicas de respiração" },
  { mode: "definition", term: "efeito placebo" },
  { mode: "list", term: "tipos de memória" },
  { mode: "plant", term: "alecrim" },
];

const EMPTY_CATEGORY_MSG = {
  technique: "Nenhuma técnica capturada ainda. Busque com tec: ou sem prefixo.",
  knowledge: "Nenhum conceito ou tipo capturado ainda. Busque com def: ou list:.",
  plants: "Nenhuma planta capturada ainda. Busque com plt: ou identifique uma pela foto.",
};

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

export default function DexView({ onOpenDetail, onOpenImport, onSearchRelated, onExampleSearch, onOpenCompare }) {
  const { dexCategory: category, showArchived, toggleShowArchived: onToggleShowArchived } = usePrefs();
  const {
    saved,
    detailCache,
    collections,
    storageLoaded,
    hasDetail,
    toggleSave: onToggleSave,
    removeGroup: onRemoveGroup,
    updateItemTags: onUpdateTags,
    updateItemNote: onUpdateNote,
    updateItemImages: onUpdateImages,
    bulkRemoveItems: onBulkRemoveItems,
    bulkAddTag: onBulkAddTag,
    archiveItems: onArchiveItems,
    addToCollection: onAddToCollection,
    convertItem: onConvertItem,
    enrichItem: onEnrichItem,
    updatePlantAspect: onUpdatePlantAspect,
  } = useData();
  const [collapsed, setCollapsed] = useState({});
  const [filterText, setFilterText] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [sortBy, setSortBy] = useState("recent"); // "recent" | "name"
  const [lastBackup, setLastBackup] = useState(undefined); // undefined = ainda não carregado
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState([]); // [{subjectKey, id}]
  const [confirmingRemove, setConfirmingRemove] = useState(null); // key do grupo aguardando 2º clique
  const [selectMode, setSelectMode] = useState(false);
  const [bulkSelection, setBulkSelection] = useState([]); // [{subjectKey, itemId}]
  const [bulkTagDraft, setBulkTagDraft] = useState("");
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [pickingCollection, setPickingCollection] = useState(false);

  useEffect(() => {
    (async () => {
      setLastBackup(await getJSON(KEYS.lastBackup, null));
    })();
  }, []);

  useEffect(() => {
    exitCompareMode();
    exitSelectMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const entries = Object.entries(saved);

  /**
   * Um assunto pode misturar técnicas, conceitos e tipos (o `kind` é do item),
   * então a badge de categoria filtra ITENS, não grupos: cada aba mostra o
   * mesmo assunto com o recorte dela, e some se não sobrar nada.
   */
  const activeEntries = useMemo(() => {
    return entries
      .map(([key, group]) => [
        key,
        withItems(
          group,
          groupItems(group).filter((it) => categoryOfKind(itemKind(it, group)) === category)
        ),
      ])
      .filter(([, group]) => group.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, category]);

  const allTags = useMemo(() => {
    const set = new Set();
    for (const [, group] of activeEntries) {
      for (const item of group.items) {
        for (const t of item.tags || []) set.add(t);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [activeEntries]);

  function guideText(subjectDisplay, item) {
    if (!detailCache) return "";
    const detail = detailCache[`${slug(subjectDisplay)}:${item.id}`];
    if (!detail) return "";
    return [
      detail.overview,
      detail.tip,
      ...(detail.steps || []).flatMap((s) => [s.title, s.detail]),
      ...(detail.rightSigns || []),
      ...(detail.wrongSigns || []),
    ]
      .filter(Boolean)
      .join(" ");
  }

  /** Texto livre de um item salvo (nota + descrição/definição + exemplo), pra busca full-text. */
  function itemFreeText(it) {
    return [
      it.note,
      it.description,
      it.definition,
      it.example,
      ...(it.keyPoints || []),
      ...(it.relatedTerms || []),
      it.bestFor,
      it.kind === "plant" ? plantFreeText(it) : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function filterEntries(list) {
    const q = slug(filterText.trim());
    return list
      .map(([key, group]) => {
        const subjectMatches = !q || slug(group.displayName).includes(q);
        const finalItems = group.items.filter((it) => {
          if (!showArchived && it.archived) return false;
          if (showArchived && !it.archived) return false;
          if (activeTag && !(it.tags || []).includes(activeTag)) return false;
          if (!q || subjectMatches) return true;
          if (slug(itemLabel(it)).includes(q)) return true;
          if (slug(itemFreeText(it)).includes(q)) return true;
          if (itemKind(it, group) === "technique" && slug(guideText(group.displayName, it)).includes(q)) return true;
          return false;
        });
        if (finalItems.length === 0) return null;
        return [key, withItems(group, finalItems)];
      })
      .filter(Boolean);
  }

  function sortEntries(list) {
    const copy = [...list];
    if (sortBy === "name") {
      copy.sort((a, b) => a[1].displayName.localeCompare(b[1].displayName, "pt-BR"));
    } else {
      copy.sort((a, b) => {
        const aMax = Math.max(0, ...a[1].items.map((it) => it.savedAt || 0));
        const bMax = Math.max(0, ...b[1].items.map((it) => it.savedAt || 0));
        return bMax - aMax;
      });
    }
    return copy;
  }

  function toggleFolder(key) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  /**
   * Props de seleção do card. Os dois modos (comparar e selecionar em massa)
   * usam a MESMA aparência: checkbox dentro do card + borda destacada.
   */
  function selectionProps(subjectKey, itemId, subjectDisplay, technique, kind) {
    if (compareMode) {
      if (kind !== "technique") return {};
      return {
        selectable: true,
        selected: compareSelection.some((c) => c.subjectKey === subjectKey && c.id === itemId),
        onSelectToggle: () => toggleCompareSelection(subjectKey, subjectDisplay, technique),
      };
    }
    if (selectMode) {
      return {
        selectable: true,
        selected: bulkSelection.some((b) => b.subjectKey === subjectKey && b.itemId === itemId),
        onSelectToggle: () => toggleBulkItem(subjectKey, itemId),
      };
    }
    return {};
  }

  function requestRemoveGroup(key, count) {
    if (count <= CONFIRM_THRESHOLD || confirmingRemove === key) {
      onRemoveGroup(key);
      setConfirmingRemove(null);
    } else {
      setConfirmingRemove(key);
    }
  }

  function toggleCompareSelection(subjectKey, subjectDisplay, technique) {
    const id = technique.id;
    setCompareSelection((prev) => {
      const exists = prev.some((p) => p.subjectKey === subjectKey && p.id === id);
      if (exists) return prev.filter((p) => !(p.subjectKey === subjectKey && p.id === id));
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, { subjectKey, id, subjectDisplay, technique }];
    });
  }

  function exitCompareMode() {
    setCompareMode(false);
    setCompareSelection([]);
  }

  function launchCompare() {
    if (compareSelection.length < 2) return;
    onOpenCompare(compareSelection.map(({ subjectDisplay, technique }) => ({ subjectDisplay, technique })));
    exitCompareMode();
  }

  function exitSelectMode() {
    setSelectMode(false);
    setBulkSelection([]);
    setBulkTagDraft("");
    setConfirmingBulkDelete(false);
  }

  function toggleBulkItem(subjectKey, itemId) {
    setBulkSelection((prev) => {
      const exists = prev.some((p) => p.subjectKey === subjectKey && p.itemId === itemId);
      if (exists) return prev.filter((p) => !(p.subjectKey === subjectKey && p.itemId === itemId));
      return [...prev, { subjectKey, itemId }];
    });
  }

  function applyBulkTag() {
    const clean = bulkTagDraft.trim();
    if (!clean || bulkSelection.length === 0) return;
    onBulkAddTag(bulkSelection, clean);
    setBulkTagDraft("");
    exitSelectMode();
  }

  function applyBulkArchive() {
    if (bulkSelection.length === 0) return;
    onArchiveItems(bulkSelection, !showArchived);
    exitSelectMode();
  }

  function applyBulkDelete() {
    if (bulkSelection.length === 0) return;
    if (!confirmingBulkDelete) {
      setConfirmingBulkDelete(true);
      return;
    }
    onBulkRemoveItems(bulkSelection);
    exitSelectMode();
  }

  function pickCollectionForBulk(collectionId, newName) {
    if (bulkSelection.length === 0) return;
    if (collectionId) {
      onAddToCollection(collectionId, bulkSelection);
    } else if (newName) {
      onAddToCollection(null, bulkSelection, newName);
    }
    setPickingCollection(false);
    exitSelectMode();
  }

  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : null;
  const showBackupReminder =
    storageLoaded &&
    entries.length > 0 &&
    !bannerDismissed &&
    (lastBackup === null || (daysSinceBackup !== null && daysSinceBackup >= BACKUP_REMINDER_DAYS));

  if (storageLoaded && entries.length === 0 && category !== "words") {
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
          Busque um assunto (tec: / def: / list: / plt:) e capture o que quiser guardar — ou importe o que você já capturou.
        </p>
        {onExampleSearch && (
          <div style={{ marginTop: "18px", width: "100%", maxWidth: "280px" }}>
            <div
              style={{
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: "11px",
                color: COLORS.ink,
                marginBottom: "8px",
              }}
            >
              Experimente:
            </div>
            <div className="flex" style={{ flexWrap: "wrap", gap: "6px", justifyContent: "center" }}>
              {EXAMPLE_SEARCHES.map((ex) => (
                <button
                  key={ex.mode + ex.term}
                  onClick={() => onExampleSearch(ex.mode, ex.term)}
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "11px",
                    color: COLORS.ink,
                    background: COLORS.surface,
                    border: `1.5px solid ${COLORS.screenBorder}`,
                    borderRadius: "999px",
                    padding: "5px 11px",
                    cursor: "pointer",
                  }}
                >
                  {ex.term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

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

      {category === "words" ? (
        <WordsView />
      ) : (
        <>
      {showArchived && (
        <div
          style={{
            background: "rgba(92,107,82,0.15)",
            border: `2px solid ${COLORS.screenBorder}`,
            borderRadius: "10px",
            padding: "8px 10px",
            marginBottom: "10px",
            fontFamily: "Inter, sans-serif",
            fontSize: "11.5px",
            color: COLORS.ink,
          }}
        >
          Mostrando itens arquivados — eles não aparecem na Pokédex ativa, mas continuam no backup/export.
        </div>
      )}

      {compareMode && (
        <div
          style={{
            background: "rgba(46,134,222,0.1)",
            border: `2px solid ${COLORS.lensBlue}`,
            borderRadius: "10px",
            padding: "8px 10px",
            marginBottom: "10px",
            fontFamily: "Inter, sans-serif",
            fontSize: "11.5px",
            color: COLORS.ink,
          }}
        >
          Selecione de 2 a {MAX_COMPARE} técnicas para comparar lado a lado ({compareSelection.length}/{MAX_COMPARE}).
        </div>
      )}

      {selectMode && (
        <div
          style={{
            background: "rgba(46,134,222,0.1)",
            border: `2px solid ${COLORS.lensBlue}`,
            borderRadius: "10px",
            padding: "8px 10px",
            marginBottom: "10px",
            fontFamily: "Inter, sans-serif",
            fontSize: "11.5px",
            color: COLORS.ink,
          }}
        >
          Toque nos itens que quiser selecionar ({bulkSelection.length} selecionado(s)).
        </div>
      )}

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
            background: COLORS.surface,
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

      {allTags.length > 0 && (
        <div className="flex items-center" style={{ flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          <Tag size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag((t) => (t === tag ? null : tag))}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10.5px",
                padding: "3px 9px",
                borderRadius: "999px",
                border: `1.5px solid ${COLORS.lensBlue}`,
                background: activeTag === tag ? COLORS.lensBlue : "transparent",
                color: activeTag === tag ? COLORS.white : COLORS.lensBlue,
                cursor: "pointer",
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2" style={{ marginBottom: "16px", justifyContent: "space-between" }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
          <ArrowUpDown size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Ordenar por"
            style={{
              borderRadius: "999px",
              border: `1.5px solid ${COLORS.screenBorder}`,
              background: COLORS.surface,
              color: COLORS.ink,
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11px",
              padding: "6px 10px",
              minHeight: "30px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="recent">Recentes</option>
            <option value="name">Nome</option>
          </select>
        </div>

        {((category === "technique" && onOpenCompare) || onBulkRemoveItems || onToggleShowArchived) && (
          <div className="flex gap-2" style={{ flexShrink: 0 }}>
            {onToggleShowArchived && (
              <button
                onClick={onToggleShowArchived}
                aria-label={showArchived ? "Ver itens ativos" : "Ver itens arquivados"}
                title={showArchived ? "Ver itens ativos" : "Ver itens arquivados"}
                style={{
                  ...badgeStyle(showArchived),
                  flex: "none",
                  width: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                {showArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              </button>
            )}
            {category === "technique" && onOpenCompare && (
              <button
                onClick={() => {
                  exitSelectMode();
                  compareMode ? exitCompareMode() : setCompareMode(true);
                }}
                aria-label="Comparar técnicas salvas"
                title="Comparar técnicas salvas"
                style={{
                  ...badgeStyle(compareMode),
                  flex: "none",
                  width: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <Scale size={14} />
              </button>
            )}
            {onBulkRemoveItems && (
              <button
                onClick={() => {
                  exitCompareMode();
                  selectMode ? exitSelectMode() : setSelectMode(true);
                }}
                aria-label="Selecionar vários itens"
                title="Selecionar vários itens"
                style={{
                  ...badgeStyle(selectMode),
                  flex: "none",
                  width: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <CheckSquare size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {activeEntries.length === 0 && (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ minHeight: "260px", color: COLORS.screenBorder }}
        >
          <Library size={32} strokeWidth={1.5} style={{ marginBottom: "10px" }} />
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", maxWidth: "220px" }}>
            {EMPTY_CATEGORY_MSG[category]}
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
            {filterText
              ? `Nada encontrado para "${filterText}".`
              : showArchived
                ? "Nenhum item arquivado."
                : "Nenhum item ativo (tudo arquivado ou filtrado)."}
          </p>
        </div>
      )}

      {visibleEntries.map(([key, group]) => {
        const open = !collapsed[key];
        const count = group.items.length;
        const confirming = confirmingRemove === key;
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
              {confirming ? (
                <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--danger)", whiteSpace: "nowrap" }}>
                    Remover {count}?
                  </span>
                  <button
                    onClick={() => requestRemoveGroup(key, count)}
                    aria-label={`Confirmar remoção de "${group.displayName}"`}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "9px 4px" }}
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => setConfirmingRemove(null)}
                    aria-label="Cancelar remoção"
                    style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "9px 4px" }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => requestRemoveGroup(key, count)}
                  aria-label={`Remover assunto "${group.displayName}" inteiro`}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--danger)",
                    padding: "9px 4px",
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            {open &&
              group.items.map((item) => {
                const kind = itemKind(item, group);
                const common = {
                  saved: true,
                  onTagsChange: onUpdateTags ? (tags) => onUpdateTags(key, item.id, kind, tags) : undefined,
                  onNoteChange: onUpdateNote ? (note) => onUpdateNote(key, item.id, kind, note) : undefined,
                  onConvert: selectMode || compareMode ? undefined : (target) => onConvertItem(key, item.id, target),
                  onEnrich: () => onEnrichItem(key, item.id),
                  ...selectionProps(key, item.id, group.displayName, item, kind),
                };
                if (kind === "definition") {
                  return (
                    <DefinitionCard
                      key={item.id}
                      {...common}
                      definition={item}
                      onToggle={() => onToggleSave("definition", group.displayName, { definition: item })}
                      onSearchRelated={onSearchRelated ? (term) => onSearchRelated("definition", term) : undefined}
                    />
                  );
                }
                if (kind === "plant") {
                  return (
                    <PlantCard
                      key={item.id}
                      {...common}
                      plant={item}
                      onToggle={() => onToggleSave("plant", group.displayName, { plant: item })}
                      onImagesChange={onUpdateImages ? (images) => onUpdateImages(key, item.id, kind, images) : undefined}
                      onAspectGenerated={(aspectId, text) => onUpdatePlantAspect(key, item.id, aspectId, text)}
                    />
                  );
                }
                if (kind === "list") {
                  return (
                    <ListItemCard
                      key={item.id}
                      {...common}
                      subjectDisplay={group.displayName}
                      item={item}
                      onToggle={() => onToggleSave("list", group.displayName, { item })}
                    />
                  );
                }
                return (
                  <TechCard
                    key={item.id}
                    {...common}
                    subjectDisplay={group.displayName}
                    technique={item}
                    statLabels={item.statLabels || []}
                    onToggle={() => onToggleSave("technique", group.displayName, { technique: item, statLabels: item.statLabels })}
                    onOpenDetail={compareMode || selectMode ? undefined : () => onOpenDetail(group.displayName, item)}
                    hasDetail={hasDetail ? hasDetail(group.displayName, item) : false}
                  />
                );
              })}
          </div>
        );
      })}

      {compareMode && (
        <div
          style={{
            position: "sticky",
            bottom: "4px",
            display: "flex",
            justifyContent: "center",
            marginTop: "14px",
          }}
        >
          <div className="flex gap-2">
            <button
              onClick={launchCompare}
              disabled={compareSelection.length < 2}
              style={{
                background: COLORS.lensBlue,
                color: "#fff",
                border: "none",
                borderRadius: "999px",
                padding: "10px 18px",
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: "12.5px",
                cursor: compareSelection.length < 2 ? "default" : "pointer",
                opacity: compareSelection.length < 2 ? 0.5 : 1,
                boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
              }}
            >
              Comparar ({compareSelection.length})
            </button>
            <button
              onClick={exitCompareMode}
              style={{
                background: "#23291F",
                color: "#fff",
                border: "none",
                borderRadius: "999px",
                padding: "10px 16px",
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: "12.5px",
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {selectMode && (
        <div
          style={{
            position: "sticky",
            bottom: "4px",
            display: "flex",
            justifyContent: "center",
            marginTop: "14px",
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{
              background: COLORS.surface,
              border: `2px solid ${COLORS.screenBorder}`,
              borderRadius: "10px",
              padding: "8px 10px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>
              {bulkSelection.length} selecionado(s)
            </span>
            <input
              value={bulkTagDraft}
              onChange={(e) => setBulkTagDraft(e.target.value)}
              placeholder="tag..."
              style={{
                width: "80px",
                borderRadius: "8px",
                border: `1.5px solid ${COLORS.screenBorder}`,
                padding: "5px 10px",
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10.5px",
                outline: "none",
              }}
            />
            <button
              onClick={applyBulkTag}
              disabled={bulkSelection.length === 0 || !bulkTagDraft.trim()}
              style={{
                background: COLORS.lensBlue,
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "7px 12px",
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: "11.5px",
                cursor: "pointer",
                opacity: bulkSelection.length === 0 || !bulkTagDraft.trim() ? 0.5 : 1,
              }}
            >
              Marcar
            </button>
            {onAddToCollection && (
              <button
                onClick={() => setPickingCollection(true)}
                disabled={bulkSelection.length === 0}
                className="flex items-center gap-1"
                style={{
                  background: "transparent",
                  color: COLORS.ink,
                  border: `1.5px solid ${COLORS.screenBorder}`,
                  borderRadius: "8px",
                  padding: "7px 12px",
                  fontFamily: '"Baloo 2", sans-serif',
                  fontWeight: 700,
                  fontSize: "11.5px",
                  cursor: "pointer",
                  opacity: bulkSelection.length === 0 ? 0.5 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                <FolderPlus size={12} /> Coleção
              </button>
            )}
            {onArchiveItems && (
              <button
                onClick={applyBulkArchive}
                disabled={bulkSelection.length === 0}
                className="flex items-center gap-1"
                style={{
                  background: "transparent",
                  color: COLORS.ink,
                  border: `1.5px solid ${COLORS.screenBorder}`,
                  borderRadius: "8px",
                  padding: "7px 12px",
                  fontFamily: '"Baloo 2", sans-serif',
                  fontWeight: 700,
                  fontSize: "11.5px",
                  cursor: "pointer",
                  opacity: bulkSelection.length === 0 ? 0.5 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {showArchived ? <ArchiveRestore size={12} /> : <Archive size={12} />} {showArchived ? "Desarquivar" : "Arquivar"}
              </button>
            )}
            <button
              onClick={applyBulkDelete}
              disabled={bulkSelection.length === 0}
              style={{
                background: "var(--danger)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "7px 12px",
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: "11.5px",
                cursor: "pointer",
                opacity: bulkSelection.length === 0 ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {confirmingBulkDelete ? "Confirmar?" : "Excluir"}
            </button>
            <button
              onClick={exitSelectMode}
              style={{
                background: "#23291F",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "7px 12px",
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: "11.5px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {pickingCollection && (
        <CollectionPicker
          collections={collections}
          onPick={(id, name) => pickCollectionForBulk(id, name)}
          onClose={() => setPickingCollection(false)}
        />
      )}

    </>
  );

}
