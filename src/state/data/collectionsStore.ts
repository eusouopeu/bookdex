import { useMemo, useState } from "react";
import { KEYS } from "../../lib/storage";
import { createCollectionId, type CollectionRef, type CollectionsState } from "../../lib/collections";
import { persist } from "./persist";

export interface CollectionsContextValue {
  collections: CollectionsState;
  createCollection: (name: string) => string | null;
  deleteCollection: (id: string) => void;
  addToCollection: (collectionId: string | null | undefined, refs: CollectionRef[], newName?: string) => void;
  removeFromCollection: (collectionId: string, ref: CollectionRef) => void;
}

type ShowToast = (msg: string, onUndo?: () => void) => void;

/** Coleções: listas nomeadas de referências (assunto + id) a itens da Pokédex. */
export function useCollectionsStore(showToast: ShowToast) {
  const [collections, setCollections] = useState<CollectionsState>({});

  const value = useMemo<CollectionsContextValue>(
    () => ({
      collections,
      createCollection(name: string) {
        const clean = (name || "").trim();
        if (!clean) return null;
        const id = createCollectionId();
        setCollections((prev) => {
          const next = { ...prev, [id]: { id, name: clean, createdAt: Date.now(), refs: [] } };
          persist(KEYS.collections, next);
          return next;
        });
        showToast(`Coleção "${clean}" criada.`);
        return id;
      },
      deleteCollection(id: string) {
        setCollections((prev) => {
          const col = prev[id];
          if (!col) return prev;
          const next = { ...prev };
          delete next[id];
          persist(KEYS.collections, next);
          showToast(`Coleção "${col.name}" excluída.`);
          return next;
        });
      },
      addToCollection(collectionId, refs, newName) {
        setCollections((prev) => {
          let id = collectionId;
          let next = prev;
          if (!id) {
            const clean = (newName || "").trim();
            if (!clean) return prev;
            id = createCollectionId();
            next = { ...prev, [id]: { id, name: clean, createdAt: Date.now(), refs: [] } };
          }
          const col = next[id];
          if (!col) return prev;
          const existingKeys = new Set(col.refs.map((r) => `${r.subjectKey}:${r.itemId}`));
          const merged = [...col.refs];
          for (const r of refs) {
            const k = `${r.subjectKey}:${r.itemId}`;
            if (!existingKeys.has(k)) {
              merged.push(r);
              existingKeys.add(k);
            }
          }
          next = { ...next, [id]: { ...col, refs: merged } };
          persist(KEYS.collections, next);
          showToast(`${refs.length} item(ns) adicionado(s) a "${col.name}".`);
          return next;
        });
      },
      removeFromCollection(collectionId, ref) {
        setCollections((prev) => {
          const col = prev[collectionId];
          if (!col) return prev;
          const next = {
            ...prev,
            [collectionId]: {
              ...col,
              refs: col.refs.filter((r) => !(r.subjectKey === ref.subjectKey && r.itemId === ref.itemId)),
            },
          };
          persist(KEYS.collections, next);
          return next;
        });
      },
    }),
    [collections, showToast]
  );

  return { value, setCollections };
}
