import { useCallback, useEffect, useRef, useState } from "react";
import { Settings as SettingsIcon, Upload, WifiOff, Brain, Mic, MicOff, History } from "lucide-react";
import { COLORS, THEME_VARS, slug, tabStyle, iconButtonStyle } from "./theme";
import { getJSON, setJSON, KEYS } from "./lib/storage";
import {
  fetchTechniques,
  fetchDefinition,
  fetchList,
  fetchCompare,
  fetchDetail,
  fetchRelatedSuggestions,
  hasCredentials,
  getSearchEffort,
  setSearchEffort as persistSearchEffort,
  MissingApiKeyError,
} from "./lib/anthropic";
import { parseSearchQuery, hasExplicitPrefix, splitCompareTerms, PLACEHOLDER_BY_MODE } from "./lib/searchQuery";
import { wordLangKey, wordItemId } from "./lib/words";
import { mergeData, mergeCollections } from "./lib/importer";
import { initReviewState, gradeReviewState, countDue, getDueQueue } from "./lib/review";
import { recordVisit, recordReviewCompleted } from "./lib/gamification";
import { scheduleReviewReminder, requestNotificationPermission, cancelReviewReminder } from "./lib/notifications";
import { updateReviewWidget } from "./lib/reviewWidget";
import { createCollectionId } from "./lib/collections";
import { findSimilarItem } from "./lib/dedupe";
import { initEffectProfiles, createProfileId, createCriterionId, createItemId, clampRating } from "./lib/effectProfiles";
import { addLink, removeLink } from "./lib/links";
import {
  initRelevanceState,
  markIrrelevant as markIrrelevantState,
  unmarkIrrelevant as unmarkIrrelevantState,
  isMarkedIrrelevant,
  avoidListForSubject,
  tasteAvoidList,
} from "./lib/relevance";

const SEARCH_MODES = [
  { mode: "technique", label: "Técnicas" },
  { mode: "definition", label: "Conceito" },
  { mode: "list", label: "Tipos" },
  { mode: "compare", label: "Comparar" },
];
const MAX_HISTORY = 8;
const MODE_LABELS_SHORT = { technique: "téc", definition: "def", list: "list", compare: "cmp" };
import SearchView from "./views/SearchView";
import DexView from "./views/DexView";
import DetailPage from "./views/DetailPage";
import SettingsView from "./views/SettingsView";
import ImportView from "./views/ImportView";
import CompareView from "./views/CompareView";
import ReviewView from "./views/ReviewView";
import EffectsSection from "./components/EffectsSection";

