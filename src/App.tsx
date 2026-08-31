import { useEffect, useReducer, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { COLORS, THEME_VARS, slug } from "./theme";
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
import { parseSearchQuery, hasExplicitPrefix, splitCompareTerms } from "./lib/searchQuery";
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
import SinergiaModule, { SinergiaView } from "./modules/sinergia/SinergiaModule";
import AppHeader, { AppModule, AppScreen } from "./components/AppHeader";
import BottomBar from "./components/BottomBar";
import Toast from "./components/Toast";

const MODULE_COLORS: Record<AppModule, { main: string; light: string; label: string }> = {
  bookdex: { main: COLORS.lensBlue, light: COLORS.lensBlueLight, label: "Cognidex" },
  sinergia: { main: COLORS.moduleYellow, light: COLORS.moduleYellowLight, label: "Sinergidex" },
  plants: { main: COLORS.moduleGreen, light: COLORS.moduleGreenLight, label: "Vegedex" },
};

export default function App() {
  const data = useData();
  const { detailCache, words, counts, toast, showToast, dismissToast } = data;
  const prefs = usePrefs();

  const [view, setView] = useState<AppScreen>("search");
  const [lastTab, setLastTab] = useState<AppScreen>("search");
  const [detailTarget, setDetailTarget] = useState(null);
  const [compareTarget, setCompareTarget] = useState(null);
  const [showModulePicker, setShowModulePicker] = useState(false);
  const [sinergiaView, setSinergiaView] = useState<SinergiaView>("effects");
  const [pendingSinergiaProfile, setPendingSinergiaProfile] = useState<string | null>(null);
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

  function goTab(tab: AppScreen) {
    setDetailTarget(null);
    setCompareTarget(null);
    setLastTab(tab);
    setView(tab);
    prefs.rememberTab(tab);
  }

  function switchModule(mod: AppModule) {
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

  function openScreen(screen: AppScreen) {
    setDetailTarget(null);
    setCompareTarget(null);
    setView(screen);
  }

  function backToTab() {
    setDetailTarget(null);
    setCompareTarget(null);
    setView(lastTab);
  }

  /* -------------------------------------------------------- ponte cognidex↔sinergia */

  /** "Avaliar no Sinergia": troca de módulo e pede pro Sinergia abrir/criar o perfil. */
  function openInSinergia(name: string) {
    setAppModule("sinergia");
    setSinergiaView("effects");
    setPendingSinergiaProfile(name);
  }

  /** "Ver no Cognidex": troca de módulo e busca o mesmo assunto como conceito. */
  function openInCognidex(name: string) {
    setAppModule("bookdex");
    searchRelated("definition", name);
  }

  // Coleções agrupam itens de `saved`, e plantas moram no mesmo `saved` (só
  // com `kind: "plant"`) — por isso a aba vale pros dois módulos de dex; o
  // Sinergia guarda os perfis de efeito num modelo de dados próprio, sem
  // conceito de coleção.
  const showCollectionsTab = appModule === "bookdex" || appModule === "plants";
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
        <AppHeader
          appModule={appModule}
          moduleColors={MODULE_COLORS}
          loading={loading}
          showModulePicker={showModulePicker}
          onToggleModulePicker={() => setShowModulePicker((v) => !v)}
          onSwitchModule={switchModule}
          view={view}
          showCollectionsTab={showCollectionsTab}
          countsTotal={counts.total}
          countsCollections={counts.collections}
          onGoTab={goTab}
          onOpenScreen={openScreen}
          sinergiaView={sinergiaView}
          onSetSinergiaView={setSinergiaView}
        />

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
              <SinergiaModule
                view={sinergiaView}
                onViewChange={setSinergiaView}
                pendingProfileName={pendingSinergiaProfile}
                onConsumedPendingProfile={() => setPendingSinergiaProfile(null)}
                onOpenInCognidex={openInCognidex}
              />
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
                onOpenInSinergia={openInSinergia}
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

          {toast && <Toast msg={toast.msg} onUndo={toast.onUndo} onDismiss={dismissToast} />}
        </div>

        {/* Base do dispositivo */}
        {appModule !== "sinergia" && (
          <BottomBar
            appModule={appModule}
            view={view}
            showSearchBar={showSearchBar}
            showDexNav={showDexNav}
            isTab={isTab}
            hasDetailTarget={!!detailTarget}
            searchMode={searchMode}
            criteria={criteria}
            query={query}
            loading={loading}
            moduleLabel={MODULE_COLORS[appModule].label}
            countsTotal={counts.total}
            countsSubjects={counts.subjects}
            countsCollections={counts.collections}
            countsTechniques={counts.techniques}
            countsKnowledge={counts.knowledge}
            countsWords={counts.words}
            showHistorySuggestions={showHistorySuggestions}
            matchingHistory={matchingHistory}
            photoInput={photoInput}
            onSetCriteria={(criteria) => dispatch({ type: "setCriteria", criteria })}
            onSetMode={(mode) => dispatch({ type: "setMode", mode })}
            onSetQuery={(query) => dispatch({ type: "setQuery", query })}
            onSearch={() => handleSearch()}
            onRunHistoryTerm={(mode, term) => handleSearch({ mode, term })}
            onShowHistorySuggestions={setShowHistorySuggestions}
            onPhotoSearch={handlePhotoSearch}
          />
        )}
      </div>
    </div>
  );
}
