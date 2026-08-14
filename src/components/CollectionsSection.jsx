import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderPlus, Trash2, X } from "lucide-react";
import { COLORS } from "../theme";
import { resolveCollectionItems, refKey } from "../lib/collections";
import TechCard from "./TechCard";
import DefinitionCard from "./DefinitionCard";
import ListItemCard from "./ListItemCard";

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
  onCreateCollection,
  onDeleteCollection,
  onRemoveFromCollection,
  onToggleSave,
  onOpenDetail,
  onUpdateTags,
  onUpdateNote,
  onSearchRelated,
}) {
  const [collapsed, setCollapsed] = useState({});
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(null);

  const list = Object.values(collections || {}).sort((a, b) => b.createdAt - a.createdAt);

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
          onTagsChange={onUpdateTags ? (tags) => onUpdateTags(ref.subjectKey, item.id, "technique", tags) : undefined}
          onNoteChange={onUpdateNote ? (note) => onUpdateNote(ref.subjectKey, item.id, "technique", note) : undefined}
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
        const resolvedItems = resolveCollectionItems(saved, col.refs);
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
            {open && resolvedItems.map((r) => renderCard(col.id, r))}
          </div>
        );
      })}
    </div>
  );
}
