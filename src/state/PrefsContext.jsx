import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { slug } from "../theme";
import { getJSON, setJSON, KEYS } from "../lib/storage";
import { getSearchEffort, setSearchEffort as persistSearchEffort } from "../lib/anthropic";
import { getSearchTiers, setSearchTiers as persistSearchTiers, defaultSearchTiers } from "../lib/models";
import {
  initRelevanceState,
  markIrrelevant as markIrrelevantState,
  unmarkIrrelevant as unmarkIrrelevantState,
  isMarkedIrrelevant,
  avoidListForSubject,
  tasteAvoidList,
} from "../lib/relevance";

/**
 * Tudo que é PREFERÊNCIA ou memória de uso do app — tema, esforço e modelo de
 * busca, aba corrente, histórico, fila offline, itens marcados como pouco
 * relevantes.
 *
 * Antes isso morava solto no `App.jsx`, que carregava cada chave do storage no
 * boot e passava tudo por props até quem precisava. O `DataContext` já tinha
 * feito esse movimento com os dados capturados; aqui é o mesmo para o resto,
 * e o App volta a ser só navegação + fluxo de busca.
 *
 * O que NÃO mora aqui: os dados capturados (DataContext) e o estado do fluxo
 * de busca em si (searchReducer), que é efêmero e não se persiste.
 */
const PrefsContext = createContext(null);

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs() precisa estar dentro de <PrefsProvider>");
  return ctx;
}

const MAX_HISTORY = 8;
const TABS = ["search", "dex", "collections"];

export function PrefsProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const [searchEffort, setSearchEffortState] = useState("medium");
  const [searchTiers, setSearchTiersState] = useState(defaultSearchTiers());
  const [history, setHistory] = useState([]);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [relevance, setRelevance] = useState(initRelevanceState());
  const [showArchived, setShowArchived] = useState(false);
  const [dexCategory, setDexCategory] = useState("technique"); // technique | knowledge | plants | words
  const [initialTab, setInitialTab] = useState(null); // null = ainda carregando
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // A fila offline é lida de dentro do listener de "online", que é registrado
  // uma vez só — por isso a cópia em ref, senão ele veria sempre a fila vazia
  // do primeiro render.
  const offlineQueueRef = useRef([]);
  useEffect(() => {
    offlineQueueRef.current = offlineQueue;
  }, [offlineQueue]);

  useEffect(() => {
    (async () => {
      setTheme(await getJSON(KEYS.theme, "light"));
      setSearchEffortState(await getSearchEffort());
      setSearchTiersState(await getSearchTiers());
      setHistory(await getJSON(KEYS.searchHistory, []));
      setOfflineQueue(await getJSON(KEYS.offlineQueue, []));
      setRelevance(await getJSON(KEYS.irrelevantItems, initRelevanceState()));
      const savedTab = await getJSON(KEYS.lastTab, "search");
      setInitialTab(TABS.includes(savedTab) ? savedTab : "search");
      setPrefsLoaded(true);
    })();
  }, []);

  const changeTheme = useCallback((next) => {
    setTheme(next);
    setJSON(KEYS.theme, next).catch(() => {});
  }, []);

  const changeSearchEffort = useCallback((effort) => {
    setSearchEffortState(effort);
    persistSearchEffort(effort).catch(() => {});
  }, []);

  const changeSearchTier = useCallback((mode, tier) => {
    setSearchTiersState((prev) => {
      const next = { ...prev, [mode]: tier };
      persistSearchTiers(next).catch(() => {});
      return next;
    });
  }, []);

  const rememberTab = useCallback((tab) => {
    setJSON(KEYS.lastTab, tab).catch(() => {});
  }, []);

  const addToHistory = useCallback((mode, term) => {
    setHistory((prev) => {
      const next = [
        { mode, term },
        ...prev.filter((h) => !(h.mode === mode && h.term.toLowerCase() === term.toLowerCase())),
      ].slice(0, MAX_HISTORY);
      setJSON(KEYS.searchHistory, next).catch(() => {});
      return next;
    });
  }, []);

  const enqueueOffline = useCallback((mode, term) => {
    setOfflineQueue((prev) => {
      const next = [
        ...prev.filter((q) => !(q.mode === mode && q.term.toLowerCase() === term.toLowerCase())),
        { mode, term },
      ];
      setJSON(KEYS.offlineQueue, next).catch(() => {});
      return next;
    });
  }, []);

  const clearOfflineQueue = useCallback(() => {
    setOfflineQueue([]);
    setJSON(KEYS.offlineQueue, []).catch(() => {});
  }, []);

  /* --------------------------------------------------------------- relevância */

  const persistRelevance = (next) => setJSON(KEYS.irrelevantItems, next).catch(() => {});

  const markItemIrrelevant = useCallback((subjectDisplay, mode, item, showToast) => {
    const subjectSlug = slug(subjectDisplay);
    const itemId = slug(item.name || item.term);
    const name = item.name || item.term;
    setRelevance((prev) => {
      const next = markIrrelevantState(prev, { subjectSlug, itemId, name, mode, subjectDisplay });
      persistRelevance(next);
      return next;
    });
    showToast(`"${name}" marcado(a) como pouco relevante.`, () => {
      setRelevance((prev) => {
        const next = unmarkIrrelevantState(prev, subjectSlug, itemId);
        persistRelevance(next);
        return next;
      });
    });
  }, []);

  const isItemIrrelevant = useCallback(
    (subjectDisplay, itemName) => isMarkedIrrelevant(relevance, slug(subjectDisplay), slug(itemName)),
    [relevance]
  );

  /** Lista de "evite isto" enviada junto com a busca de um assunto. */
  const avoidListFor = useCallback(
    (term) => [...avoidListForSubject(relevance, slug(term)), ...tasteAvoidList(relevance)],
    [relevance]
  );

  const value = useMemo(
    () => ({
      prefsLoaded,
      initialTab,
      theme,
      changeTheme,
      searchEffort,
      changeSearchEffort,
      searchTiers,
      changeSearchTier,
      history,
      addToHistory,
      offlineQueue,
      offlineQueueRef,
      enqueueOffline,
      clearOfflineQueue,
      showArchived,
      toggleShowArchived: () => setShowArchived((v) => !v),
      dexCategory,
      setDexCategory,
      markItemIrrelevant,
      isItemIrrelevant,
      avoidListFor,
      rememberTab,
    }),
    [
      prefsLoaded,
      initialTab,
      theme,
      changeTheme,
      searchEffort,
      changeSearchEffort,
      searchTiers,
      changeSearchTier,
      history,
      addToHistory,
      offlineQueue,
      enqueueOffline,
      clearOfflineQueue,
      showArchived,
      dexCategory,
      markItemIrrelevant,
      isItemIrrelevant,
      avoidListFor,
      rememberTab,
    ]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
