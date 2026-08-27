import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Library, Search, X, Download, Trash2 } from "lucide-react";
import { COLORS, slug } from "../theme";
import { getJSON, KEYS } from "../lib/storage";
import { useDebouncedValue } from "../lib/hooks";
import TechCard from "../components/TechCard";
import DefinitionCard from "../components/DefinitionCard";
import ListItemCard from "../components/ListItemCard";
import PlantCard from "../components/PlantCard";
import CollectionPicker from "../components/CollectionPicker";
import DexFilterBar from "../components/DexFilterBar";
import { CompareBanner, CompareBar, SelectBar } from "../components/DexSelectionToolbar";
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
    updateItemAspect: onUpdateItemAspect,
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

  /**
   * Índice `"${subjectKey}:${itemId}" → texto normalizado` de tudo que a
   * busca da Pokédex olha (nome, texto livre, guia inteiro quando é técnica).
   * Antes isso era recalculado a cada tecla digitada, para TODO item — com um
   * acervo grande isso trava a digitação. Agora só recalcula quando os dados
   * mudam (`saved`/`detailCache`), e o filtro em si é uma leitura de mapa.
   */
  const searchIndex = useMemo(() => {
    const idx = new Map();
    for (const [key, group] of activeEntries) {
      for (const it of group.items) {
        const kind = itemKind(it, group);
        const parts = [itemLabel(it), itemFreeText(it)];
        if (kind === "technique") parts.push(guideText(group.displayName, it));
        idx.set(`${key}:${it.id}`, slug(parts.filter(Boolean).join(" ")));
      }
    }
    return idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntries, detailCache]);

  const debouncedFilterText = useDebouncedValue(filterText, 200);

  function filterEntries(list) {
    const q = slug(debouncedFilterText.trim());
    return list
      .map(([key, group]) => {
        const subjectMatches = !q || slug(group.displayName).includes(q);
        const finalItems = group.items.filter((it) => {
          if (!showArchived && it.archived) return false;
          if (showArchived && !it.archived) return false;
          if (activeTag && !(it.tags || []).includes(activeTag)) return false;
          if (!q || subjectMatches) return true;
          return (searchIndex.get(`${key}:${it.id}`) || "").includes(q);
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

      {compareMode && <CompareBanner count={compareSelection.length} max={MAX_COMPARE} />}

      <DexFilterBar
        filterText={filterText}
        onFilterTextChange={setFilterText}
        allTags={allTags}
        activeTag={activeTag}
        onToggleTag={(tag) => setActiveTag((t) => (t === tag ? null : tag))}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        category={category}
        showArchived={showArchived}
        onToggleShowArchived={onToggleShowArchived}
        compareMode={compareMode}
        onToggleCompare={() => {
          exitSelectMode();
          compareMode ? exitCompareMode() : setCompareMode(true);
        }}
        selectMode={selectMode}
        onToggleSelect={() => {
          exitCompareMode();
          selectMode ? exitSelectMode() : setSelectMode(true);
        }}
        canCompare={!!onOpenCompare}
        canBulkSelect={!!onBulkRemoveItems}
      />

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
                  onAspectGenerated: (aspectId, text) => onUpdateItemAspect(key, item.id, aspectId, text),
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
        <CompareBar count={compareSelection.length} onLaunch={launchCompare} onCancel={exitCompareMode} />
      )}

      {selectMode && (
        <SelectBar
          count={bulkSelection.length}
          tagDraft={bulkTagDraft}
          onTagDraftChange={setBulkTagDraft}
          onApplyTag={applyBulkTag}
          onPickCollection={() => setPickingCollection(true)}
          canAddToCollection={!!onAddToCollection}
          onArchive={applyBulkArchive}
          canArchive={!!onArchiveItems}
          showArchived={showArchived}
          onDelete={applyBulkDelete}
          confirmingDelete={confirmingBulkDelete}
          onCancel={exitSelectMode}
        />
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
