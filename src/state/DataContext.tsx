import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { slug } from "../theme";
import { getJSON, setJSON, KEYS } from "../lib/storage";
import { fetchDetail, fetchItemEnrichment, hasCredentials } from "../lib/anthropic";
import { mergeData, mergeCollections, mergeWords } from "../lib/importer";
import { findSimilarItem } from "../lib/dedupe";
import { createCollectionId, type CollectionRef, type CollectionsState } from "../lib/collections";
import { wordLangKey, wordItemId, type WordsState } from "../lib/words";
import { CURRENT_SCHEMA_VERSION, runMigrations } from "../lib/migrations";
import {
  groupItems,
  itemKind,
  itemLabel,
  withItems,
  categoryOfKind,
  KIND_LABELS,
  type SavedState,
  type SavedGroup,
  type SavedItem,
} from "../lib/savedModel";
import { plantGroupKey, plantItemId, plantToItem } from "../lib/plants";
import { applyEnrichment, convertItem as convertItemFields } from "../lib/convert";
import { scheduleMdMirror } from "../lib/autoMdMirror";
import { MODELS } from "../lib/models";

/** Uma versão anterior de um guia, guardada quando ele é regenerado (ver `cacheDetail`). */
export interface DetailVersion {
  detail: unknown;
  model: string;
  generatedAt: number;
}

const MAX_DETAIL_VERSIONS = 5;

/**
 * Fonte única dos dados capturados (Pokédex, guias, palavras e coleções) e de
 * todas as operações que os alteram. Antes isso vivia no App.jsx e descia por
 * ~40 props até as views; agora cada view puxa o que precisa com `useData()`.
 *
 * Também é aqui que o schema persistido é migrado, uma vez por abertura, antes
 * de qualquer render depender do formato dos dados (ver lib/migrations.js).
 */
interface ToastState {
  msg: string;
  onUndo?: () => void;
}

export interface DataContextValue {
  saved: SavedState;
  detailCache: Record<string, unknown>;
  detailHistory: Record<string, DetailVersion[]>;
  words: WordsState;
  collections: CollectionsState;
  storageLoaded: boolean;
  counts: {
    total: number;
    techniques: number;
    knowledge: number;
    plants: number;
    subjects: number;
    collections: number;
    words: number;
  };
  prefetchDetailsEnabled: boolean;
  changePrefetchDetails: (enabled: boolean) => void;
  toast: ToastState | null;
  showToast: (msg: string, onUndo?: () => void) => void;
  dismissToast: () => void;
  hasDetail: (subjectDisplay: string, technique: any) => boolean;
  cacheDetail: (cacheKey: string, detail: unknown) => void;
  deleteDetail: (cacheKey: string) => void;
  restoreDetailVersion: (cacheKey: string, versionIndex: number) => void;
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
  convertItem: (subjectKey: string, itemId: string, targetKind: string) => void;
  enrichItem: (subjectKey: string, itemId: string) => Promise<SavedItem | null>;
  isWordSaved: (languageCode: string | undefined, language: string, word: string) => boolean;
  toggleWordSave: (data: any) => void;
  removeWordGroup: (langKey: string) => void;
  updateWordTags: (langKey: string, wordId: string, tags: string[]) => void;
  updateWordNote: (langKey: string, wordId: string, note: string) => void;
  createCollection: (name: string) => string | null;
  deleteCollection: (id: string) => void;
  addToCollection: (collectionId: string | null | undefined, refs: CollectionRef[], newName?: string) => void;
  removeFromCollection: (collectionId: string, ref: CollectionRef) => void;
  applyImport: (payload: any) => any;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData() precisa estar dentro de <DataProvider>");
  return ctx;
}

