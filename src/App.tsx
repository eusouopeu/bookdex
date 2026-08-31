import { useEffect, useReducer, useRef, useState } from "react";
import { Settings as SettingsIcon, Upload, WifiOff, History, Camera } from "lucide-react";
import { COLORS, THEME_VARS, slug, tabStyle, iconButtonStyle } from "./theme";
import {
  fetchTechniques,
  fetchDefinition,
  fetchList,
  fetchCompare,
  fetchWord,
  fetchPlantByName,
  fetchPlantFromPhoto,
  hasCredentials,
  searchModelFor,
  MissingApiKeyError,
} from "./lib/anthropic";
import { parseSearchQuery, hasExplicitPrefix, splitCompareTerms, PLACEHOLDER_BY_MODE } from "./lib/searchQuery";
import { cacheKey, readCache, writeCache, loadSearchCache, saveSearchCache } from "./lib/searchCache";
import { findSavedWord } from "./lib/words";
import { findSavedDefinition } from "./lib/dedupe";
import { readAndCompressImage } from "./lib/imageUtils";
import { useData } from "./state/DataContext";
import { usePrefs } from "./state/PrefsContext";
import { searchReducer, initialSearchState } from "./state/searchReducer";

import SearchView from "./views/SearchView";
import DexView from "./views/DexView";
import DetailPage from "./views/DetailPage";
import SettingsView from "./views/SettingsView";
import ImportView from "./views/ImportView";
import CompareView from "./views/CompareView";
import CollectionsSection from "./components/CollectionsSection";
import SinergiaModule from "./modules/sinergia/SinergiaModule";

const SEARCH_MODES = [
  { mode: "technique", label: "Técnicas" },
  { mode: "list", label: "Tipos" },
  { mode: "compare", label: "Comparar" },
  { mode: "definition", label: "Conceito" },
  { mode: "word", label: "Palavra" },
];
const MODE_LABELS_SHORT = {
  technique: "téc",
  definition: "def",
  list: "list",
  compare: "cmp",
  word: "pal",
  plant: "plt",
};
const CRITERIA_MODES = ["technique", "list", "compare"];

const MODULE_COLORS = {
  bookdex: { main: COLORS.lensBlue, light: COLORS.lensBlueLight, label: "Bookdex" },
  sinergia: { main: COLORS.moduleYellow, light: COLORS.moduleYellowLight, label: "Sinergia" },
  plants: { main: COLORS.moduleGreen, light: COLORS.moduleGreenLight, label: "Plantas" },
};