export default function App() {
  const [view, setView] = useState("search");
  const [lastTab, setLastTab] = useState("search");
  const [detailTarget, setDetailTarget] = useState(null);
  const [compareTarget, setCompareTarget] = useState(null);

  const [query, setQuery] = useState("");
  const [criteria, setCriteria] = useState("");
  const [searchMode, setSearchMode] = useState("technique");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [result, setResult] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [history, setHistory] = useState([]);

  const [saved, setSaved] = useState({});
  const [detailCache, setDetailCache] = useState({});
  const [toast, setToast] = useState(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const [theme, setTheme] = useState("light");
  const [offlineQueue, setOfflineQueue] = useState([]);
  const offlineQueueRef = useRef([]);
  const [gamification, setGamification] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [collections, setCollections] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [prefetchDetailsEnabled, setPrefetchDetailsEnabled] = useState(true);
  const [showHistorySuggestions, setShowHistorySuggestions] = useState(false);
  const [relevance, setRelevance] = useState(initRelevanceState());
  const [dexCategory, setDexCategory] = useState("technique"); // "technique" | "knowledge" | "words" | "collections"
  const [effectProfiles, setEffectProfiles] = useState(initEffectProfiles());
  const [searchEffort, setSearchEffortState] = useState("medium");
  const [showArchived, setShowArchived] = useState(false);
  const [words, setWords] = useState({});

  useEffect(() => {
    (async () => {
      setSaved(await getJSON(KEYS.saved, {}));
      setDetailCache(await getJSON(KEYS.details, {}));
      setHistory(await getJSON(KEYS.searchHistory, []));
      setTheme(await getJSON(KEYS.theme, "light"));
      setOfflineQueue(await getJSON(KEYS.offlineQueue, []));
      setNotificationsEnabled(await getJSON(KEYS.notificationsEnabled, false));
      setCollections(await getJSON(KEYS.collections, {}));
      setEffectProfiles(await getJSON(KEYS.effectProfiles, initEffectProfiles()));
      setSuggestions((await getJSON(KEYS.suggestions, null))?.items || []);
      setPrefetchDetailsEnabled(await getJSON(KEYS.prefetchDetails, true));
      setRelevance(await getJSON(KEYS.irrelevantItems, initRelevanceState()));
      setSearchEffortState(await getSearchEffort());
      setWords(await getJSON(KEYS.words, {}));
      const savedTab = await getJSON(KEYS.lastTab, "search");
      if (savedTab === "search" || savedTab === "dex" || savedTab === "effects") {
        setLastTab(savedTab);
        setView(savedTab);
      }
      const gState = await getJSON(KEYS.gamification, null);
      const nextG = recordVisit(gState);
      setGamification(nextG);
      setJSON(KEYS.gamification, nextG).catch(() => {});
      setStorageLoaded(true);
      setHasKey(await hasCredentials());
    })();
  }, []);

  useEffect(() => {
    offlineQueueRef.current = offlineQueue;
  }, [offlineQueue]);

  useEffect(() => {
    async function goOnline() {
      setIsOnline(true);
      const queue = offlineQueueRef.current;
      if (queue.length) {
        showToast(`Conexão restabelecida — buscando ${queue.length} item(ns) da fila...`);
        for (const item of queue) {
          // eslint-disable-next-line no-await-in-loop
          await handleSearch({ mode: item.mode, term: item.term });
        }
        setOfflineQueue([]);
        setJSON(KEYS.offlineQueue, []).catch(() => {});
      }
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!storageLoaded || !notificationsEnabled) return;
    scheduleReviewReminder(countDue(saved)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageLoaded, notificationsEnabled, saved]);

  useEffect(() => {
    if (!storageLoaded) return;
    const queue = getDueQueue(saved);
    const headline = queue.length
      ? queue[0].kind === "definition"
        ? queue[0].item.term
        : queue[0].item.name
      : "Tudo revisado por hoje!";
    updateReviewWidget(queue.length, headline).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageLoaded, saved]);

  const showToast = useCallback((msg, onUndo) => {
    setToast({ msg, onUndo });
    setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), onUndo ? 4000 : 2200);
  }, []);

  function addToHistory(mode, term) {
    setHistory((prev) => {
      const next = [
        { mode, term },
        ...prev.filter((h) => !(h.mode === mode && h.term.toLowerCase() === term.toLowerCase())),
      ].slice(0, MAX_HISTORY);
      setJSON(KEYS.searchHistory, next).catch(() => {});
      return next;
    });
  }

  async function persistSaved(newSaved) {
    try {
      await setJSON(KEYS.saved, newSaved);
    } catch (e) {
      console.error("Falha ao salvar na Pokédex", e);
    }
  }

  async function persistDetails(newCache) {
    try {
      await setJSON(KEYS.details, newCache);
    } catch (e) {
      console.error("Falha ao salvar o guia", e);
    }
  }

  async function persistWords(newWords) {
    try {
      await setJSON(KEYS.words, newWords);
    } catch (e) {
      console.error("Falha ao salvar palavra", e);
    }
  }

  function isWordSaved(languageCode, language, word) {
    const group = words[wordLangKey(languageCode, language)];
    return !!(group && group.words.some((w) => w.id === wordItemId(word)));
  }

  function toggleWordSave(data) {
    const prevWords = words;
    const langKey = wordLangKey(data.languageCode, data.language);
    const wordId = wordItemId(data.word);
    const nextWords = { ...words };
    const existing = nextWords[langKey];
    const group = existing
      ? { displayName: existing.displayName, words: [...existing.words] }
      : { displayName: data.language, words: [] };

    const idx = group.words.findIndex((w) => w.id === wordId);
    let removed = false;
    if (idx >= 0) {
      group.words.splice(idx, 1);
      removed = true;
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

    if (group.words.length === 0) delete nextWords[langKey];
    else nextWords[langKey] = group;

    setWords(nextWords);
    persistWords(nextWords);
    showToast(removed ? `"${data.word}" solta(o) das Palavras.` : `"${data.word}" capturada(o)!`, () => {
      setWords(prevWords);
      persistWords(prevWords);
    });
  }

  function removeWordGroup(langKey) {
    const prevWords = words;
    const group = words[langKey];
    if (!group) return;
    const nextWords = { ...words };
    delete nextWords[langKey];
    setWords(nextWords);
    persistWords(nextWords);
    showToast(`"${group.displayName}" removido(a) das Palavras.`, () => {
      setWords(prevWords);
      persistWords(prevWords);
    });
  }

  function updateWordInGroup(langKey, wordId, mutate) {
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

  function updateWordTags(langKey, wordId, tags) {
    updateWordInGroup(langKey, wordId, (w) => ({ ...w, tags }));
  }

  function updateWordNote(langKey, wordId, note) {
    updateWordInGroup(langKey, wordId, (w) => ({ ...w, note }));
  }

  /** Persiste o componente semântico/fonético identificado sob demanda pra UM hanzi de uma palavra salva. */
  function updateWordCharacterComponent(langKey, wordId, charIndex, kind, result) {
    updateWordInGroup(langKey, wordId, (w) => {
      const characters = [...(w.characters || [])];
      if (!characters[charIndex]) return w;
      characters[charIndex] = {
        ...characters[charIndex],
        ...(kind === "semantic"
          ? { semanticComponent: result.component || "—" }
          : { phoneticComponent: result.component || "—", phoneticComponentPinyin: result.pinyin || "" }),
      };
      return { ...w, characters };
    });
  }

  function hasDetail(subjectDisplay, technique) {
    const techId = technique.id || slug(technique.name);
    return !!detailCache[`${slug(subjectDisplay)}:${techId}`];
  }

  function isSaved(mode, subjectDisplay, itemId) {
    if (mode === "technique") {
      const group = saved[slug(subjectDisplay)];
      return !!(group && group.techniques.some((t) => t.id === itemId));
    }
    const group = saved[`kn:${slug(subjectDisplay)}`];
    return !!(group && group.items.some((it) => it.id === itemId));
  }

  function toggleTechniqueSave(subjectDisplay, technique, statLabels) {
    const prevSaved = saved;
    const subjectKey = slug(subjectDisplay);
    const techId = technique.id || slug(technique.name);
    const newSaved = { ...saved };
    const existing = newSaved[subjectKey];
    const group = existing
      ? { displayName: existing.displayName, kind: "technique", techniques: [...existing.techniques] }
      : { displayName: subjectDisplay, kind: "technique", techniques: [] };

    const idx = group.techniques.findIndex((t) => t.id === techId);
    let removed = false;
    if (idx >= 0) {
      group.techniques.splice(idx, 1);
      removed = true;
    } else {
      group.techniques.push({
        id: techId,
        name: technique.name,
        type: technique.type,
        description: technique.description,
        bestFor: technique.bestFor,
        stats: technique.stats,
        statLabels: statLabels,
        savedAt: Date.now(),
        tags: [],
        note: "",
        reviewState: initReviewState(),
      });
    }

    if (group.techniques.length === 0) {
      delete newSaved[subjectKey];
    } else {
      newSaved[subjectKey] = group;
    }

    setSaved(newSaved);
    persistSaved(newSaved);

    if (removed) {
      showToast(`${technique.name} solto(a) da Pokédex.`, () => {
        setSaved(prevSaved);
        persistSaved(prevSaved);
      });
    } else {
      const dup = findSimilarItem(prevSaved, technique.name);
      showToast(
        dup
          ? `${technique.name} capturado(a)! Você já tem algo parecido: "${dup.name}" em "${dup.subjectDisplay}".`
          : `${technique.name} capturado(a)!`
      );
      prefetchDetail(subjectDisplay, { ...technique, id: techId });
    }
  }

  /** Baixa o guia em background assim que uma técnica é capturada, pra já ficar disponível offline. */
  async function prefetchDetail(subjectDisplay, technique) {
    if (!prefetchDetailsEnabled) return;
    const cacheKey = `${slug(subjectDisplay)}:${technique.id}`;
    if (detailCache[cacheKey]) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (!(await hasCredentials())) return;
    try {
      const parsed = await fetchDetail(subjectDisplay, technique);
      cacheDetail(cacheKey, parsed);
    } catch {
      /* best-effort — o usuário ainda pode abrir "Aprofundar" manualmente depois */
    }
  }

  function toggleKnowledgeSave(mode, subjectDisplay, payload) {
    const prevSaved = saved;
    const subjectKey = `kn:${slug(subjectDisplay)}`;
    const newSaved = { ...saved };
    const existing = newSaved[subjectKey];
    const group = existing
      ? { displayName: existing.displayName, kind: mode, items: [...existing.items] }
      : { displayName: subjectDisplay, kind: mode, items: [] };

    let itemId;
    let itemName;
    let itemObj;
    if (mode === "definition") {
      const d = payload.definition;
      itemId = slug(d.term);
      itemName = d.term;
      itemObj = {
        id: itemId,
        term: d.term,
        category: d.category,
        definition: d.definition,
        keyPoints: d.keyPoints || [],
        example: d.example || "",
        relatedTerms: d.relatedTerms || [],
        savedAt: Date.now(),
        tags: [],
        note: "",
        reviewState: initReviewState(),
      };
    } else {
      const it = payload.item;
      itemId = slug(it.name);
      itemName = it.name;
      itemObj = {
        id: itemId,
        name: it.name,
        category: it.category,
        description: it.description,
        savedAt: Date.now(),
        tags: [],
        note: "",
        reviewState: initReviewState(),
      };
    }

    const idx = group.items.findIndex((x) => x.id === itemId);
    let removed = false;
    if (idx >= 0) {
      group.items.splice(idx, 1);
      removed = true;
    } else {
      group.items.push(itemObj);
    }

    if (group.items.length === 0) {
      delete newSaved[subjectKey];
    } else {
      newSaved[subjectKey] = group;
    }

    setSaved(newSaved);
    persistSaved(newSaved);

    if (removed) {
      showToast(`${itemName} solto(a) da Pokédex.`, () => {
        setSaved(prevSaved);
        persistSaved(prevSaved);
      });
    } else {
      const dup = findSimilarItem(prevSaved, itemName);
      showToast(
        dup
          ? `${itemName} capturado(a)! Você já tem algo parecido: "${dup.name}" em "${dup.subjectDisplay}".`
          : `${itemName} capturado(a)!`
      );
    }
  }

  function removeGroup(key) {
    const prevSaved = saved;
    const group = saved[key];
    if (!group) return;
    const newSaved = { ...saved };
    delete newSaved[key];
    setSaved(newSaved);
    persistSaved(newSaved);
    showToast(`"${group.displayName}" removido(a) da Pokédex.`, () => {
      setSaved(prevSaved);
      persistSaved(prevSaved);
    });
  }

  function bulkRemoveItems(items) {
    const prevSaved = saved;
    const next = { ...saved };
    for (const { subjectKey, itemId } of items) {
      const group = next[subjectKey];
      if (!group) continue;
      const isKnowledge = group.kind === "definition" || group.kind === "list";
      const list = isKnowledge ? group.items : group.techniques;
      const filtered = list.filter((it) => it.id !== itemId);
      if (filtered.length === 0) {
        delete next[subjectKey];
      } else {
        next[subjectKey] = isKnowledge ? { ...group, items: filtered } : { ...group, techniques: filtered };
      }
    }
    setSaved(next);
    persistSaved(next);
    showToast(`${items.length} item(ns) removido(s) da Pokédex.`, () => {
      setSaved(prevSaved);
      persistSaved(prevSaved);
    });
  }

  function bulkAddTag(items, tag) {
    const clean = (tag || "").trim();
    if (!clean) return;
    const next = { ...saved };
    for (const { subjectKey, itemId } of items) {
      const group = next[subjectKey];
      if (!group) continue;
      const isKnowledge = group.kind === "definition" || group.kind === "list";
      const list = isKnowledge ? group.items : group.techniques;
      const idx = list.findIndex((it) => it.id === itemId);
      if (idx === -1) continue;
      const item = list[idx];
      if ((item.tags || []).includes(clean)) continue;
      const nextList = [...list];
      nextList[idx] = { ...item, tags: [...(item.tags || []), clean] };
      next[subjectKey] = isKnowledge ? { ...group, items: nextList } : { ...group, techniques: nextList };
    }
    setSaved(next);
    persistSaved(next);
    showToast(`Tag "${clean}" aplicada a ${items.length} item(ns).`);
  }

  function updateItemInGroup(subjectKey, itemId, mutate) {
    setSaved((prev) => {
      const group = prev[subjectKey];
      if (!group) return prev;
      const isKnowledge = group.kind === "definition" || group.kind === "list";
      const list = isKnowledge ? group.items : group.techniques;
      const idx = list.findIndex((it) => it.id === itemId);
      if (idx === -1) return prev;
      const nextList = [...list];
      nextList[idx] = mutate(nextList[idx]);
      const nextGroup = isKnowledge ? { ...group, items: nextList } : { ...group, techniques: nextList };
      const next = { ...prev, [subjectKey]: nextGroup };
      persistSaved(next);
      return next;
    });
  }

  function updateItemTags(subjectKey, itemId, _kind, tags) {
    updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, tags }));
  }

  function updateItemNote(subjectKey, itemId, _kind, note) {
    updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, note }));
  }

  function updateItemImages(subjectKey, itemId, _kind, images) {
    updateItemInGroup(subjectKey, itemId, (item) => ({ ...item, images }));
  }

  function archiveItems(items, archived) {
    const prevSaved = saved;
    let next = saved;
    for (const { subjectKey, itemId } of items) {
      const group = next[subjectKey];
      if (!group) continue;
      const isKnowledge = group.kind === "definition" || group.kind === "list";
      const list = isKnowledge ? group.items : group.techniques;
      const idx = list.findIndex((it) => it.id === itemId);
      if (idx === -1) continue;
      const nextList = [...list];
      nextList[idx] = { ...nextList[idx], archived };
      next = { ...next, [subjectKey]: isKnowledge ? { ...group, items: nextList } : { ...group, techniques: nextList } };
    }
    setSaved(next);
    persistSaved(next);
    showToast(archived ? `${items.length} item(ns) arquivado(s).` : `${items.length} item(ns) desarquivado(s).`, () => {
      setSaved(prevSaved);
      persistSaved(prevSaved);
    });
  }

  function linkItems(a, b) {
    setSaved((prev) => {
      const next = addLink(prev, a, b);
      persistSaved(next);
      return next;
    });
  }

  function unlinkItems(a, b) {
    setSaved((prev) => {
      const next = removeLink(prev, a, b);
      persistSaved(next);
      return next;
    });
  }

  function persistCollections(next) {
    setJSON(KEYS.collections, next).catch(() => {});
  }

  function createCollection(name) {
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

  function deleteCollection(id) {
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

  function addToCollection(collectionId, refs, newName) {
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

  function removeFromCollection(collectionId, ref) {
    setCollections((prev) => {
      const col = prev[collectionId];
      if (!col) return prev;
      const next = {
        ...prev,
        [collectionId]: { ...col, refs: col.refs.filter((r) => !(r.subjectKey === ref.subjectKey && r.itemId === ref.itemId)) },
      };
      persistCollections(next);
      return next;
    });
  }

  function persistEffectProfiles(next) {
    setJSON(KEYS.effectProfiles, next).catch(() => {});
  }

  function createEffectProfile(name) {
    const clean = (name || "").trim();
    if (!clean) return null;
    const id = createProfileId();
    setEffectProfiles((prev) => {
      const next = { ...prev, [id]: { id, name: clean, createdAt: Date.now(), criteria: [], items: [] } };
      persistEffectProfiles(next);
      return next;
    });
    showToast(`Perfil "${clean}" criado.`);
    return id;
  }

  function deleteEffectProfile(id) {
    setEffectProfiles((prev) => {
      const profile = prev[id];
      if (!profile) return prev;
      const next = { ...prev };
      delete next[id];
      persistEffectProfiles(next);
      showToast(`Perfil "${profile.name}" excluído.`);
      return next;
    });
  }

  function addEffectCriterion(profileId, label) {
    const clean = (label || "").trim();
    if (!clean) return;
    setEffectProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const existingIds = profile.criteria.map((c) => c.id);
      if (profile.criteria.some((c) => c.label.toLowerCase() === clean.toLowerCase())) return prev;
      const id = createCriterionId(existingIds, clean);
      const next = { ...prev, [profileId]: { ...profile, criteria: [...profile.criteria, { id, label: clean }] } };
      persistEffectProfiles(next);
      return next;
    });
  }

  function removeEffectCriterion(profileId, criterionId) {
    setEffectProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const criteria = profile.criteria.filter((c) => c.id !== criterionId);
      const items = profile.items.map((it) => {
        const ratings = { ...it.ratings };
        const reasons = { ...(it.reasons || {}) };
        delete ratings[criterionId];
        delete reasons[criterionId];
        return { ...it, ratings, reasons };
      });
      const next = { ...prev, [profileId]: { ...profile, criteria, items } };
      persistEffectProfiles(next);
      return next;
    });
  }

  function addEffectItem(profileId, { name, ratings, reasons, note }) {
    const clean = (name || "").trim();
    if (!clean) return;
    setEffectProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const existingIds = profile.items.map((it) => it.id);
      const id = createItemId(existingIds, clean);
      const item = { id, name: clean, active: true, ratings: ratings || {}, reasons: reasons || {}, note: note || "" };
      const next = { ...prev, [profileId]: { ...profile, items: [...profile.items, item] } };
      persistEffectProfiles(next);
      return next;
    });
    showToast(`"${clean}" adicionado(a) ao perfil.`);
  }

  function removeEffectItem(profileId, itemId) {
    setEffectProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const next = { ...prev, [profileId]: { ...profile, items: profile.items.filter((it) => it.id !== itemId) } };
      persistEffectProfiles(next);
      return next;
    });
  }

  function toggleEffectItemActive(profileId, itemId) {
    setEffectProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const items = profile.items.map((it) => (it.id === itemId ? { ...it, active: !it.active } : it));
      const next = { ...prev, [profileId]: { ...profile, items } };
      persistEffectProfiles(next);
      return next;
    });
  }

  function updateEffectItemRating(profileId, itemId, criterionId, value) {
    setEffectProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const items = profile.items.map((it) =>
        it.id === itemId ? { ...it, ratings: { ...it.ratings, [criterionId]: clampRating(value) } } : it
      );
      const next = { ...prev, [profileId]: { ...profile, items } };
      persistEffectProfiles(next);
      return next;
    });
  }

  function updateEffectItemNote(profileId, itemId, note) {
    setEffectProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const items = profile.items.map((it) => (it.id === itemId ? { ...it, note } : it));
      const next = { ...prev, [profileId]: { ...profile, items } };
      persistEffectProfiles(next);
      return next;
    });
  }

  async function generateSuggestions() {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const captured = [];
      for (const group of Object.values(saved)) {
        captured.push(group.displayName);
        const items = group.kind === "definition" || group.kind === "list" ? group.items : group.techniques;
        for (const it of items || []) captured.push(it.term || it.name);
      }
      const uniqueCaptured = [...new Set(captured)].slice(0, 60);
      const result = await fetchRelatedSuggestions(uniqueCaptured);
      setSuggestions(result);
      setJSON(KEYS.suggestions, { items: result, generatedAt: Date.now() }).catch(() => {});
    } catch (e) {
      if (e instanceof MissingApiKeyError) {
        setSuggestionsError("Configure sua API key em Configurações para gerar sugestões.");
      } else {
        setSuggestionsError(e.message || "Não foi possível gerar sugestões agora.");
      }
    } finally {
      setSuggestionsLoading(false);
    }
  }

  function changePrefetchDetails(enabled) {
    setPrefetchDetailsEnabled(enabled);
    setJSON(KEYS.prefetchDetails, enabled).catch(() => {});
  }

  function changeSearchEffort(effort) {
    setSearchEffortState(effort);
    persistSearchEffort(effort).catch(() => {});
  }

  function gradeReviewItem(subjectKey, itemId, _kind, correct) {
    updateItemInGroup(subjectKey, itemId, (item) => ({
      ...item,
      reviewState: gradeReviewState(item.reviewState, correct),
    }));
    setGamification((prev) => {
      const next = recordReviewCompleted(prev);
      setJSON(KEYS.gamification, next).catch(() => {});
      return next;
    });
  }

  function changeTheme(next) {
    setTheme(next);
    setJSON(KEYS.theme, next).catch(() => {});
  }

  async function changeNotifications(enabled) {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        showToast("Permissão de notificações negada pelo sistema.");
        return false;
      }
    } else {
      await cancelReviewReminder();
    }
    setNotificationsEnabled(enabled);
    await setJSON(KEYS.notificationsEnabled, enabled);
    return true;
  }

  function searchRelated(mode, term) {
    setDetailTarget(null);
    setCompareTarget(null);
    setLastTab("search");
    setView("search");
    setJSON(KEYS.lastTab, "search").catch(() => {});
    handleSearch({ mode, term });
  }

  function toggleSave(mode, subjectDisplay, payload) {
    if (mode === "technique") {
      toggleTechniqueSave(subjectDisplay, payload.technique, payload.statLabels);
    } else {
      toggleKnowledgeSave(mode, subjectDisplay, payload);
    }
  }

  function markItemIrrelevant(subjectDisplay, mode, item) {
    const subjectSlug = slug(subjectDisplay);
    const itemId = slug(item.name || item.term);
    const name = item.name || item.term;
    setRelevance((prev) => {
      const next = markIrrelevantState(prev, { subjectSlug, itemId, name, mode, subjectDisplay });
      setJSON(KEYS.irrelevantItems, next).catch(() => {});
      return next;
    });
    showToast(`"${name}" marcado(a) como pouco relevante.`, () => {
      setRelevance((prev) => {
        const next = unmarkIrrelevantState(prev, subjectSlug, itemId);
        setJSON(KEYS.irrelevantItems, next).catch(() => {});
        return next;
      });
    });
  }

  function isItemIrrelevant(subjectDisplay, itemName) {
    return isMarkedIrrelevant(relevance, slug(subjectDisplay), slug(itemName));
  }

  function enqueueOfflineSearch(mode, term) {
    setOfflineQueue((prev) => {
      const next = [...prev.filter((q) => !(q.mode === mode && q.term.toLowerCase() === term.toLowerCase())), { mode, term }];
      setJSON(KEYS.offlineQueue, next).catch(() => {});
      return next;
    });
    setSearchMode(mode);
    setQuery(term);
    showToast(`Sem internet — "${term}" foi enfileirado(a) e será buscado(a) ao reconectar.`);
  }

  async function handleSearch(override) {
    let mode, term;
    if (override) {
      ({ mode, term } = override);
    } else if (hasExplicitPrefix(query)) {
      ({ mode, term } = parseSearchQuery(query));
    } else {
      mode = searchMode;
      term = query.trim();
    }
    if (!term || loading) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineSearch(mode, term);
      return;
    }
    setSearchMode(mode);
    setQuery(term);
    setLoading(true);
    setError(null);
    setNeedsKey(false);
    try {
      let data;
      const avoid = [...avoidListForSubject(relevance, slug(term)), ...tasteAvoidList(relevance)];
      const critList = criteria.split(",").map((c) => c.trim()).filter(Boolean);
      if (mode === "definition") data = await fetchDefinition(term, avoid, searchEffort);
      else if (mode === "list") data = await fetchList(term, avoid, searchEffort);
      else if (mode === "compare") {
        const names = splitCompareTerms(term);
        if (names.length < 2) throw new Error('Informe pelo menos 2 itens separados por vírgula, ex.: "melatonina, magnésio".');
        if (names.length > 3) throw new Error("No máximo 3 itens por comparação.");
        data = await fetchCompare(names, avoid, critList, searchEffort);
      } else data = await fetchTechniques(term, avoid, critList, searchEffort);
      setResult({ mode, data });
      setScanCount((c) => c + 1);
      addToHistory(mode, term);
    } catch (e) {
      console.error(e);
      if (e instanceof MissingApiKeyError) {
        setNeedsKey(true);
      } else {
        setError(e.message || "Não foi possível escanear esse assunto agora. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  function runHistoryTerm(mode, term) {
    handleSearch({ mode, term });
  }

  function toggleVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Busca por voz não é suportada neste navegador.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      showToast("Não foi possível ouvir. Tente novamente.");
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) handleSearch({ mode: searchMode, term: transcript });
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function openDetail(subjectDisplay, technique) {
    setCompareTarget(null);
    setDetailTarget({ subjectDisplay, technique });
  }

  function openCompare(items) {
    setDetailTarget(null);
    setCompareTarget(items);
  }

  function cacheDetail(cacheKey, detail) {
    setDetailCache((prev) => {
      const next = { ...prev, [cacheKey]: detail };
      persistDetails(next);
      return next;
    });
  }

  function applyImport(payload) {
    const { saved: mergedSaved, detailCache: mergedDetails, stats } = mergeData(saved, detailCache, payload);
    setSaved(mergedSaved);
    setDetailCache(mergedDetails);
    persistSaved(mergedSaved);
    persistDetails(mergedDetails);

    let collectionStats = { newCollections: 0, updatedCollections: 0 };
    if (payload.collections) {
      const { collections: mergedCollections, stats: cStats } = mergeCollections(collections, payload.collections);
      setCollections(mergedCollections);
      persistCollections(mergedCollections);
      collectionStats = cStats;
    }

    showToast("Dados importados!");
    return { ...stats, ...collectionStats };
  }

  function goTab(tab) {
    setDetailTarget(null);
    setCompareTarget(null);
    setLastTab(tab);
    setView(tab);
    setJSON(KEYS.lastTab, tab).catch(() => {});
  }

  function openScreen(screen) {
    setDetailTarget(null);
    setCompareTarget(null);
    setView(screen);
  }

  function backToTab() {
    setDetailTarget(null);
    setCompareTarget(null);
    setView(lastTab);
  }

  const activeCount = (list) => (list || []).filter((it) => !it.archived).length;
  const totalSavedCount = Object.values(saved).reduce(
    (sum, g) => sum + activeCount(g.kind === "definition" || g.kind === "list" ? g.items : g.techniques),
    0
  );
  const techniqueCount = Object.values(saved).reduce(
    (sum, g) => sum + ((!g.kind || g.kind === "technique") ? activeCount(g.techniques) : 0),
    0
  );
  const knowledgeCount = Object.values(saved).reduce(
    (sum, g) => sum + (g.kind === "definition" || g.kind === "list" ? activeCount(g.items) : 0),
    0
  );
  const collectionsCount = Object.keys(collections || {}).length;
  const effectProfilesCount = Object.keys(effectProfiles || {}).length;
  const totalWordsCount = Object.values(words || {}).reduce((sum, g) => sum + g.words.length, 0);
  const dueCount = countDue(saved);
  const isTab = view === "search" || view === "dex" || view === "effects";
  const showSearchBar = view === "search" && !detailTarget && !compareTarget;
  const showDexNav = view === "dex" && !detailTarget && !compareTarget;
  const matchingHistory = query.trim()
    ? history.filter((h) => h.term.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : [];

  return (
    <div
      style={{
        height: "100dvh",
        maxHeight: "100dvh",
        overflow: "hidden",
        background: "var(--page-bg)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <style>{`
        :root {
          ${Object.entries(THEME_VARS[theme] || THEME_VARS.light)
            .map(([k, v]) => `${k}: ${v};`)
            .join("\n          ")}
        }
        @keyframes lensPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(111,184,255,0.35), 0 0 14px rgba(111,184,255,0.7); }
          50% { box-shadow: 0 0 0 7px rgba(111,184,255,0.15), 0 0 22px rgba(111,184,255,0.9); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes flicker {
          0% { opacity: 0.3; filter: brightness(1.7); }
          40% { opacity: 1; filter: brightness(1.15); }
          100% { opacity: 1; filter: brightness(1); }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Topo do dispositivo */}
        <div
          style={{
            background: `linear-gradient(180deg, ${COLORS.shellRed}, ${COLORS.shellRedDark})`,
            padding:
              "calc(12px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 14px calc(16px + env(safe-area-inset-left))",
            flexShrink: 0,
          }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                flexShrink: 0,
                background: `radial-gradient(circle at 35% 30%, ${COLORS.lensBlueLight}, ${COLORS.lensBlue} 60%, #1B4F7A 100%)`,
                border: "3px solid #1B2A33",
                boxShadow: loading ? undefined : "0 0 0 3px rgba(0,0,0,0.15)",
                animation: loading ? "lensPulse 1s ease-in-out infinite" : "none",
              }}
            />
            <div className="flex gap-1.5">
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORS.gold, border: "1.5px solid #7A5A00" }} />
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6A9955", border: "1.5px solid #2E4A1F" }} />
            </div>
            <h1
              style={{
                flex: 1,
                fontFamily: '"Baloo 2", sans-serif',
                color: COLORS.white,
                fontWeight: 800,
                fontSize: "19px",
                letterSpacing: "0.01em",
                textShadow: "0 2px 0 rgba(0,0,0,0.2)",
                margin: 0,
              }}
            >
              Bookdex
            </h1>
            <button onClick={() => openScreen("review")} aria-label="Revisão espaçada" title="Revisão espaçada" style={{ ...iconButtonStyle, position: "relative" }}>
              <Brain size={17} />
              {dueCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-3px",
                    right: "-3px",
                    background: COLORS.gold,
                    color: "#4A3300",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 700,
                    fontSize: "9px",
                    borderRadius: "999px",
                    minWidth: "15px",
                    height: "15px",
                    padding: "0 3px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid #7A5A00",
                  }}
                >
                  {dueCount > 99 ? "99+" : dueCount}
                </span>
              )}
            </button>
            <button onClick={() => openScreen("import")} aria-label="Importar dados" title="Importar dados" style={iconButtonStyle}>
              <Upload size={17} />
            </button>
            <button onClick={() => openScreen("settings")} aria-label="Configurações" title="Configurações" style={iconButtonStyle}>
              <SettingsIcon size={17} />
            </button>
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "rgba(255,255,255,0.8)", marginBottom: "12px", marginLeft: "2px" }}>
            tec: técnicas · def: conceitos · list: tipos · cmp: comparar
          </p>
          <div className="flex gap-2">
            <button onClick={() => goTab("search")} style={tabStyle(view === "search")}>
              BUSCAR
            </button>
            <button onClick={() => goTab("dex")} style={tabStyle(view === "dex")}>
              POKÉDEX ({totalSavedCount})
            </button>
            <button onClick={() => goTab("effects")} style={tabStyle(view === "effects")}>
              EFEITOS ({effectProfilesCount})
            </button>
          </div>
        </div>

        {/* Tela */}
        <div
          style={{
            background: COLORS.screenBg,
            borderTop: `4px solid ${COLORS.screenBorder}`,
            borderBottom: `4px solid ${COLORS.screenBorder}`,
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "14px",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              backgroundImage:
                "repeating-linear-gradient(180deg, rgba(0,0,0,0.035) 0px, rgba(0,0,0,0.035) 1px, transparent 1px, transparent 3px)",
            }}
          />
          <div style={{ position: "relative" }}>
            {!isOnline && (
              <div
                className="flex items-center gap-2"
                style={{
                  background: "var(--danger)",
                  color: COLORS.white,
                  borderRadius: "8px",
                  padding: "8px 10px",
                  marginBottom: "12px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11.5px",
                }}
              >
                <WifiOff size={15} style={{ flexShrink: 0 }} />
                <span>Sem conexão com a internet. Buscas e sincronização vão falhar até a conexão voltar.</span>
              </div>
            )}

            {detailTarget && (
              <DetailPage
                key={`${slug(detailTarget.subjectDisplay)}:${detailTarget.technique.id || slug(detailTarget.technique.name)}`}
                subjectDisplay={detailTarget.subjectDisplay}
                technique={detailTarget.technique}
                cacheKey={`${slug(detailTarget.subjectDisplay)}:${detailTarget.technique.id || slug(detailTarget.technique.name)}`}
                detailCache={detailCache}
                onCached={cacheDetail}
                onBack={() => setDetailTarget(null)}
                onGoSettings={() => openScreen("settings")}
              />
            )}

            {!detailTarget && !compareTarget && view === "search" && (
              <SearchView
                query={query}
                searchMode={searchMode}
                loading={loading}
                error={error}
                needsKey={needsKey || (!hasKey && !result)}
                result={result}
                scanCount={scanCount}
                history={history}
                isSaved={isSaved}
                onToggleSave={toggleSave}
                onOpenDetail={openDetail}
                onRetry={() => handleSearch()}
                onRunHistoryTerm={runHistoryTerm}
                onGoSettings={() => openScreen("settings")}
                onSearchRelated={searchRelated}
                hasDetail={hasDetail}
                isIrrelevant={isItemIrrelevant}
                onMarkIrrelevant={markItemIrrelevant}
              />
            )}

            {!detailTarget && !compareTarget && view === "dex" && (
              <DexView
                saved={saved}
                detailCache={detailCache}
                storageLoaded={storageLoaded}
                category={dexCategory}
                onCategoryChange={setDexCategory}
                onToggleSave={toggleSave}
                onOpenDetail={openDetail}
                hasDetail={hasDetail}
                onOpenImport={() => openScreen("import")}
                onRemoveGroup={removeGroup}
                onUpdateTags={updateItemTags}
                onUpdateNote={updateItemNote}
                onUpdateImages={updateItemImages}
                onLinkItems={linkItems}
                onUnlinkItems={unlinkItems}
                onSearchRelated={searchRelated}
                onExampleSearch={(mode, term) => searchRelated(mode, term)}
                onOpenCompare={openCompare}
                onBulkRemoveItems={bulkRemoveItems}
                onBulkAddTag={bulkAddTag}
                onArchiveItems={archiveItems}
                showArchived={showArchived}
                onToggleShowArchived={() => setShowArchived((v) => !v)}
                collections={collections}
                onCreateCollection={createCollection}
                onDeleteCollection={deleteCollection}
                onAddToCollection={addToCollection}
                onRemoveFromCollection={removeFromCollection}
                suggestions={suggestions}
                suggestionsLoading={suggestionsLoading}
                suggestionsError={suggestionsError}
                onGenerateSuggestions={generateSuggestions}
                words={words}
                onToggleWord={toggleWordSave}
                isWordSaved={isWordSaved}
                onRemoveWordGroup={removeWordGroup}
                onUpdateWordTags={updateWordTags}
                onUpdateWordNote={updateWordNote}
                onUpdateWordCharacterComponent={updateWordCharacterComponent}
                searchEffort={searchEffort}
              />
            )}

            {compareTarget && <CompareView items={compareTarget} onBack={() => setCompareTarget(null)} />}

            {!detailTarget && !compareTarget && view === "review" && (
              <ReviewView saved={saved} onBack={backToTab} onGrade={gradeReviewItem} />
            )}

            {!detailTarget && !compareTarget && view === "effects" && (
              <EffectsSection
                profiles={effectProfiles}
                onCreateProfile={createEffectProfile}
                onDeleteProfile={deleteEffectProfile}
                onAddCriterion={addEffectCriterion}
                onRemoveCriterion={removeEffectCriterion}
                onAddItem={addEffectItem}
                onRemoveItem={removeEffectItem}
                onToggleItemActive={toggleEffectItemActive}
                onUpdateItemRating={updateEffectItemRating}
                onUpdateItemNote={updateEffectItemNote}
              />
            )}

            {!detailTarget && view === "settings" && (
              <SettingsView
                onBack={backToTab}
                onCredentialsChanged={async () => {
                  const ok = await hasCredentials();
                  setHasKey(ok);
                  if (ok) setNeedsKey(false);
                }}
                theme={theme}
                onThemeChange={changeTheme}
                notificationsEnabled={notificationsEnabled}
                onNotificationsChange={changeNotifications}
                gamification={gamification}
                totalSavedCount={totalSavedCount}
                prefetchDetailsEnabled={prefetchDetailsEnabled}
                onPrefetchDetailsChange={changePrefetchDetails}
                searchEffort={searchEffort}
                onSearchEffortChange={changeSearchEffort}
              />
            )}

            {!detailTarget && view === "import" && (
              <ImportView onBack={backToTab} onImport={applyImport} saved={saved} detailCache={detailCache} collections={collections} />
            )}
          </div>

          {toast && (
            <div
              style={{
                position: "sticky",
                bottom: "4px",
                left: 0,
                width: "100%",
                display: "flex",
                justifyContent: "center",
                pointerEvents: toast.onUndo ? "auto" : "none",
              }}
            >
              <div
                className="flex items-center gap-2"
                style={{
                  background: "#23291F",
                  color: COLORS.white,
                  padding: "8px 8px 8px 16px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontFamily: "Inter, sans-serif",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                }}
              >
                <span>{toast.msg}</span>
                {toast.onUndo && (
                  <button
                    onClick={() => {
                      toast.onUndo();
                      setToast(null);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      border: "none",
                      color: COLORS.gold,
                      fontFamily: '"Baloo 2", sans-serif',
                      fontWeight: 700,
                      fontSize: "11.5px",
                      borderRadius: "999px",
                      padding: "6px 12px",
                      cursor: "pointer",
                    }}
                  >
                    Desfazer
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Base do dispositivo */}
        <div
          style={{
            background: COLORS.shellRedDark,
            padding:
              "12px calc(16px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))",
            flexShrink: 0,
          }}
        >
          {showSearchBar ? (
            <div style={{ width: "100%", minWidth: 0 }}>
              <div className="flex gap-1.5" style={{ marginBottom: "8px" }}>
                {SEARCH_MODES.map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => setSearchMode(mode)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      minHeight: "30px",
                      borderRadius: "999px",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: '"Baloo 2", sans-serif',
                      fontWeight: 700,
                      fontSize: "11px",
                      background: searchMode === mode ? COLORS.gold : "rgba(255,255,255,0.18)",
                      color: searchMode === mode ? "#4A3300" : COLORS.white,
                      transition: "background 0.15s ease",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2" style={{ position: "relative" }}>
                {showHistorySuggestions && matchingHistory.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      background: COLORS.surface,
                      border: `2px solid ${COLORS.screenBorder}`,
                      borderRadius: "8px",
                      overflow: "hidden",
                      zIndex: 10,
                      boxShadow: "0 -4px 10px rgba(0,0,0,0.3)",
                    }}
                  >
                    {matchingHistory.map((h, i) => (
                      <button
                        key={h.mode + h.term + i}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setShowHistorySuggestions(false);
                          handleSearch({ mode: h.mode, term: h.term });
                        }}
                        className="flex items-center gap-2"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          background: "none",
                          border: "none",
                          borderBottom: i < matchingHistory.length - 1 ? `1px solid ${COLORS.screenBorder}` : "none",
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                          fontSize: "12.5px",
                          color: COLORS.ink,
                          textAlign: "left",
                        }}
                      >
                        <History size={12} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.term}</span>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "9.5px", color: "var(--text-muted)" }}>
                          {MODE_LABELS_SHORT[h.mode] || h.mode}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setShowHistorySuggestions(true)}
                  onBlur={() => setShowHistorySuggestions(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setShowHistorySuggestions(false);
                      handleSearch();
                    }
                  }}
                  placeholder={PLACEHOLDER_BY_MODE[searchMode]}
                  enterKeyHint="search"
                  style={{
                    flex: "1 1 0%",
                    minWidth: 0,
                    width: "100%",
                    borderRadius: "8px",
                    border: "none",
                    padding: "12px",
                    minHeight: "46px",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "16px",
                    outline: "none",
                  }}
                />
                {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                  <button
                    onClick={toggleVoiceSearch}
                    disabled={loading}
                    aria-label={listening ? "Parar busca por voz" : "Buscar por voz"}
                    title={listening ? "Parar busca por voz" : "Buscar por voz"}
                    style={{
                      background: listening ? COLORS.shellRedDark : "rgba(255,255,255,0.18)",
                      color: COLORS.white,
                      border: "none",
                      borderRadius: "8px",
                      minWidth: "46px",
                      minHeight: "46px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: loading ? "default" : "pointer",
                      flexShrink: 0,
                      animation: listening ? "lensPulse 1s ease-in-out infinite" : "none",
                    }}
                  >
                    {listening ? <MicOff size={17} /> : <Mic size={17} />}
                  </button>
                )}
                <button
                  onClick={() => handleSearch()}
                  disabled={loading || !query.trim()}
                  style={{
                    background: COLORS.gold,
                    color: "#4A3300",
                    fontWeight: 800,
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    minHeight: "46px",
                    fontFamily: '"Baloo 2", sans-serif',
                    fontSize: "13px",
                    whiteSpace: "nowrap",
                    cursor: loading || !query.trim() ? "default" : "pointer",
                    opacity: loading || !query.trim() ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  {loading ? "..." : "ESCANEAR"}
                </button>
              </div>
              {(searchMode === "technique" || searchMode === "compare") && (
                <input
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  placeholder="Critérios de comparação (opcional) — ex.: custo, dificuldade, tempo"
                  style={{
                    width: "100%",
                    marginTop: "8px",
                    borderRadius: "8px",
                    border: "none",
                    padding: "10px 12px",
                    minHeight: "38px",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "12.5px",
                    outline: "none",
                    background: "rgba(255,255,255,0.85)",
                  }}
                />
              )}
            </div>
          ) : showDexNav ? (
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              <button onClick={() => setDexCategory("technique")} style={tabStyle(dexCategory === "technique")}>
                TÉCNICAS ({techniqueCount})
              </button>
              <button onClick={() => setDexCategory("knowledge")} style={tabStyle(dexCategory === "knowledge")}>
                CONCEITOS &amp; TIPOS ({knowledgeCount})
              </button>
              <button onClick={() => setDexCategory("words")} style={tabStyle(dexCategory === "words")}>
                PALAVRAS ({totalWordsCount})
              </button>
              <button onClick={() => setDexCategory("collections")} style={tabStyle(dexCategory === "collections")}>
                COLEÇÕES ({collectionsCount})
              </button>
            </div>
          ) : (
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
              {view === "effects"
                ? `${effectProfilesCount} perfil(is) de efeito`
                : isTab || detailTarget
                  ? `${totalSavedCount} item(ns) registrado(s) em ${Object.keys(saved).length} assunto(s)`
                  : "Bookdex"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
