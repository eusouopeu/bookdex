import { useEffect, useReducer, useRef, useState } from "react";
import { Settings as SettingsIcon, Upload, WifiOff, Mic, MicOff, History } from "lucide-react";
import { COLORS, THEME_VARS, slug, tabStyle, iconButtonStyle } from "./theme";
import { getJSON, setJSON, KEYS } from "./lib/storage";
import {
  fetchTechniques,
  fetchDefinition,
  fetchList,
  fetchCompare,
  hasCredentials,
  getSearchEffort,
  setSearchEffort as persistSearchEffort,
  MissingApiKeyError,
} from "./lib/anthropic";
import { parseSearchQuery, hasExplicitPrefix, splitCompareTerms, PLACEHOLDER_BY_MODE } from "./lib/searchQuery";
import { recordVisit } from "./lib/gamification";
import { createProfileId, createCriterionId, createItemId, clampRating, initEffectProfiles } from "./lib/effectProfiles";
import {
  initRelevanceState,
  markIrrelevant as markIrrelevantState,
  unmarkIrrelevant as unmarkIrrelevantState,
  isMarkedIrrelevant,
  avoidListForSubject,
  tasteAvoidList,
} from "./lib/relevance";
import { useData } from "./state/DataContext";
import { searchReducer, initialSearchState } from "./state/searchReducer";

import SearchView from "./views/SearchView";
import DexView from "./views/DexView";
import DetailPage from "./views/DetailPage";
import SettingsView from "./views/SettingsView";
import ImportView from "./views/ImportView";
import CompareView from "./views/CompareView";
import EffectsSection from "./components/EffectsSection";

const SEARCH_MODES = [
  { mode: "technique", label: "Técnicas" },
  { mode: "list", label: "Tipos" },
  { mode: "definition", label: "Conceito" },
  { mode: "compare", label: "Comparar" },
];
const MAX_HISTORY = 8;
const MODE_LABELS_SHORT = { technique: "téc", definition: "def", list: "list", compare: "cmp" };

