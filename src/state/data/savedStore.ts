import { useMemo, useState, type MutableRefObject } from "react";
import { slug } from "../../theme";
import { KEYS } from "../../lib/storage";
import { fetchDetail, fetchItemEnrichment, hasCredentials } from "../../lib/anthropic";
import { findSimilarItem } from "../../lib/dedupe";
import type { CollectionRef } from "../../lib/collections";
import { groupItems, itemKind, itemLabel, withItems, KIND_LABELS, type SavedState, type SavedGroup, type SavedItem } from "../../lib/savedModel";
import { plantGroupKey, plantItemId, plantToItem, defaultCareTask, type CareTaskState } from "../../lib/plants";
import { applyEnrichment, convertItem as convertItemFields } from "../../lib/convert";
import { persist } from "./persist";

export interface SavedContextValue {
  saved: SavedState;
  isSaved: (mode: string, subjectDisplay: string, itemId: string) => boolean;
  isPlantSaved: (plant: any) => boolean;
  toggleSave: (mode: string, subjectDisplay: string, payload: any) => void;
  updateItemAspect: (subjectKey: string, itemId: string, aspectId: string, text: string) => void;
  removeGroup: (key: string) => void;
  bulkRemoveItems: (refs: CollectionRef[]) => void;
  bulkAddTag: (refs: CollectionRef[], tag: string) => void;
  archiveItems: (refs: CollectionRef[], archived: boolean) => void;
  updateItemTags: (subjectKey: string, itemId: string, kind: string | undefined, tags: string[]) => void;
  updateItemNote: (subjectKey: string, itemId: string, kind: string | undefined, note: string) => void;
  updateItemImages: (subjectKey: string, itemId: string, kind: string | undefined, images: unknown) => void;
  updateItemCareTask: (subjectKey: string, itemId: string, taskId: string, patch: Partial<CareTaskState>) => void;
  convertItem: (subjectKey: string, itemId: string, targetKind: string) => void;
  enrichItem: (subjectKey: string, itemId: string) => Promise<SavedItem | null>;
}

type ShowToast = (msg: string, onUndo?: () => void) => void;

interface SavedStoreDeps {
  showToast: ShowToast;
  /** Valor atual do cache de guias — ref pra não re-criar a Pokédex inteira a cada guia que chega. */
  detailCacheRef: MutableRefObject<Record<string, unknown>>;
  prefetchRef: MutableRefObject<boolean>;
  cacheDetail: (cacheKey: string, detail: unknown) => void;
}

/** Aplica `mutate` a cada item referenciado, devolvendo o novo `saved`. */
function mapRefs(base: SavedState, refs: CollectionRef[], mutate: (item: SavedItem, group: SavedGroup) => SavedItem | null) {
  let next = base;
  for (const { subjectKey, itemId } of refs) {
    const group = next[subjectKey];
    if (!group) continue;
    const list = groupItems(group);
    const idx = list.findIndex((it) => it.id === itemId);
    if (idx === -1) continue;
    const nextList = [...list];
    const mutated = mutate(nextList[idx], group);
    if (mutated === null) nextList.splice(idx, 1);
    else nextList[idx] = mutated;
    if (nextList.length === 0) {
      next = { ...next };
      delete next[subjectKey];
    } else {
      next = { ...next, [subjectKey]: withItems(group, nextList) };
    }
  }
  return next;
}

/**
 * Pokédex: itens capturados (técnicas, conceitos, tipos, plantas) agrupados
 * por assunto, e todas as operações que os alteram.
 */
