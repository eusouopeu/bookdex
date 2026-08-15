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
  ArrowDownAZ,
  Clock,
  CalendarClock,
  Scale,
  Tag,
  CheckSquare,
  Check,
  FolderPlus,
  Folder,
} from "lucide-react";
import { COLORS, slug } from "../theme";
import { getJSON, KEYS } from "../lib/storage";
import { listAllItems, resolveLinks } from "../lib/links";
import TechCard from "../components/TechCard";
import DefinitionCard from "../components/DefinitionCard";
import ListItemCard from "../components/ListItemCard";
import CollectionPicker from "../components/CollectionPicker";
import CollectionsSection from "../components/CollectionsSection";
import RelatedSuggestions from "../components/RelatedSuggestions";
import LinkPicker from "../components/LinkPicker";

const BACKUP_REMINDER_DAYS = 14;
const CONFIRM_THRESHOLD = 3; // grupos com mais itens do que isso pedem confirmação antes de apagar
const MAX_COMPARE = 3;

const EXAMPLE_SEARCHES = [
  { mode: "technique", term: "técnicas de respiração" },
  { mode: "definition", term: "efeito placebo" },
  { mode: "list", term: "tipos de memória" },
];

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

export default function DexView({
  saved,
  detailCache,
  storageLoaded,
  onToggleSave,
  onOpenDetail,
  hasDetail,
  onOpenImport,
  onRemoveGroup,
  onUpdateTags,
  onUpdateNote,
  onUpdateImages,
  onLinkItems,
  onUnlinkItems,
  onSearchRelated,
  onExampleSearch,
  onOpenCompare,
  onBulkRemoveItems,
  onBulkAddTag,
  collections,
  onCreateCollection,
  onDeleteCollection,
  onAddToCollection,
  onRemoveFromCollection,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  onGenerateSuggestions,
}) {
  const [collapsed, setCollapsed] = useState({});
  const [category, setCategory] = useState("technique"); // "technique" | "knowledge" | "collections"
  const [filterText, setFilterText] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [sortBy, setSortBy] = useState("recent"); // "recent" | "name" | "review"
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
  const [linkPickerFor, setLinkPickerFor] = useState(null); // { subjectKey, itemId, kind } aguardando escolha

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

  function groupItems(group) {
    return group.kind === "definition" || group.kind === "list" ? group.items : group.techniques;
  }

  const allTags = useMemo(() => {
    const set = new Set();
    for (const [, group] of category === "technique" ? techniqueEntries : knowledgeEntries) {
      for (const item of groupItems(group)) {
        for (const t of item.tags || []) set.add(t);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [category, techniqueEntries, knowledgeEntries]);

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

  function filterEntries(list) {
    const q = slug(filterText.trim());
    const bySubjectAllowsAll = (group) => !q || slug(group.displayName).includes(q);
    return list
      .map(([key, group]) => {
        const isKnowledge = group.kind === "definition" || group.kind === "list";
        const items = isKnowledge ? group.items : group.techniques;
        const subjectMatches = bySubjectAllowsAll(group);
        const finalItems = items.filter((it) => {
          if (activeTag && !(it.tags || []).includes(activeTag)) return false;
          if (!q || subjectMatches) return true;
          if (slug(itemLabel(group.kind, it)).includes(q)) return true;
          if (!isKnowledge && slug(guideText(group.displayName, it)).includes(q)) return true;
          return false;
        });
        if (finalItems.length === 0) return null;
        return [key, isKnowledge ? { ...group, items: finalItems } : { ...group, techniques: finalItems }];
      })
      .filter(Boolean);
  }

  function sortEntries(list) {
    const copy = [...list];
    if (sortBy === "name") {
      copy.sort((a, b) => a[1].displayName.localeCompare(b[1].displayName, "pt-BR"));
    } else if (sortBy === "review") {
      copy.sort((a, b) => {
        const aMin = Math.min(...groupItems(a[1]).map((it) => (it.reviewState ? it.reviewState.nextReviewAt : 0)));
        const bMin = Math.min(...groupItems(b[1]).map((it) => (it.reviewState ? it.reviewState.nextReviewAt : 0)));
        return aMin - bMin;
      });
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

  function wrapSelectable(subjectKey, itemId, cardElement) {
    if (!selectMode) return cardElement;
    const isSelected = bulkSelection.some((s) => s.subjectKey === subjectKey && s.itemId === itemId);
    return (
      <div key={itemId} style={{ position: "relative", marginBottom: "10px" }} onClick={() => toggleBulkItem(subjectKey, itemId)}>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            zIndex: 2,
            width: "20px",
            height: "20px",
            borderRadius: "5px",
            border: `2px solid ${isSelected ? COLORS.lensBlue : COLORS.screenBorder}`,
            background: isSelected ? COLORS.lensBlue : COLORS.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
        </div>
        <div style={{ pointerEvents: "none", marginBottom: 0 }}>{cardElement}</div>
      </div>
    );
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

  function openLinkPicker(subjectKey, itemId, kind) {
    setLinkPickerFor({ subjectKey, itemId, kind });
  }

  function pickLinkTarget(target) {
    if (!linkPickerFor || !onLinkItems) return;
    onLinkItems(linkPickerFor, { subjectKey: target.subjectKey, itemId: target.itemId, kind: target.kind });
    setLinkPickerFor(null);
  }

  function jumpToLink(link) {
    setCategory(link.kind === "definition" || link.kind === "list" ? "knowledge" : "technique");
    setFilterText(link.label);
    setActiveTag(null);
    setCollapsed((c) => ({ ...c, [link.subjectKey]: false }));
    exitCompareMode();
    exitSelectMode();
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

      {onGenerateSuggestions && (
        <RelatedSuggestions
          suggestions={suggestions || []}
          loading={!!suggestionsLoading}
          error={suggestionsError}
          onGenerate={onGenerateSuggestions}
          onPick={(mode, term) => onSearchRelated && onSearchRelated(mode, term)}
        />
      )}

      <div className="flex gap-2" style={{ marginBottom: "10px", flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setCategory("technique");
            exitCompareMode();
            exitSelectMode();
          }}
          style={badgeStyle(category === "technique")}
        >
          Técnicas ({techniqueEntries.reduce((s, [, g]) => s + g.techniques.length, 0)})
        </button>
        <button
          onClick={() => {
            setCategory("knowledge");
            exitCompareMode();
            exitSelectMode();
          }}
          style={badgeStyle(category === "knowledge")}
        >
          Conceitos &amp; Tipos ({knowledgeEntries.reduce((s, [, g]) => s + g.items.length, 0)})
        </button>
        {onCreateCollection && (
          <button
            onClick={() => {
              setCategory("collections");
              exitCompareMode();
              exitSelectMode();
            }}
            className="flex items-center justify-center gap-1"
            style={badgeStyle(category === "collections")}
          >
            <Folder size={12} /> Coleções ({Object.keys(collections || {}).length})
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
              width: "38px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            <Scale size={15} />
          </button>
        )}
        {category !== "collections" && onBulkRemoveItems && (
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
              width: "38px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            <CheckSquare size={15} />
          </button>
        )}
      </div>

      {category === "collections" ? (
        <CollectionsSection
          collections={collections}
          saved={saved}
          detailCache={detailCache}
          onCreateCollection={onCreateCollection}
          onDeleteCollection={onDeleteCollection}
          onRemoveFromCollection={onRemoveFromCollection}
          onToggleSave={onToggleSave}
          onOpenDetail={onOpenDetail}
          hasDetail={hasDetail}
          onUpdateTags={onUpdateTags}
          onUpdateNote={onUpdateNote}
          onUpdateImages={onUpdateImages}
          onSearchRelated={onSearchRelated}
        />
      ) : (
        <>
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

      <div className="flex items-center gap-1.5" style={{ marginBottom: "16px" }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", marginRight: "2px" }}>Ordenar:</span>
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
        <button
          onClick={() => setSortBy("review")}
          className="flex items-center gap-1"
          style={{
            padding: "5px 10px",
            borderRadius: "999px",
            border: `1.5px solid ${COLORS.screenBorder}`,
            background: sortBy === "review" ? COLORS.screenBorder : "transparent",
            color: sortBy === "review" ? COLORS.white : COLORS.screenBorder,
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "10.5px",
            cursor: "pointer",
          }}
        >
          <CalendarClock size={11} /> Próxima revisão
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
            {open && !isKnowledge &&
              group.techniques.map((t, i) =>
                wrapSelectable(
                  key,
                  t.id,
                  <TechCard
                    key={t.id}
                    index={i}
                    subjectDisplay={group.displayName}
                    technique={t}
                    statLabels={t.statLabels || []}
                    saved={true}
                    onToggle={() => onToggleSave("technique", group.displayName, { technique: t, statLabels: t.statLabels })}
                    onOpenDetail={compareMode ? undefined : () => onOpenDetail(group.displayName, t)}
                    hasDetail={hasDetail ? hasDetail(group.displayName, t) : false}
                    onTagsChange={onUpdateTags ? (tags) => onUpdateTags(key, t.id, group.kind || "technique", tags) : undefined}
                    onNoteChange={onUpdateNote ? (note) => onUpdateNote(key, t.id, group.kind || "technique", note) : undefined}
                    onImagesChange={onUpdateImages ? (images) => onUpdateImages(key, t.id, group.kind || "technique", images) : undefined}
                    links={resolveLinks(saved, t.links)}
                    onOpenLinkPicker={onLinkItems ? () => openLinkPicker(key, t.id, "technique") : undefined}
                    onRemoveLink={onUnlinkItems ? (l) => onUnlinkItems({ subjectKey: key, itemId: t.id, kind: "technique" }, l) : undefined}
                    onJumpLink={jumpToLink}
                    selectable={compareMode}
                    selected={compareSelection.some((c) => c.subjectKey === key && c.id === t.id)}
                    onSelectToggle={() => toggleCompareSelection(key, group.displayName, t)}
                  />
                )
              )}
            {open && group.kind === "definition" &&
              group.items.map((d) =>
                wrapSelectable(
                  key,
                  d.id,
                  <DefinitionCard
                    key={d.id}
                    definition={d}
                    saved={true}
                    onToggle={() => onToggleSave("definition", group.displayName, { definition: d })}
                    onTagsChange={onUpdateTags ? (tags) => onUpdateTags(key, d.id, "definition", tags) : undefined}
                    onNoteChange={onUpdateNote ? (note) => onUpdateNote(key, d.id, "definition", note) : undefined}
                    onImagesChange={onUpdateImages ? (images) => onUpdateImages(key, d.id, "definition", images) : undefined}
                    onSearchRelated={onSearchRelated ? (term) => onSearchRelated("definition", term) : undefined}
                    links={resolveLinks(saved, d.links)}
                    onOpenLinkPicker={onLinkItems ? () => openLinkPicker(key, d.id, "definition") : undefined}
                    onRemoveLink={onUnlinkItems ? (l) => onUnlinkItems({ subjectKey: key, itemId: d.id, kind: "definition" }, l) : undefined}
                    onJumpLink={jumpToLink}
                  />
                )
              )}
            {open && group.kind === "list" &&
              group.items.map((it, i) =>
                wrapSelectable(
                  key,
                  it.id,
                  <ListItemCard
                    key={it.id}
                    index={i}
                    subjectDisplay={group.displayName}
                    item={it}
                    saved={true}
                    onToggle={() => onToggleSave("list", group.displayName, { item: it })}
                    onTagsChange={onUpdateTags ? (tags) => onUpdateTags(key, it.id, "list", tags) : undefined}
                    onNoteChange={onUpdateNote ? (note) => onUpdateNote(key, it.id, "list", note) : undefined}
                    onImagesChange={onUpdateImages ? (images) => onUpdateImages(key, it.id, "list", images) : undefined}
                    links={resolveLinks(saved, it.links)}
                    onOpenLinkPicker={onLinkItems ? () => openLinkPicker(key, it.id, "list") : undefined}
                    onRemoveLink={onUnlinkItems ? (l) => onUnlinkItems({ subjectKey: key, itemId: it.id, kind: "list" }, l) : undefined}
                    onJumpLink={jumpToLink}
                  />
                )
              )}
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
              borderRadius: "999px",
              padding: "6px 8px 6px 14px",
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
                borderRadius: "999px",
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
                borderRadius: "999px",
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
                  borderRadius: "999px",
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
            <button
              onClick={applyBulkDelete}
              disabled={bulkSelection.length === 0}
              style={{
                background: "var(--danger)",
                color: "#fff",
                border: "none",
                borderRadius: "999px",
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
                borderRadius: "999px",
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

      {linkPickerFor && (
        <LinkPicker
          items={linkableItemsFor(linkPickerFor)}
          onPick={pickLinkTarget}
          onClose={() => setLinkPickerFor(null)}
        />
      )}
    </>
  );

  function linkableItemsFor(ref) {
    const group = saved[ref.subjectKey];
    const list = group ? (group.kind === "definition" || group.kind === "list" ? group.items : group.techniques) : [];
    const current = list.find((it) => it.id === ref.itemId);
    const alreadyLinked = new Set((current?.links || []).map((l) => `${l.subjectKey}:${l.itemId}`));
    return listAllItems(saved).filter(
      (it) => !(it.subjectKey === ref.subjectKey && it.itemId === ref.itemId) && !alreadyLinked.has(`${it.subjectKey}:${it.itemId}`)
    );
  }
}