export default function App() {
  const data = useData();
  const { detailCache, counts, toast, showToast, dismissToast } = data;

  const [view, setView] = useState("search");
  const [lastTab, setLastTab] = useState("search");
  const [detailTarget, setDetailTarget] = useState(null);
  const [compareTarget, setCompareTarget] = useState(null);

  const [search, dispatch] = useReducer(searchReducer, initialSearchState);
  const { query, criteria, mode: searchMode, loading, error, needsKey, result, scanCount } = search;

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [showHistorySuggestions, setShowHistorySuggestions] = useState(false);

  const [hasKey, setHasKey] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const [theme, setTheme] = useState("light");
  const [offlineQueue, setOfflineQueue] = useState([]);
  const offlineQueueRef = useRef([]);
  const [gamification, setGamification] = useState(null);
  const [relevance, setRelevance] = useState(initRelevanceState());
  const [dexCategory, setDexCategory] = useState("technique"); // technique | knowledge | words | collections
  const [effectProfiles, setEffectProfiles] = useState(initEffectProfiles());
  const [searchEffort, setSearchEffortState] = useState("medium");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    (async () => {
      setHistory(await getJSON(KEYS.searchHistory, []));
      setTheme(await getJSON(KEYS.theme, "light"));
      setOfflineQueue(await getJSON(KEYS.offlineQueue, []));
      setEffectProfiles(await getJSON(KEYS.effectProfiles, initEffectProfiles()));
      setRelevance(await getJSON(KEYS.irrelevantItems, initRelevanceState()));
      setSearchEffortState(await getSearchEffort());
      const savedTab = await getJSON(KEYS.lastTab, "search");
      if (savedTab === "search" || savedTab === "dex" || savedTab === "effects") {
        setLastTab(savedTab);
        setView(savedTab);
      }
      const gState = await getJSON(KEYS.gamification, null);
      const nextG = recordVisit(gState);
      setGamification(nextG);
      setJSON(KEYS.gamification, nextG).catch(() => {});
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

  /* --------------------------------------------------------- perfis de efeito */

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
      if (profile.criteria.some((c) => c.label.toLowerCase() === clean.toLowerCase())) return prev;
      const id = createCriterionId(profile.criteria.map((c) => c.id), clean);
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
      const id = createItemId(profile.items.map((it) => it.id), clean);
      const item = { id, name: clean, active: true, ratings: ratings || {}, reasons: reasons || {}, note: note || "" };
      const next = { ...prev, [profileId]: { ...profile, items: [...profile.items, item] } };
      persistEffectProfiles(next);
      return next;
    });
    showToast(`"${clean}" adicionado(a) ao perfil.`);
  }

  function updateEffectItems(profileId, mutate) {
    setEffectProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const next = { ...prev, [profileId]: { ...profile, items: mutate(profile.items) } };
      persistEffectProfiles(next);
      return next;
    });
  }

  const removeEffectItem = (profileId, itemId) =>
    updateEffectItems(profileId, (items) => items.filter((it) => it.id !== itemId));
  const toggleEffectItemActive = (profileId, itemId) =>
    updateEffectItems(profileId, (items) => items.map((it) => (it.id === itemId ? { ...it, active: !it.active } : it)));
  const updateEffectItemRating = (profileId, itemId, criterionId, value) =>
    updateEffectItems(profileId, (items) =>
      items.map((it) => (it.id === itemId ? { ...it, ratings: { ...it.ratings, [criterionId]: clampRating(value) } } : it))
    );
  const updateEffectItemNote = (profileId, itemId, note) =>
    updateEffectItems(profileId, (items) => items.map((it) => (it.id === itemId ? { ...it, note } : it)));

  /* ------------------------------------------------------------ preferências */

  function changeSearchEffort(effort) {
    setSearchEffortState(effort);
    persistSearchEffort(effort).catch(() => {});
  }

  function changeTheme(next) {
    setTheme(next);
    setJSON(KEYS.theme, next).catch(() => {});
  }

  /* --------------------------------------------------------------- relevância */

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

  /* -------------------------------------------------------------------- busca */

  function enqueueOfflineSearch(mode, term) {
    setOfflineQueue((prev) => {
      const next = [...prev.filter((q) => !(q.mode === mode && q.term.toLowerCase() === term.toLowerCase())), { mode, term }];
      setJSON(KEYS.offlineQueue, next).catch(() => {});
      return next;
    });
    dispatch({ type: "queuedOffline", mode, term });
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
    dispatch({ type: "start", mode, term });
    try {
      let payload;
      const avoid = [...avoidListForSubject(relevance, slug(term)), ...tasteAvoidList(relevance)];
      const critList = criteria.split(",").map((c) => c.trim()).filter(Boolean);
      if (mode === "definition") payload = await fetchDefinition(term, avoid, searchEffort);
      else if (mode === "list") payload = await fetchList(term, avoid, searchEffort, critList);
      else if (mode === "compare") {
        const names = splitCompareTerms(term);
        if (names.length < 2) throw new Error('Informe pelo menos 2 itens separados por vírgula, ex.: "melatonina, magnésio".');
        if (names.length > 3) throw new Error("No máximo 3 itens por comparação.");
        payload = await fetchCompare(names, avoid, critList, searchEffort);
      } else payload = await fetchTechniques(term, avoid, critList, searchEffort);
      dispatch({ type: "success", mode, data: payload });
      addToHistory(mode, term);
    } catch (e) {
      console.error(e);
      if (e instanceof MissingApiKeyError) dispatch({ type: "missingKey" });
      else dispatch({ type: "failure", error: e.message || "Não foi possível escanear esse assunto agora. Tente novamente." });
    }
  }

  function searchRelated(mode, term) {
    setDetailTarget(null);
    setCompareTarget(null);
    setLastTab("search");
    setView("search");
    setJSON(KEYS.lastTab, "search").catch(() => {});
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

  /* ---------------------------------------------------------------- navegação */

  function openDetail(subjectDisplay, technique) {
    setCompareTarget(null);
    setDetailTarget({ subjectDisplay, technique });
  }

  function openCompare(items) {
    setDetailTarget(null);
    setCompareTarget(items);
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

  const effectProfilesCount = Object.keys(effectProfiles || {}).length;
  const isTab = view === "search" || view === "dex" || view === "effects";
  const showSearchBar = view === "search" && !detailTarget && !compareTarget;
  const showDexNav = view === "dex" && !detailTarget && !compareTarget;
  const matchingHistory = query.trim()
    ? history.filter((h) => h.term.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : [];
  const detailKey = detailTarget
    ? `${slug(detailTarget.subjectDisplay)}:${detailTarget.technique.id || slug(detailTarget.technique.name)}`
    : null;

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
            <button onClick={() => openScreen("import")} aria-label="Importar dados" title="Importar dados" style={iconButtonStyle}>
              <Upload size={17} />
            </button>
            <button onClick={() => openScreen("settings")} aria-label="Configurações" title="Configurações" style={iconButtonStyle}>
              <SettingsIcon size={17} />
            </button>
          </div>
          <div className="flex gap-2" style={{ marginTop: "6px" }}>
            <button onClick={() => goTab("search")} style={tabStyle(view === "search")}>
              BUSCAR
            </button>
            <button onClick={() => goTab("dex")} style={tabStyle(view === "dex")}>
              POKÉDEX ({counts.total})
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
                key={detailKey}
                subjectDisplay={detailTarget.subjectDisplay}
                technique={detailTarget.technique}
                cacheKey={detailKey}
                detailCache={detailCache}
                onCached={data.cacheDetail}
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
                isSaved={data.isSaved}
                onToggleSave={data.toggleSave}
                onOpenDetail={openDetail}
                onRetry={() => handleSearch()}
                onRunHistoryTerm={(mode, term) => handleSearch({ mode, term })}
                onGoSettings={() => openScreen("settings")}
                onSearchRelated={searchRelated}
                hasDetail={data.hasDetail}
                isIrrelevant={isItemIrrelevant}
                onMarkIrrelevant={markItemIrrelevant}
              />
            )}

            {!detailTarget && !compareTarget && view === "dex" && (
              <DexView
                category={dexCategory}
                onCategoryChange={setDexCategory}
                onOpenDetail={openDetail}
                onOpenImport={() => openScreen("import")}
                onSearchRelated={searchRelated}
                onExampleSearch={(mode, term) => searchRelated(mode, term)}
                onOpenCompare={openCompare}
                showArchived={showArchived}
                onToggleShowArchived={() => setShowArchived((v) => !v)}
                searchEffort={searchEffort}
              />
            )}

            {compareTarget && <CompareView items={compareTarget} onBack={() => setCompareTarget(null)} />}

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
                  if (ok) dispatch({ type: "clearNeedsKey" });
                }}
                theme={theme}
                onThemeChange={changeTheme}
                gamification={gamification}
                totalSavedCount={counts.total}
                prefetchDetailsEnabled={data.prefetchDetailsEnabled}
                onPrefetchDetailsChange={data.changePrefetchDetails}
                searchEffort={searchEffort}
                onSearchEffortChange={changeSearchEffort}
              />
            )}

            {!detailTarget && view === "import" && <ImportView onBack={backToTab} />}
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
                      dismissToast();
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
              "9px calc(16px + env(safe-area-inset-right)) calc(9px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))",
            flexShrink: 0,
          }}
        >
          {showSearchBar ? (
            <div style={{ width: "100%", minWidth: 0 }}>
              <div className="flex gap-1.5" style={{ marginBottom: "6px" }}>
                {SEARCH_MODES.map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => dispatch({ type: "setMode", mode })}
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      minHeight: "26px",
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
                  onChange={(e) => dispatch({ type: "setQuery", query: e.target.value })}
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
                    padding: "10px 12px",
                    minHeight: "40px",
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
                      minWidth: "40px",
                      minHeight: "40px",
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
                    padding: "9px 14px",
                    minHeight: "40px",
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
              {(searchMode === "technique" || searchMode === "list" || searchMode === "compare") && (
                <input
                  value={criteria}
                  onChange={(e) => dispatch({ type: "setCriteria", criteria: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  placeholder="Critérios de comparação (opcional) — ex.: custo, dificuldade, tempo"
                  style={{
                    width: "100%",
                    marginTop: "6px",
                    borderRadius: "8px",
                    border: "none",
                    padding: "8px 12px",
                    minHeight: "32px",
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
                TÉCNICAS ({counts.techniques})
              </button>
              <button onClick={() => setDexCategory("knowledge")} style={tabStyle(dexCategory === "knowledge")}>
                CONCEITOS ({counts.knowledge})
              </button>
              <button onClick={() => setDexCategory("words")} style={tabStyle(dexCategory === "words")}>
                PALAVRAS ({counts.words})
              </button>
              <button onClick={() => setDexCategory("collections")} style={tabStyle(dexCategory === "collections")}>
                COLEÇÕES ({counts.collections})
              </button>
            </div>
          ) : (
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
              {view === "effects"
                ? `${effectProfilesCount} perfil(is) de efeito`
                : isTab || detailTarget
                  ? `${counts.total} item(ns) registrado(s) em ${counts.subjects} assunto(s)`
                  : "Bookdex"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