export function useSavedStore({ showToast, detailCacheRef, prefetchRef, cacheDetail }: SavedStoreDeps) {
  const [saved, setSaved] = useState<SavedState>({});

  const value = useMemo<SavedContextValue>(() => {
    function commitSaved(next: SavedState, message?: string, prevSaved?: SavedState) {
      setSaved(next);
      persist(KEYS.saved, next);
      if (!message) return;
      showToast(
        message,
        prevSaved
          ? () => {
              setSaved(prevSaved);
              persist(KEYS.saved, prevSaved);
            }
          : undefined
      );
    }

    /** Baixa o guia em background assim que uma técnica é capturada. */
    async function prefetchDetail(subjectDisplay: string, technique: any) {
      if (!prefetchRef.current) return;
      const cacheKey = `${slug(subjectDisplay)}:${technique.id}`;
      if (detailCacheRef.current[cacheKey]) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (!(await hasCredentials())) return;
      try {
        cacheDetail(cacheKey, await fetchDetail(subjectDisplay, technique));
      } catch {
        /* best-effort — dá pra abrir "Aprofundar" manualmente depois */
      }
    }

    function captureMessage(name: string, prevSaved: SavedState) {
      const dup = findSimilarItem(prevSaved, name);
      return dup ? `${name} capturado(a)! Você já tem algo parecido: "${dup.name}" em "${dup.subjectDisplay}".` : `${name} capturado(a)!`;
    }

    function toggleTechniqueSave(subjectDisplay: string, technique: any, statLabels: any) {
      const prevSaved = saved;
      const subjectKey = slug(subjectDisplay);
      const techId = technique.id || slug(technique.name);
      const next = { ...saved };
      const existing = next[subjectKey];
      const items = existing ? [...groupItems(existing)] : [];
      const displayName = existing?.displayName || subjectDisplay;

      const idx = items.findIndex((t) => t.id === techId && itemKind(t, existing) === "technique");
      const removed = idx >= 0;
      if (removed) {
        items.splice(idx, 1);
      } else {
        items.push({
          id: techId,
          kind: "technique",
          name: technique.name,
          type: technique.type,
          description: technique.description,
          bestFor: technique.bestFor,
          stats: technique.stats,
          statLabels,
          savedAt: Date.now(),
          tags: [],
          note: "",
        });
      }

      if (items.length === 0) delete next[subjectKey];
      else next[subjectKey] = withItems({ displayName }, items);

      if (removed) {
        commitSaved(next, `${technique.name} solto(a) da Pokédex.`, prevSaved);
        return;
      }
      commitSaved(next, captureMessage(technique.name, prevSaved));
      prefetchDetail(subjectDisplay, { ...technique, id: techId });
    }

    function toggleKnowledgeSave(mode: string, subjectDisplay: string, payload: any) {
      const prevSaved = saved;
      const subjectKey = slug(subjectDisplay);
      const next = { ...saved };
      const existing = next[subjectKey];
      const items = existing ? [...groupItems(existing)] : [];
      const displayName = existing?.displayName || subjectDisplay;

      let itemId;
      let itemName;
      let itemObj;
      if (mode === "definition") {
        const d = payload.definition;
        itemId = slug(d.term);
        itemName = d.term;
        itemObj = {
          id: itemId,
          kind: "definition",
          term: d.term,
          category: d.category,
          definition: d.definition,
          keyPoints: d.keyPoints || [],
          example: d.example || "",
          relatedTerms: d.relatedTerms || [],
          savedAt: Date.now(),
          tags: [],
          note: "",
        };
      } else {
        const it = payload.item;
        itemId = slug(it.name);
        itemName = it.name;
        itemObj = {
          id: itemId,
          kind: "list",
          name: it.name,
          category: it.category,
          description: it.description,
          savedAt: Date.now(),
          tags: [],
          note: "",
        };
      }

      const idx = items.findIndex((x) => x.id === itemId && itemKind(x, existing) === mode);
      const removed = idx >= 0;
      if (removed) items.splice(idx, 1);
      else items.push(itemObj);

      if (items.length === 0) delete next[subjectKey];
      else next[subjectKey] = withItems({ displayName }, items);

      if (removed) {
        commitSaved(next, `${itemName} solto(a) da Pokédex.`, prevSaved);
        return;
      }
      commitSaved(next, captureMessage(itemName, prevSaved));
    }

    /**
     * Captura/solta uma planta. Diferente dos outros tipos, o "assunto" não vem
     * de uma busca: é a família botânica (ver lib/plants.ts), o que agrupa as
     * plantas capturadas por parentesco sem o usuário ter que decidir nada.
     */
    function togglePlantSave(plant: any) {
      const prevSaved = saved;
      const subjectKey = plantGroupKey(plant);
      const itemId = plantItemId(plant);
      const displayName = plant.family || "Plantas";
      const next = { ...saved };
      const existing = next[subjectKey];
      const items = existing ? [...groupItems(existing)] : [];

      const idx = items.findIndex((it) => it.id === itemId && itemKind(it, existing) === "plant");
      const removed = idx >= 0;
      if (removed) items.splice(idx, 1);
      else items.push(plantToItem(plant, itemId));

      if (items.length === 0) delete next[subjectKey];
      else next[subjectKey] = withItems({ displayName: existing?.displayName || displayName }, items);

      const label = itemLabel({ ...plant, kind: "plant" });
      commitSaved(next, removed ? `${label} solta da Pokédex.` : `${label} capturada!`, prevSaved);
    }

    function updateItemInGroup(subjectKey: string, itemId: string, mutate: (item: SavedItem, group: SavedGroup) => SavedItem | null) {
      setSaved((prev) => {
        const next = mapRefs(prev, [{ subjectKey, itemId }], mutate);
        if (next === prev) return prev;
        persist(KEYS.saved, next);
        return next;
      });
    }

    return {
      saved,
      isSaved(mode, subjectDisplay, itemId) {
        const group = saved[slug(subjectDisplay)];
        return groupItems(group).some((it) => it.id === itemId && itemKind(it, group) === mode);
      },
      isPlantSaved(plant) {
        const group = saved[plantGroupKey(plant)];
        const id = plantItemId(plant);
        return groupItems(group).some((it) => it.id === id && itemKind(it, group) === "plant");
      },
      toggleSave(mode, subjectDisplay, payload) {
        if (mode === "technique") toggleTechniqueSave(subjectDisplay, payload.technique, payload.statLabels);
        else if (mode === "plant") togglePlantSave(payload.plant);
        else toggleKnowledgeSave(mode, subjectDisplay, payload);
      },
      /**
       * Guarda o texto de UM aspecto gerado sob demanda num card. O campo é o
       * mesmo (`aspects`) em qualquer `kind`, então uma função só cobre todos.
       */
      updateItemAspect: (subjectKey, itemId, aspectId, text) =>
        updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, aspects: { ...(item.aspects || {}), [aspectId]: text } })),
      removeGroup(key) {
        const group = saved[key];
        if (!group) return;
        const next = { ...saved };
        delete next[key];
        commitSaved(next, `"${group.displayName}" removido(a) da Pokédex.`, saved);
      },
      bulkRemoveItems(refs) {
        commitSaved(mapRefs(saved, refs, () => null), `${refs.length} item(ns) removido(s) da Pokédex.`, saved);
      },
      bulkAddTag(refs, tag) {
        const clean = (tag || "").trim();
        if (!clean) return;
        const next = mapRefs(saved, refs, (item) => ((item.tags || []).includes(clean) ? item : { ...item, tags: [...(item.tags || []), clean] }));
        commitSaved(next, `Tag "${clean}" aplicada a ${refs.length} item(ns).`);
      },
      archiveItems(refs, archived) {
        const next = mapRefs(saved, refs, (item) => ({ ...item, archived }));
        commitSaved(next, archived ? `${refs.length} item(ns) arquivado(s).` : `${refs.length} item(ns) desarquivado(s).`, saved);
      },
      updateItemTags: (subjectKey, itemId, _kind, tags) => updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, tags })),
      updateItemNote: (subjectKey, itemId, _kind, note) => updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, note })),
      updateItemImages: (subjectKey, itemId, _kind, images) => updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, images })),
      /** Atualiza UMA tarefa do cronograma de cuidados (água/fertilizar) de uma planta salva. */
      updateItemCareTask: (subjectKey, itemId, taskId, patch) =>
        updateItemInGroup(subjectKey, itemId, (item) => ({
          ...item,
          care: { ...((item as any).care || {}), [taskId]: { ...defaultCareTask(taskId), ...((item as any).care?.[taskId] || {}), ...patch } },
        })),
      /**
       * Converte um card entre técnica/conceito/tipo. Local e instantâneo: o
       * item fica no mesmo assunto com o mesmo id, então refs de coleção seguem
       * válidas. O que a conversão não sabe preencher fica pro `enrichItem`.
       */
      convertItem(subjectKey, itemId, targetKind) {
        const group = saved[subjectKey];
        const current = groupItems(group).find((it) => it.id === itemId);
        if (!current) return;
        const from = itemKind(current, group);
        if (from === targetKind) return;
        const next = mapRefs(saved, [{ subjectKey, itemId }], (item) => convertItemFields({ ...item, kind: from }, targetKind));
        commitSaved(next, `"${itemLabel(current)}" virou ${(KIND_LABELS[targetKind] || targetKind).toLowerCase()}.`, saved);
      },
      /** Completa com a API os campos que ficaram em branco na conversão. Erros sobem pra quem chamou. */
      async enrichItem(subjectKey, itemId) {
        const group = saved[subjectKey];
        const current = groupItems(group).find((it) => it.id === itemId);
        if (!current) return null;
        const kind = itemKind(current, group);
        const data = await fetchItemEnrichment(kind, group.displayName, current);
        const enriched = applyEnrichment({ ...current, kind }, data);
        updateItemInGroup(subjectKey, itemId, () => enriched);
        return enriched;
      },
    };
  }, [saved, showToast, cacheDetail, detailCacheRef, prefetchRef]);

  return { value, setSaved };
}