function activeItems(group: SavedGroup | undefined) {
  return groupItems(group).filter((it) => !it.archived);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedState>({});
  const [detailCache, setDetailCache] = useState<Record<string, unknown>>({});
  const [detailHistory, setDetailHistory] = useState<Record<string, DetailVersion[]>>({});
  const [words, setWords] = useState<WordsState>({});
  const [collections, setCollections] = useState<CollectionsState>({});
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Preferência "baixar guias em background" — mora aqui porque só o prefetch
  // dentro deste provider a consome, e a tela de Configurações só a alterna.
  const [prefetchDetailsEnabled, setPrefetchDetailsEnabled] = useState(true);
  const prefetchRef = useRef(true);
  useEffect(() => {
    prefetchRef.current = prefetchDetailsEnabled;
  }, [prefetchDetailsEnabled]);

  function changePrefetchDetails(enabled: boolean) {
    setPrefetchDetailsEnabled(enabled);
    persist(KEYS.prefetchDetails, enabled);
  }

  // Espelho automático em .md na pasta Documentos (Android) — ver
  // lib/autoMdMirror.ts. Só depois de `storageLoaded` pra não escrever no
  // boot com dados ainda vazios/pré-migração.
  useEffect(() => {
    if (!storageLoaded) return;
    scheduleMdMirror(saved, detailCache);
  }, [storageLoaded, saved, detailCache]);

  useEffect(() => {
    (async () => {
      const loaded = {
        saved: await getJSON(KEYS.saved, {}),
        detailCache: await getJSON(KEYS.details, {}),
        words: await getJSON(KEYS.words, {}),
        collections: await getJSON(KEYS.collections, {}),
      };
      setPrefetchDetailsEnabled(await getJSON(KEYS.prefetchDetails, true));
      setDetailHistory(await getJSON(KEYS.detailHistory, {}));
      const version = await getJSON(KEYS.schemaVersion, 0);
      const { data, migrated } = runMigrations(loaded, version);
      setSaved(data.saved);
      setDetailCache(data.detailCache);
      setWords(data.words);
      setCollections(data.collections);
      if (migrated) {
        await Promise.all([
          setJSON(KEYS.saved, data.saved),
          setJSON(KEYS.details, data.detailCache),
          setJSON(KEYS.words, data.words),
          setJSON(KEYS.collections, data.collections),
        ]).catch(() => {});
      }
      await setJSON(KEYS.schemaVersion, CURRENT_SCHEMA_VERSION).catch(() => {});
      setStorageLoaded(true);
    })();
  }, []);

  const showToast = useCallback((msg: string, onUndo?: () => void) => {
    setToast({ msg, onUndo });
    setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), onUndo ? 4000 : 2200);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  function persist(key: string, value: unknown) {
    setJSON(key, value).catch((e) => console.error(`Falha ao gravar ${key}`, e));
  }

  const persistSaved = (next: SavedState) => persist(KEYS.saved, next);
  const persistDetails = (next: Record<string, unknown>) => persist(KEYS.details, next);
  const persistDetailHistory = (next: Record<string, DetailVersion[]>) => persist(KEYS.detailHistory, next);
  const persistWords = (next: WordsState) => persist(KEYS.words, next);
  const persistCollections = (next: CollectionsState) => persist(KEYS.collections, next);

  /* ---------------------------------------------------------------- guias */

  function hasDetail(subjectDisplay: string, technique: any) {
    const techId = technique.id || slug(technique.name);
    return !!detailCache[`${slug(subjectDisplay)}:${techId}`];
  }

  function cacheDetail(cacheKey: string, detail: unknown) {
    setDetailCache((prev) => {
      const next = { ...prev, [cacheKey]: detail };
      persistDetails(next);
      return next;
    });
  }

  /**
   * Remove um guia do cache pra regenerar do zero — em vez de descartar o
   * guia atual, arquiva-o em `detailHistory` (limitado a
   * `MAX_DETAIL_VERSIONS`, o mais antigo cai fora) pra dar pra restaurar ou
   * comparar depois (ver DetailPage). Assume o modelo fixo de guia
   * (`MODELS.sonnet`, ver lib/models.ts) — se isso um dia virar configurável,
   * o modelo real precisa vir de quem chama.
   */
  function deleteDetail(cacheKey: string) {
    const current = detailCache[cacheKey];
    if (current !== undefined) {
      const versions = [...(detailHistory[cacheKey] || []), { detail: current, model: MODELS.sonnet, generatedAt: Date.now() }].slice(-MAX_DETAIL_VERSIONS);
      const nextHistory = { ...detailHistory, [cacheKey]: versions };
      setDetailHistory(nextHistory);
      persistDetailHistory(nextHistory);
    }
    setDetailCache((prev) => {
      if (!(cacheKey in prev)) return prev;
      const next = { ...prev };
      delete next[cacheKey];
      persistDetails(next);
      return next;
    });
  }

  /** Restaura uma versão arquivada como o guia ativo — a que estava ativa vai pro arquivo no lugar dela. */
  function restoreDetailVersion(cacheKey: string, versionIndex: number) {
    const versions = detailHistory[cacheKey] || [];
    const version = versions[versionIndex];
    if (!version) return;

    const rest = versions.filter((_, i) => i !== versionIndex);
    const current = detailCache[cacheKey];
    const nextVersions = current !== undefined ? [...rest, { detail: current, model: MODELS.sonnet, generatedAt: Date.now() }].slice(-MAX_DETAIL_VERSIONS) : rest;
    const nextHistory = { ...detailHistory, [cacheKey]: nextVersions };
    setDetailHistory(nextHistory);
    persistDetailHistory(nextHistory);

    const nextDetails = { ...detailCache, [cacheKey]: version.detail };
    setDetailCache(nextDetails);
    persistDetails(nextDetails);
  }

  /** Baixa o guia em background assim que uma técnica é capturada. */
  async function prefetchDetail(subjectDisplay: string, technique: any) {
    if (!prefetchRef.current) return;
    const cacheKey = `${slug(subjectDisplay)}:${technique.id}`;
    if (detailCache[cacheKey]) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (!(await hasCredentials())) return;
    try {
      cacheDetail(cacheKey, await fetchDetail(subjectDisplay, technique));
    } catch {
      /* best-effort — dá pra abrir "Aprofundar" manualmente depois */
    }
  }

  /* -------------------------------------------------------------- pokédex */

  function isSaved(mode: string, subjectDisplay: string, itemId: string) {
    const group = saved[slug(subjectDisplay)];
    return groupItems(group).some((it) => it.id === itemId && itemKind(it, group) === mode);
  }

  function commitSaved(next: SavedState, message?: string, prevSaved?: SavedState) {
    setSaved(next);
    persistSaved(next);
    if (!message) return;
    showToast(
      message,
      prevSaved
        ? () => {
            setSaved(prevSaved);
            persistSaved(prevSaved);
          }
        : undefined
    );
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
    const dup = findSimilarItem(prevSaved, technique.name);
    commitSaved(
      next,
      dup
        ? `${technique.name} capturado(a)! Você já tem algo parecido: "${dup.name}" em "${dup.subjectDisplay}".`
        : `${technique.name} capturado(a)!`
    );
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
    const dup = findSimilarItem(prevSaved, itemName);
    commitSaved(
      next,
      dup ? `${itemName} capturado(a)! Você já tem algo parecido: "${dup.name}" em "${dup.subjectDisplay}".` : `${itemName} capturado(a)!`
    );
  }

  /**
   * Captura/solta uma planta. Diferente dos outros tipos, o "assunto" não vem
   * de uma busca: é a família botânica (ver lib/plants.js), o que agrupa as
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

  function toggleSave(mode: string, subjectDisplay: string, payload: any) {
    if (mode === "technique") toggleTechniqueSave(subjectDisplay, payload.technique, payload.statLabels);
    else if (mode === "plant") togglePlantSave(payload.plant);
    else toggleKnowledgeSave(mode, subjectDisplay, payload);
  }

  function isPlantSaved(plant: any) {
    const group = saved[plantGroupKey(plant)];
    const id = plantItemId(plant);
    return groupItems(group).some((it) => it.id === id && itemKind(it, group) === "plant");
  }

  /**
   * Guarda o texto de UM aspecto gerado sob demanda num card — origem/
   * identificação/cultivo/uso medicinal de uma planta, erros comuns/por que
   * funciona/combina com de uma técnica, ou aprofundar/confusão/exemplos/
   * relacionados de um conceito. O campo é o mesmo (`aspects`) em qualquer
   * `kind`, então uma função só cobre os três.
   */
  const updateItemAspect = (subjectKey: string, itemId: string, aspectId: string, text: string) =>
    updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, aspects: { ...(item.aspects || {}), [aspectId]: text } }));

  function removeGroup(key: string) {
    const group = saved[key];
    if (!group) return;
    const next = { ...saved };
    delete next[key];
    commitSaved(next, `"${group.displayName}" removido(a) da Pokédex.`, saved);
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

  function bulkRemoveItems(refs: CollectionRef[]) {
    const next = mapRefs(saved, refs, () => null);
    commitSaved(next, `${refs.length} item(ns) removido(s) da Pokédex.`, saved);
  }

  function bulkAddTag(refs: CollectionRef[], tag: string) {
    const clean = (tag || "").trim();
    if (!clean) return;
    const next = mapRefs(saved, refs, (item) =>
      (item.tags || []).includes(clean) ? item : { ...item, tags: [...(item.tags || []), clean] }
    );
    commitSaved(next, `Tag "${clean}" aplicada a ${refs.length} item(ns).`);
  }

  function archiveItems(refs: CollectionRef[], archived: boolean) {
    const next = mapRefs(saved, refs, (item) => ({ ...item, archived }));
    commitSaved(next, archived ? `${refs.length} item(ns) arquivado(s).` : `${refs.length} item(ns) desarquivado(s).`, saved);
  }

  /* ------------------------------------------------------------- conversão */

  /**
   * Converte um card entre técnica/conceito/tipo. É local e instantâneo: o
   * item fica no mesmo assunto com o mesmo id, então refs de coleção seguem
   * válidas e o toast de desfazer funciona como em qualquer outra edição. O
   * que a conversão não sabe preencher fica pro `enrichItem`, sob demanda.
   */
  function convertItem(subjectKey: string, itemId: string, targetKind: string) {
    const group = saved[subjectKey];
    const current = groupItems(group).find((it) => it.id === itemId);
    if (!current) return;
    const from = itemKind(current, group);
    if (from === targetKind) return;

    const next = mapRefs(saved, [{ subjectKey, itemId }], (item) => convertItemFields({ ...item, kind: from }, targetKind));
    commitSaved(
      next,
      `"${itemLabel(current)}" virou ${(KIND_LABELS[targetKind] || targetKind).toLowerCase()}.`,
      saved
    );
  }

  /**
   * Completa com a API os campos que ficaram em branco na conversão.
   * Devolve o item atualizado; erros sobem pra quem chamou mostrar no card.
   */
  async function enrichItem(subjectKey: string, itemId: string) {
    const group = saved[subjectKey];
    const current = groupItems(group).find((it) => it.id === itemId);
    if (!current) return null;
    const kind = itemKind(current, group);
    const data = await fetchItemEnrichment(kind, group.displayName, current);
    const enriched = applyEnrichment({ ...current, kind }, data);
    const next = mapRefs(saved, [{ subjectKey, itemId }], () => enriched);
    setSaved(next);
    persistSaved(next);
    return enriched;
  }

  function updateItemInGroup(subjectKey: string, itemId: string, mutate: (item: SavedItem, group: SavedGroup) => SavedItem | null) {
    setSaved((prev) => {
      const next = mapRefs(prev, [{ subjectKey, itemId }], mutate);
      if (next === prev) return prev;
      persistSaved(next);
      return next;
    });
  }

  const updateItemTags = (subjectKey: string, itemId: string, _kind: string | undefined, tags: string[]) =>
    updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, tags }));
  const updateItemNote = (subjectKey: string, itemId: string, _kind: string | undefined, note: string) =>
    updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, note }));
  const updateItemImages = (subjectKey: string, itemId: string, _kind: string | undefined, images: unknown) =>
    updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, images }));

  /* ------------------------------------------------------------- palavras */

  function isWordSaved(languageCode: string | undefined, language: string, word: string) {
    const group = words[wordLangKey(languageCode, language)];
    return !!(group && group.words.some((w) => w.id === wordItemId(word)));
  }

  function toggleWordSave(data: any) {
    const prevWords = words;
    const langKey = wordLangKey(data.languageCode, data.language);
    const wordId = wordItemId(data.word);
    const next = { ...words };
    const existing = next[langKey];
    const group = existing
      ? { displayName: existing.displayName, words: [...existing.words] }
      : { displayName: data.language, words: [] };

    const idx = group.words.findIndex((w) => w.id === wordId);
    const removed = idx >= 0;
    if (removed) {
      group.words.splice(idx, 1);
    } else {
      group.words.push({
        id: wordId,
        word: data.word,
        language: data.language,
        languageCode: data.languageCode || "",
        meaning: data.meaning,
        pinyin: data.pinyin || "",
        radical: data.radical || "",
        characters: data.characters || [],
        savedAt: Date.now(),
        tags: [],
        note: "",
      });
    }

    if (group.words.length === 0) delete next[langKey];
    else next[langKey] = group;

    setWords(next);
    persistWords(next);
    showToast(removed ? `"${data.word}" solta(o) das Palavras.` : `"${data.word}" capturada(o)!`, () => {
      setWords(prevWords);
      persistWords(prevWords);
    });
  }

  function removeWordGroup(langKey: string) {
    const prevWords = words;
    const group = words[langKey];
    if (!group) return;
    const next = { ...words };
    delete next[langKey];
    setWords(next);
    persistWords(next);
    showToast(`"${group.displayName}" removido(a) das Palavras.`, () => {
      setWords(prevWords);
      persistWords(prevWords);
    });
  }

  function updateWordInGroup(langKey: string, wordId: string, mutate: (item: any) => any) {
    setWords((prev) => {
      const group = prev[langKey];
      if (!group) return prev;
      const idx = group.words.findIndex((w) => w.id === wordId);
      if (idx === -1) return prev;
      const nextList = [...group.words];
      nextList[idx] = mutate(nextList[idx]);
      const next = { ...prev, [langKey]: { ...group, words: nextList } };
      persistWords(next);
      return next;
    });
  }

  const updateWordTags = (langKey: string, wordId: string, tags: string[]) => updateWordInGroup(langKey, wordId, (w) => ({ ...w, tags }));
  const updateWordNote = (langKey: string, wordId: string, note: string) => updateWordInGroup(langKey, wordId, (w) => ({ ...w, note }));

  /* ------------------------------------------------------------- coleções */

  function createCollection(name: string) {
    const clean = (name || "").trim();
    if (!clean) return null;
    const id = createCollectionId();
    setCollections((prev) => {
      const next = { ...prev, [id]: { id, name: clean, createdAt: Date.now(), refs: [] } };
      persistCollections(next);
      return next;
    });
    showToast(`Coleção "${clean}" criada.`);
    return id;
  }

  function deleteCollection(id: string) {
    setCollections((prev) => {
      const col = prev[id];
      if (!col) return prev;
      const next = { ...prev };
      delete next[id];
      persistCollections(next);
      showToast(`Coleção "${col.name}" excluída.`);
      return next;
    });
  }

  function addToCollection(collectionId: string | null | undefined, refs: CollectionRef[], newName?: string) {
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
      persistCollections(next);
      showToast(`${refs.length} item(ns) adicionado(s) a "${col.name}".`);
      return next;
    });
  }

  function removeFromCollection(collectionId: string, ref: CollectionRef) {
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
      persistCollections(next);
      return next;
    });
  }

  /* ------------------------------------------------------------ importação */

  function applyImport(payload: any) {
    const { saved: mergedSaved, detailCache: mergedDetails, stats } = mergeData(saved, detailCache, payload);

    let collectionStats = { newCollections: 0, updatedCollections: 0 };
    let mergedCollections = collections;
    if (payload.collections) {
      const merged = mergeCollections(collections, payload.collections);
      mergedCollections = merged.collections;
      collectionStats = merged.stats;
    }

    let wordStats = { newWords: 0, updatedWords: 0, duplicateWords: 0 };
    let mergedWords = words;
    if (payload.words) {
      const merged = mergeWords(words, payload.words);
      mergedWords = merged.words;
      wordStats = merged.stats;
    }

    // As migrações rodam sobre o pacote inteiro (inclusive coleções) porque a
    // v3 pode renomear ids ao fundir grupos legados e precisa reescrever as
    // refs junto — por isso o merge de coleções vem antes, e não depois.
    const migrated = runMigrations({ saved: mergedSaved, detailCache: mergedDetails, words: mergedWords, collections: mergedCollections }, 0).data;
    setSaved(migrated.saved);
    setDetailCache(migrated.detailCache);
    setCollections(migrated.collections);
    setWords(migrated.words);
    persistSaved(migrated.saved);
    persistDetails(migrated.detailCache);
    persistCollections(migrated.collections);
    persistWords(migrated.words);

    showToast("Dados importados!");
    return { ...stats, ...collectionStats, ...wordStats };
  }

  /* -------------------------------------------------------------- derivados */

  const counts = useMemo(() => {
    const groups = Object.values(saved);
    const active = groups.flatMap((g) => activeItems(g).map((it) => categoryOfKind(itemKind(it, g))));
    return {
      total: active.length,
      techniques: active.filter((c) => c === "technique").length,
      knowledge: active.filter((c) => c === "knowledge").length,
      plants: active.filter((c) => c === "plants").length,
      subjects: groups.length,
      collections: Object.keys(collections || {}).length,
      words: Object.values(words || {}).reduce((sum, g) => sum + g.words.length, 0),
    };
  }, [saved, collections, words]);

  const value = {
    saved,
    detailCache,
    detailHistory,
    words,
    collections,
    storageLoaded,
    counts,
    prefetchDetailsEnabled,
    changePrefetchDetails,
    toast,
    showToast,
    dismissToast,
    hasDetail,
    cacheDetail,
    deleteDetail,
    restoreDetailVersion,
    isSaved,
    isPlantSaved,
    toggleSave,
    updateItemAspect,
    removeGroup,
    bulkRemoveItems,
    bulkAddTag,
    archiveItems,
    updateItemTags,
    updateItemNote,
    updateItemImages,
    convertItem,
    enrichItem,
    isWordSaved,
    toggleWordSave,
    removeWordGroup,
    updateWordTags,
    updateWordNote,
    createCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    applyImport,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
