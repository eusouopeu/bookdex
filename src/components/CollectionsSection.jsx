import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  QrCode,
  Share2,
  Trash2,
  X,
  Search,
  Tag,
  ArrowDownAZ,
  Clock,
  } from "lucide-react";
import { COLORS, slug } from "../theme";
import { resolveCollectionItems, refKey } from "../lib/collections";
import { buildCollectionExportPayload } from "../lib/importer";
import { shareOrDownloadFile } from "../lib/share";
import { fitsInQr, generateQrDataUrl } from "../lib/qr";
import TechCard from "./TechCard";
import DefinitionCard from "./DefinitionCard";
import ListItemCard from "./ListItemCard";
import QRCodeModal from "./QRCodeModal";
import GoalSuggestions from "./GoalSuggestions";

const CONFIRM_THRESHOLD = 3;

/**
 * Aba "Coleções" dentro da Pokédex: pastas manuais que cruzam itens de
 * assuntos diferentes (ver lib/collections.js). Itens entram via seleção em
 * lote no DexView; aqui só se visualiza, remove da coleção ou apaga a
 * coleção inteira.
 */
export default function CollectionsSection({
  collections,
  saved,
  detailCache,
  onCreateCollection,
  onDeleteCollection,
  onRemoveFromCollection,
  onAddToCollection,
  onToggleSave,
  onOpenDetail,
  hasDetail,
  onUpdateTags,
  onUpdateNote,
  onUpdateImages,
  onSearchRelated,
}) {
  const [collapsed, setCollapsed] = useState({});
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [exportMsg, setExportMsg] = useState(null);
  const [qrModal, setQrModal] = useState(null); // { title, dataUrl }
  const [filterText, setFilterText] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [sortBy, setSortBy] = useState("recent"); // "recent" | "name"

  const list = Object.values(collections || {}).sort((a, b) => b.createdAt - a.createdAt);

  const allResolvedByCollection = useMemo(() => {
    const map = {};
    for (const col of list) map[col.id] = resolveCollectionItems(saved, col.refs);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, saved]);

  const allTags = useMemo(() => {
    const set = new Set();
    for (const items of Object.values(allResolvedByCollection)) {
      for (const { item } of items) for (const t of item.tags || []) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allResolvedByCollection]);

  function filterAndSort(resolvedItems) {
    const q = slug(filterText.trim());
    const filtered = resolvedItems.filter(({ item }) => {
      if (activeTag && !(item.tags || []).includes(activeTag)) return false;
      if (!q) return true;
      const label = slug(item.term || item.name || "");
      const extra = slug([item.note, item.description, item.definition].filter(Boolean).join(" "));
      return label.includes(q) || extra.includes(q);
    });
    const copy = [...filtered];
    if (sortBy === "name") {
      copy.sort((a, b) => (a.item.term || a.item.name || "").localeCompare(b.item.term || b.item.name || "", "pt-BR"));
    } else {
      copy.sort((a, b) => (b.item.savedAt || 0) - (a.item.savedAt || 0));
    }
    return copy;
  }

  async function exportCollection(col) {
    const payload = buildCollectionExportPayload(col.id, col, saved, detailCache);
    const fileName = `bookdex-colecao-${slug(col.name)}.json`;
    const outcome = await shareOrDownloadFile(fileName, JSON.stringify(payload, null, 2), "application/json", `Bookdex — ${col.name}`);
    setExportMsg(outcome === "shared" ? `"${col.name}" compartilhada.` : `"${col.name}" exportada — envie o arquivo pra quem quiser importar.`);
    setTimeout(() => setExportMsg((m) => (m ? null : m)), 3200);
  }

  async function addGoalSuggestion(col, suggestion) {
    const item = { name: suggestion.name, category: "Sugestão", description: suggestion.description };
    onToggleSave("list", col.name, { item });
    onAddToCollection(col.id, [{ subjectKey: `kn:${slug(col.name)}`, itemId: slug(suggestion.name) }]);
  }

  async function showCollectionQr(col) {
    const payload = buildCollectionExportPayload(col.id, col, saved, detailCache);
    const text = JSON.stringify(payload);
    if (!fitsInQr(text)) {
      setExportMsg(`"${col.name}" tem itens demais pra caber num QR code — use o botão de compartilhar acima.`);
      setTimeout(() => setExportMsg((m) => (m ? null : m)), 3600);
      return;
    }
    const dataUrl = await generateQrDataUrl(text);
    setQrModal({ title: col.name, dataUrl });
  }

  function submitNew() {
    const clean = name.trim();
    if (!clean) return;
    onCreateCollection(clean);
    setName("");
    setCreating(false);
  }

  function requestDelete(id, count) {
    if (count <= CONFIRM_THRESHOLD || confirmingDelete === id) {
      onDeleteCollection(id);
      setConfirmingDelete(null);
    } else {
      setConfirmingDelete(id);
    }
  }

  function renderCard(collectionId, resolved) {
    const { ref, group, item, kind } = resolved;
    let card;
    if (kind === "definition") {
      card = (
        <DefinitionCard
          definition={item}
          saved={true}
          onToggle={() => onToggleSave("definition", group.displayName, { definition: item })}
          onTagsChange={onUpdateTags ? (tags) => onUpdateTags(ref.subjectKey, item.id, "definition", tags) : undefined}
          onSearchRelated={onSearchRelated ? (term) => onSearchRelated("definition", term) : undefined}
          onNoteChange={onUpdateNote ? (note) => onUpdateNote(ref.subjectKey, item.id, "definition", note) : undefined}
          onImagesChange={onUpdateImages ? (images) => onUpdateImages(ref.subjectKey, item.id, "definition", images) : undefined}
        />
      );
    } else if (kind === "list") {
      card = (
        <ListItemCard
          index={0}
          subjectDisplay={group.displayName}
          item={item}
          saved={true}
          onToggle={() => onToggleSave("list", group.displayName, { item })}
          onTagsChange={onUpdateTags ? (tags) => onUpdateTags(ref.subjectKey, item.id, "list", tags) : undefined}
          onNoteChange={onUpdateNote ? (note) => onUpdateNote(ref.subjectKey, item.id, "list", note) : undefined}
          onImagesChange={onUpdateImages ? (images) => onUpdateImages(ref.subjectKey, item.id, "list", images) : undefined}
        />
      );
    } else {
      card = (
        <TechCard
          index={0}
          subjectDisplay={group.displayName}
          technique={item}
          statLabels={item.statLabels || []}
          saved={true}
          onToggle={() => onToggleSave("technique", group.displayName, { technique: item, statLabels: item.statLabels })}
          onOpenDetail={onOpenDetail ? () => onOpenDetail(group.displayName, item) : undefined}
          hasDetail={hasDetail ? hasDetail(group.displayName, item) : false}
          onTagsChange={onUpdateTags ? (tags) => onUpdateTags(ref.subjectKey, item.id, "technique", tags) : undefined}
          onNoteChange={onUpdateNote ? (note) => onUpdateNote(ref.subjectKey, item.id, "technique", note) : undefined}
          onImagesChange={onUpdateImages ? (images) => onUpdateImages(ref.subjectKey, item.id, "technique", images) : undefined}
        />
      );
    }
    return (
      <div key={refKey(ref)} style={{ marginBottom: "10px" }}>
        {card}
        <button
          onClick={() => onRemoveFromCollection(collectionId, ref)}
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            color: "var(--text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 4px",
            marginTop: "-4px",
          }}
        >
          Remover desta coleção
        </button>
      </div>
    );
  }

  return (
    <div>
      {exportMsg && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "10px" }}>
          {exportMsg}
        </p>
      )}
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center justify-center gap-1.5"
          style={{
            width: "100%",
            minHeight: "40px",
            background: "transparent",
            border: `2px dashed ${COLORS.screenBorder}`,
            borderRadius: "8px",
            color: COLORS.ink,
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "12px",
            cursor: "pointer",
            marginBottom: "14px",
          }}
        >
          <FolderPlus size={15} /> Nova coleção
        </button>
      ) : (
        <div className="flex gap-2" style={{ marginBottom: "14px" }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") {
                setCreating(false);
                setName("");
              }
            }}
            placeholder="Nome da coleção"
            style={{
              flex: 1,
              borderRadius: "8px",
              border: `2px solid ${COLORS.screenBorder}`,
              padding: "9px 12px",
              minHeight: "38px",
              fontFamily: "Inter, sans-serif",
              fontSize: "12.5px",
              background: COLORS.surface,
              color: COLORS.ink,
              outline: "none",
            }}
          />
          <button
            onClick={submitNew}
            disabled={!name.trim()}
            style={{
              background: COLORS.lensBlue,
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "0 14px",
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
              opacity: name.trim() ? 1 : 0.5,
              flexShrink: 0,
            }}
          >
            Criar
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setName("");
            }}
            aria-label="Cancelar"
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {list.length > 0 && (
        <>
          <div className="flex items-center gap-2" style={{ marginBottom: "10px", position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "11px", color: COLORS.screenBorder, pointerEvents: "none" }} />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Buscar dentro das coleções..."
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
          </div>
        </>
      )}

      {list.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "220px", color: COLORS.screenBorder }}>
          <Folder size={32} strokeWidth={1.5} style={{ marginBottom: "10px" }} />
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", maxWidth: "230px" }}>
            Crie coleções para juntar itens de assuntos diferentes — ex.: "prova de sexta". Adicione itens usando o
            modo de seleção (ícone de check) nas abas Técnicas ou Conceitos &amp; Tipos.
          </p>
        </div>
      )}

      {list.map((col) => {
        const resolvedItems = allResolvedByCollection[col.id] || [];
        const visibleItems = filterAndSort(resolvedItems);
        const open = !collapsed[col.id];
        const confirming = confirmingDelete === col.id;
        return (
          <div key={col.id} style={{ marginBottom: "18px" }}>
            <div className="flex items-center gap-1.5" style={{ borderBottom: `2px solid ${COLORS.screenBorder}`, marginBottom: "9px" }}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [col.id]: !c[col.id] }))}
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
                  {col.name}{" "}
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", fontWeight: 400 }}>
                    ({resolvedItems.length})
                  </span>
                </h3>
              </button>
              {!confirming && resolvedItems.length > 0 && (
                <>
                  <button
                    onClick={() => showCollectionQr(col)}
                    aria-label={`Mostrar QR code da coleção "${col.name}"`}
                    title="Sincronizar por QR code"
                    style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "9px 4px", flexShrink: 0 }}
                  >
                    <QrCode size={15} />
                  </button>
                  <button
                    onClick={() => exportCollection(col)}
                    aria-label={`Compartilhar coleção "${col.name}"`}
                    title="Compartilhar/exportar coleção"
                    style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "9px 4px", flexShrink: 0 }}
                  >
                    <Share2 size={15} />
                  </button>
                </>
              )}
              {confirming ? (
                <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--danger)", whiteSpace: "nowrap" }}>
                    Excluir coleção?
                  </span>
                  <button
                    onClick={() => requestDelete(col.id, resolvedItems.length)}
                    aria-label={`Confirmar exclusão de "${col.name}"`}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "9px 4px" }}
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(null)}
                    aria-label="Cancelar exclusão"
                    style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "9px 4px" }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => requestDelete(col.id, resolvedItems.length)}
                  aria-label={`Excluir coleção "${col.name}"`}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "9px 4px", flexShrink: 0 }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            {open && resolvedItems.length === 0 && (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
                Coleção vazia. Use o modo de seleção na Pokédex para adicionar itens.
              </p>
            )}
            {open && resolvedItems.length > 0 && visibleItems.length === 0 && (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
                Nada nesta coleção corresponde ao filtro atual.
              </p>
            )}
            {open && onAddToCollection && (
              <GoalSuggestions
                areaName={col.name}
                existingItemNames={resolvedItems.map((r) => r.item.term || r.item.name)}
                onAddSuggestion={(suggestion) => addGoalSuggestion(col, suggestion)}
              />
            )}
            {open && visibleItems.map((r) => renderCard(col.id, r))}
          </div>
        );
      })}

      {qrModal && <QRCodeModal title={qrModal.title} dataUrl={qrModal.dataUrl} onClose={() => setQrModal(null)} />}
    </div>
  );
}