export default function App() {
  const data = useData();
  const { detailCache, words, counts, toast, showToast, dismissToast } = data;
  const prefs = usePrefs();

  const [view, setView] = useState("search");
  const [lastTab, setLastTab] = useState("search");
  const [detailTarget, setDetailTarget] = useState(null);
  const [compareTarget, setCompareTarget] = useState(null);
  const [showModulePicker, setShowModulePicker] = useState(false);
  const { appModule, setAppModule } = prefs;

  const [search, dispatch] = useReducer(searchReducer, initialSearchState);
  const { query, criteria, mode: searchMode, loading, error, needsKey, result, scanCount } = search;

  const [showHistorySuggestions, setShowHistorySuggestions] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const [searchCache, setSearchCache] = useState({});
  const photoInput = useRef(null);

  // A busca é disparada de dentro de listeners e de callbacks antigos (fila
  // offline, atalho de compartilhamento); a ref garante que eles chamem SEMPRE
  // a versão atual, com o estado atual, sem re-registrar listener.
  const searchRef = useRef(null);

  useEffect(() => {
    (async () => {
      setSearchCache(await loadSearchCache());
      setHasKey(await hasCredentials());
    })();
  }, []);

  useEffect(() => {
    if (prefs.initialTab) {
      setLastTab(prefs.initialTab);
      setView(prefs.initialTab);
    }
  }, [prefs.initialTab]);

  useEffect(() => {
    async function goOnline() {
      setIsOnline(true);
      const queue = prefs.offlineQueueRef.current;
      if (queue.length) {
        showToast(`Conexão restabelecida — buscando ${queue.length} item(ns) da fila...`);
        for (const item of queue) {
          // eslint-disable-next-line no-await-in-loop
          await searchRef.current?.({ mode: item.mode, term: item.term });
        }
        prefs.clearOfflineQueue();
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

  /**
   * Texto compartilhado de outro app (Android share target). O MainActivity
   * repassa o texto como `?shared=`; aqui ele vira uma busca já disparada, e o
   * parâmetro sai da URL pra não repetir a busca a cada recarga.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("shared");
    if (!shared) return;
    window.history.replaceState({}, "", window.location.pathname);
    const { mode, term } = hasExplicitPrefix(shared)
      ? parseSearchQuery(shared)
      : { mode: "definition", term: shared.trim().slice(0, 120) };
    if (term) {
      goTab("search");
      searchRef.current?.({ mode, term });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------------------------------------------- busca */

  function persistCache(next) {
    setSearchCache(next);
    saveSearchCache(next).catch(() => {});
  }

  /** Executa a chamada de rede do modo pedido. Sem cache, sem estado. */
  async function runSearch(mode, term, critList) {
    const avoid = prefs.avoidListFor(term);
    const effort = prefs.searchEffort;
    if (mode === "definition") return await fetchDefinition(term, avoid, effort);
    if (mode === "list") return await fetchList(term, avoid, effort, critList);
    if (mode === "word") return await fetchWord(term, avoid);
    if (mode === "plant") return await fetchPlantByName(term, avoid, effort);
    if (mode === "compare") {
      const names = splitCompareTerms(term);
      if (names.length < 2) throw new Error('Informe pelo menos 2 itens separados por vírgula, ex.: "melatonina, magnésio".');
      if (names.length > 3) throw new Error("No máximo 3 itens por comparação.");
      return await fetchCompare(names, avoid, critList, effort);
    }
    return await fetchTechniques(term, avoid, critList, effort);
  }

  /**
   * `force` pula o cache e refaz a chamada — é o que o botão "Refazer busca"
   * usa. Sem ele, um termo já buscado nos mesmos parâmetros volta de graça.
   */
  async function handleSearch(override?: { mode: string; term: string } | null, { force = false } = {}) {
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

    // Palavra já capturada não gasta chamada: o verbete salvo é a resposta.
    if (mode === "word" && !force) {
      const match = findSavedWord(words, term);
      if (match) {
        dispatch({ type: "success", mode, term, data: match.item, source: match.exact ? "saved" : "saved-similar" });
        prefs.addToHistory(mode, term);
        return;
      }
    }

    const critList = criteria.split(",").map((c) => c.trim()).filter(Boolean);
    const key = cacheKey({ mode, term, criteria: critList, effort: prefs.searchEffort, model: await searchModelFor(mode) });

    if (!force) {
      const hit = readCache(searchCache, key);
      if (hit) {
        dispatch({ type: "success", mode, term, data: hit.data, source: "cache", cacheKey: key });
        prefs.addToHistory(mode, term);
        return;
      }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      prefs.enqueueOffline(mode, term);
      dispatch({ type: "queuedOffline", mode, term });
      showToast(`Sem internet — "${term}" foi enfileirado(a) e será buscado(a) ao reconectar.`);
      return;
    }

    dispatch({ type: "start", mode, term });
    try {
      const payload = await runSearch(mode, term, critList);
      dispatch({ type: "success", mode, term, data: payload, source: "network", cacheKey: key });
      persistCache(writeCache(searchCache, key, payload));
      prefs.addToHistory(mode, term);
    } catch (e) {
      console.error(e);
      if (e instanceof MissingApiKeyError) dispatch({ type: "missingKey" });
      else dispatch({ type: "failure", error: e.message || "Não foi possível escanear esse assunto agora. Tente novamente." });
    }
  }

  searchRef.current = handleSearch;

  /** Identificação de planta por foto — não passa por cache (a foto é única). */
  async function handlePhotoSearch(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file || loading) return;
    dispatch({ type: "start", mode: "plant", term: "foto" });
    try {
      const dataUrl = await readAndCompressImage(file);
      const plant = await fetchPlantFromPhoto([dataUrl], prefs.searchEffort);
      dispatch({ type: "success", mode: "plant", term: plant.commonNames?.[0] || "foto", data: plant, source: "network" });
    } catch (err) {
      console.error(err);
      if (err instanceof MissingApiKeyError) dispatch({ type: "missingKey" });
      else dispatch({ type: "failure", error: err.message || "Não foi possível identificar a planta desta foto." });
    }
  }

  /**
   * Termo relacionado tocado (chip de conceito/técnica): se já está capturado
   * em QUALQUER assunto, abre o card salvo direto — sem gastar uma chamada
   * pra algo que a Pokédex já tem.
   */
  function searchRelated(mode, term) {
    setDetailTarget(null);
    setCompareTarget(null);
    goTab("search");
    if (mode === "definition") {
      const match = findSavedDefinition(data.saved, term);
      if (match) {
        dispatch({ type: "success", mode, term, data: match, source: "saved" });
        prefs.addToHistory(mode, term);
        return;
      }
    }
    handleSearch({ mode, term });
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
    prefs.rememberTab(tab);
  }

  function switchModule(mod) {
    setShowModulePicker(false);
    if (mod === appModule) return;
    if (mod === "plants") {
      prefs.setDexCategory("plants");
      dispatch({ type: "setMode", mode: "plant" });
      setDetailTarget(null);
      setCompareTarget(null);
      setView((v) => (v === "collections" || v === "settings" || v === "import" ? "search" : v));
    } else if (appModule === "plants") {
      prefs.setDexCategory("technique");
      dispatch({ type: "setMode", mode: "technique" });
    }
    setAppModule(mod);
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

  const isTab = view === "search" || view === "dex" || view === "collections";
  const showSearchBar = view === "search" && !detailTarget && !compareTarget;
  const showDexNav = view === "dex" && !detailTarget && !compareTarget;
  const matchingHistory = query.trim()
    ? prefs.history.filter((h) => h.term.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
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
          ${Object.entries(THEME_VARS[prefs.theme] || THEME_VARS.light)
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
          <div className="flex items-center gap-3 mb-1" style={{ position: "relative" }}>
            <button
              onClick={() => setShowModulePicker((v) => !v)}
              aria-label={`Módulo atual: ${MODULE_COLORS[appModule].label}. Trocar módulo.`}
              title={`Módulo: ${MODULE_COLORS[appModule].label}`}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                flexShrink: 0,
                padding: 0,
                background: `radial-gradient(circle at 35% 30%, ${MODULE_COLORS[appModule].light}, ${MODULE_COLORS[appModule].main} 60%, #1B4F7A 100%)`,
                border: "3px solid #1B2A33",
                boxShadow: loading ? undefined : "0 0 0 3px rgba(0,0,0,0.15)",
                animation: loading ? "lensPulse 1s ease-in-out infinite" : "none",
                cursor: "pointer",
              }}
            />
            {showModulePicker && (
              <div
                className="flex items-center gap-2"
                style={{
                  position: "absolute",
                  top: "48px",
                  left: 0,
                  zIndex: 20,
                  background: COLORS.surface,
                  border: `2px solid ${COLORS.screenBorder}`,
                  borderRadius: "999px",
                  padding: "6px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                }}
              >
                {Object.entries(MODULE_COLORS).map(([mod, c]) => (
                  <button
                    key={mod}
                    onClick={() => switchModule(mod)}
                    aria-label={c.label}
                    title={c.label}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: mod === appModule ? "3px solid #1B2A33" : "2px solid rgba(0,0,0,0.25)",
                      background: `radial-gradient(circle at 35% 30%, ${c.light}, ${c.main} 60%, #1B4F7A 100%)`,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            )}
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
              {MODULE_COLORS[appModule].label}
            </h1>
            {appModule !== "sinergia" && (
              <>
                <button onClick={() => openScreen("import")} aria-label="Importar dados" title="Importar dados" style={iconButtonStyle}>
                  <Upload size={17} />
                </button>
                <button onClick={() => openScreen("settings")} aria-label="Configurações" title="Configurações" style={iconButtonStyle}>
                  <SettingsIcon size={17} />
                </button>
              </>
            )}
          </div>
          {appModule !== "sinergia" && (
            <div className="flex gap-2" style={{ marginTop: "6px" }}>
              <button onClick={() => goTab("search")} style={tabStyle(view === "search")}>
                BUSCAR
              </button>
              <button onClick={() => goTab("dex")} style={tabStyle(view === "dex")}>
                POKÉDEX ({counts.total})
              </button>
              {appModule === "bookdex" && (
                <button onClick={() => goTab("collections")} style={tabStyle(view === "collections")}>
                  COLEÇÕES ({counts.collections})
                </button>
              )}
            </div>
          )}
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

            {appModule === "sinergia" ? (
              <SinergiaModule />
            ) : (
              <>
            {detailTarget && (
              <DetailPage
                key={detailKey}
                subjectDisplay={detailTarget.subjectDisplay}
                technique={detailTarget.technique}
                cacheKey={detailKey}
                detailCache={detailCache}
                onCached={data.cacheDetail}
                onDeleteDetail={data.deleteDetail}
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
                history={prefs.history}
                isSaved={data.isSaved}
                isPlantSaved={data.isPlantSaved}
                isWordSaved={data.isWordSaved}
                onToggleSave={data.toggleSave}
                onToggleWord={data.toggleWordSave}
                onOpenDetail={openDetail}
                onRetry={() => handleSearch(null, { force: true })}
                onRunHistoryTerm={(mode, term) => handleSearch({ mode, term })}
                onGoSettings={() => openScreen("settings")}
                onSearchRelated={searchRelated}
                hasDetail={data.hasDetail}
                isIrrelevant={prefs.isItemIrrelevant}
                onMarkIrrelevant={(subject, mode, item) => prefs.markItemIrrelevant(subject, mode, item, showToast)}
                saved={data.saved}
              />
            )}

            {!detailTarget && !compareTarget && view === "dex" && (
              <DexView
                onOpenDetail={openDetail}
                onOpenImport={() => openScreen("import")}
                onSearchRelated={searchRelated}
                onExampleSearch={(mode, term) => searchRelated(mode, term)}
                onOpenCompare={openCompare}
              />
            )}

            {!detailTarget && !compareTarget && view === "collections" && (
              <CollectionsSection
                collections={data.collections}
                saved={data.saved}
                detailCache={detailCache}
                onCreateCollection={data.createCollection}
                onDeleteCollection={data.deleteCollection}
                onRemoveFromCollection={data.removeFromCollection}
                onAddToCollection={data.addToCollection}
                onToggleSave={data.toggleSave}
                onOpenDetail={openDetail}
                hasDetail={data.hasDetail}
                onUpdateTags={data.updateItemTags}
                onUpdateNote={data.updateItemNote}
                onUpdateImages={data.updateItemImages}
                onUpdateItemAspect={data.updateItemAspect}
                onSearchRelated={searchRelated}
              />
            )}

            {compareTarget && <CompareView items={compareTarget} onBack={() => setCompareTarget(null)} />}

            {!detailTarget && view === "settings" && (
              <SettingsView
                onBack={backToTab}
                onCredentialsChanged={async () => {
                  const ok = await hasCredentials();
                  setHasKey(ok);
                  if (ok) dispatch({ type: "clearNeedsKey" });
                }}
                searchCache={searchCache}
                onClearSearchCache={() => persistCache({})}
              />
            )}

            {!detailTarget && view === "import" && <ImportView onBack={backToTab} />}
              </>
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
        {appModule !== "sinergia" && (
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
              {CRITERIA_MODES.includes(searchMode) && (
                <input
                  value={criteria}
                  onChange={(e) => dispatch({ type: "setCriteria", criteria: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  placeholder="Critérios de comparação (opcional) — ex.: custo, dificuldade, tempo"
                  style={{
                    width: "100%",
                    marginBottom: "6px",
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
              {appModule === "bookdex" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "6px",
                  marginBottom: "6px",
                }}
              >
                {SEARCH_MODES.map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => dispatch({ type: "setMode", mode })}
                    style={{
                      padding: "6px 8px",
                      minHeight: "28px",
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
              )}
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
                {searchMode === "plant" && (
                  <>
                    <button
                      onClick={() => photoInput.current && photoInput.current.click()}
                      disabled={loading}
                      aria-label="Identificar planta por foto"
                      title="Identificar planta por foto"
                      style={{
                        background: "rgba(255,255,255,0.18)",
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
                      }}
                    >
                      <Camera size={17} />
                    </button>
                    <input
                      ref={photoInput}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSearch}
                      style={{ display: "none" }}
                    />
                  </>
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
            </div>
          ) : showDexNav && appModule === "bookdex" ? (
            <DexCategoryNav counts={counts} />
          ) : (
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
              {view === "collections"
                ? `${counts.collections} coleções`
                : isTab || detailTarget
                  ? `${counts.total} item(ns) registrado(s) em ${counts.subjects} assunto(s)`
                  : MODULE_COLORS[appModule].label}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

/**
 * As categorias da Pokédex vivem na barra de baixo (aqui) mas quem filtra por
 * elas é o DexView, do outro lado da tela — por isso a categoria corrente mora
 * no PrefsContext, e não em nenhum dos dois.
 */
function DexCategoryNav({ counts }) {
  const { dexCategory, setDexCategory } = usePrefs();
  return (
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
    </div>
  );
}
