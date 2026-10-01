import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getJSON, setJSON, KEYS } from "../lib/storage";
import { mergeData, mergeCollections, mergeWords } from "../lib/importer";
import { CURRENT_SCHEMA_VERSION, runMigrations } from "../lib/migrations";
import { itemKind, groupItems, categoryOfKind, type SavedGroup } from "../lib/savedModel";
import { scheduleMdMirror } from "../lib/autoMdMirror";
import { scheduleCareReminders } from "../lib/careReminders";
import { ToastProvider, useToast, type ToastContextValue } from "./ToastContext";
import { useDetailsStore, type DetailsContextValue } from "./data/detailsStore";
import { useSavedStore, type SavedContextValue } from "./data/savedStore";
import { useWordsStore, type WordsContextValue } from "./data/wordsStore";
import { useCollectionsStore, type CollectionsContextValue } from "./data/collectionsStore";
import { persist } from "./data/persist";

export type { DetailVersion } from "./data/detailsStore";

/**
 * Fonte única dos dados capturados (Pokédex, guias, palavras e coleções).
 *
 * Cada domínio mora num store próprio (`state/data/*Store.ts`) e é publicado
 * num contexto separado, com valor memoizado só sobre o próprio estado — quem
 * consome `useWords()` não re-renderiza quando a Pokédex muda, e vice-versa.
 * `useData()` continua existindo como fachada que junta tudo, pra telas que
 * de fato usam vários domínios (App, DexView, ImportView); telas novas devem
 * preferir o hook mais estreito.
 *
 * O carregamento e a migração do schema persistido continuam aqui, uma vez
 * por abertura, antes de qualquer render depender do formato dos dados (ver
 * lib/migrations.ts) — porque a migração mexe em vários domínios de uma vez.
 */
export interface DataMetaValue {
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
  applyImport: (payload: any) => any;
}

export type DataContextValue = SavedContextValue &
  DetailsContextValue &
  WordsContextValue &
  CollectionsContextValue &
  ToastContextValue &
  DataMetaValue;

const SavedContext = createContext<SavedContextValue | null>(null);
const DetailsContext = createContext<DetailsContextValue | null>(null);
const WordsContext = createContext<WordsContextValue | null>(null);
const CollectionsContext = createContext<CollectionsContextValue | null>(null);
const MetaContext = createContext<DataMetaValue | null>(null);
/** Booleano isolado: telas que só esperam o boot não precisam re-renderizar com `counts`. */
const LoadedContext = createContext(false);

function required<T>(value: T | null, hook: string): T {
  if (!value) throw new Error(`${hook} precisa estar dentro de <DataProvider>`);
  return value;
}

export const useSaved = () => required(useContext(SavedContext), "useSaved()");
export const useDetails = () => required(useContext(DetailsContext), "useDetails()");
export const useWords = () => required(useContext(WordsContext), "useWords()");
export const useCollections = () => required(useContext(CollectionsContext), "useCollections()");
export const useDataMeta = () => required(useContext(MetaContext), "useDataMeta()");
export const useStorageLoaded = () => useContext(LoadedContext);

/** Fachada com todos os domínios — re-renderiza quando QUALQUER um muda. */
export function useData(): DataContextValue {
  return { ...useSaved(), ...useDetails(), ...useWords(), ...useCollections(), ...useToast(), ...useDataMeta() };
}

function activeItems(group: SavedGroup | undefined) {
  return groupItems(group).filter((it) => !it.archived);
}

function DataStores({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [storageLoaded, setStorageLoaded] = useState(false);

  const details = useDetailsStore();
  const savedStore = useSavedStore({
    showToast,
    detailCacheRef: details.detailCacheRef,
    prefetchRef: details.prefetchRef,
    cacheDetail: details.cacheDetail,
  });
  const wordsStore = useWordsStore(showToast);
  const collectionsStore = useCollectionsStore(showToast);

  const { saved } = savedStore.value;
  const { detailCache } = details.value;
  const { words } = wordsStore.value;
  const { collections } = collectionsStore.value;

  useEffect(() => {
    (async () => {
      const loaded = {
        saved: await getJSON(KEYS.saved, {}),
        detailCache: await getJSON(KEYS.details, {}),
        words: await getJSON(KEYS.words, {}),
        collections: await getJSON(KEYS.collections, {}),
      };
      details.setPrefetchDetailsEnabled(await getJSON(KEYS.prefetchDetails, true));
      details.setDetailHistory(await getJSON(KEYS.detailHistory, {}));
      const version = await getJSON(KEYS.schemaVersion, 0);
      const { data, migrated } = runMigrations(loaded, version);
      savedStore.setSaved(data.saved);
      details.setDetailCache(data.detailCache);
      wordsStore.setWords(data.words);
      collectionsStore.setCollections(data.collections);
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
    // Setters do useState são estáveis — roda só uma vez, na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Espelho .md na pasta Documentos e lembretes de cuidado das plantas (só
  // nativo, debounced). Só depois de `storageLoaded` pra não agir no boot com
  // dados ainda vazios/pré-migração.
  useEffect(() => {
    if (!storageLoaded) return;
    scheduleMdMirror(saved, detailCache);
  }, [storageLoaded, saved, detailCache]);

  useEffect(() => {
    if (!storageLoaded) return;
    scheduleCareReminders(saved);
  }, [storageLoaded, saved]);

  const meta = useMemo<DataMetaValue>(() => {
    const groups = Object.values(saved);
    const active = groups.flatMap((g) => activeItems(g).map((it) => categoryOfKind(itemKind(it, g))));

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
      savedStore.setSaved(migrated.saved);
      details.setDetailCache(migrated.detailCache);
      collectionsStore.setCollections(migrated.collections);
      wordsStore.setWords(migrated.words);
      persist(KEYS.saved, migrated.saved);
      persist(KEYS.details, migrated.detailCache);
      persist(KEYS.collections, migrated.collections);
      persist(KEYS.words, migrated.words);

      showToast("Dados importados!");
      return { ...stats, ...collectionStats, ...wordStats };
    }

    return {
      storageLoaded,
      counts: {
        total: active.length,
        techniques: active.filter((c) => c === "technique").length,
        knowledge: active.filter((c) => c === "knowledge").length,
        plants: active.filter((c) => c === "plants").length,
        subjects: groups.length,
        collections: Object.keys(collections || {}).length,
        words: Object.values(words || {}).reduce((sum, g) => sum + g.words.length, 0),
      },
      applyImport,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageLoaded, saved, detailCache, collections, words, showToast]);

  return (
    <LoadedContext.Provider value={storageLoaded}>
    <MetaContext.Provider value={meta}>
      <SavedContext.Provider value={savedStore.value}>
        <DetailsContext.Provider value={details.value}>
          <WordsContext.Provider value={wordsStore.value}>
            <CollectionsContext.Provider value={collectionsStore.value}>{children}</CollectionsContext.Provider>
          </WordsContext.Provider>
        </DetailsContext.Provider>
      </SavedContext.Provider>
    </MetaContext.Provider>
    </LoadedContext.Provider>
  );
}

export function DataProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DataStores>{children}</DataStores>
    </ToastProvider>
  );
}
