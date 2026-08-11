import { useCallback, useEffect, useState } from "react";
import { Settings as SettingsIcon, Upload, WifiOff } from "lucide-react";
import { COLORS, slug, tabStyle, iconButtonStyle } from "./theme";
import { getJSON, setJSON, KEYS } from "./lib/storage";
import { fetchTechniques, fetchDefinition, fetchList, hasCredentials, MissingApiKeyError } from "./lib/anthropic";
import { parseSearchQuery, hasExplicitPrefix, PLACEHOLDER_BY_MODE } from "./lib/searchQuery";
import { mergeData } from "./lib/importer";

const SEARCH_MODES = [
  { mode: "technique", label: "Técnicas" },
  { mode: "definition", label: "Conceito" },
  { mode: "list", label: "Tipos" },
];
const MAX_HISTORY = 8;
import SearchView from "./views/SearchView";
import DexView from "./views/DexView";
import DetailPage from "./views/DetailPage";
import SettingsView from "./views/SettingsView";
import ImportView from "./views/ImportView";

export default function App() {
  const [view, setView] = useState("search");
  const [lastTab, setLastTab] = useState("search");
  const [detailTarget, setDetailTarget] = useState(null);

  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState("technique");
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

  useEffect(() => {
    (async () => {
      setSaved(await getJSON(KEYS.saved, {}));
      setDetailCache(await getJSON(KEYS.details, {}));
      setHistory(await getJSON(KEYS.searchHistory, []));
      const savedTab = await getJSON(KEYS.lastTab, "search");
      if (savedTab === "search" || savedTab === "dex") {
        setLastTab(savedTab);
        setView(savedTab);
      }
      setStorageLoaded(true);
      setHasKey(await hasCredentials());
    })();
  }, []);

  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
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
  }, []);

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
      showToast(`${technique.name} capturado(a)!`);
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
      showToast(`${itemName} capturado(a)!`);
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

  function toggleSave(mode, subjectDisplay, payload) {
    if (mode === "technique") {
      toggleTechniqueSave(subjectDisplay, payload.technique, payload.statLabels);
    } else {
      toggleKnowledgeSave(mode, subjectDisplay, payload);
    }
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
    setSearchMode(mode);
    setQuery(term);
    setLoading(true);
    setError(null);
    setNeedsKey(false);
    try {
      let data;
      if (mode === "definition") data = await fetchDefinition(term);
      else if (mode === "list") data = await fetchList(term);
      else data = await fetchTechniques(term);
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

  function openDetail(subjectDisplay, technique) {
    setDetailTarget({ subjectDisplay, technique });
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
    showToast("Dados importados!");
    return stats;
  }

  function goTab(tab) {
    setDetailTarget(null);
    setLastTab(tab);
    setView(tab);
    setJSON(KEYS.lastTab, tab).catch(() => {});
  }

  function openScreen(screen) {
    setDetailTarget(null);
    setView(screen);
  }

  function backToTab() {
    setDetailTarget(null);
    setView(lastTab);
  }

  const totalSavedCount = Object.values(saved).reduce(
    (sum, g) => sum + (g.kind === "definition" || g.kind === "list" ? g.items.length : g.techniques.length),
    0
  );
  const isTab = view === "search" || view === "dex";
  const showSearchBar = view === "search" && !detailTarget;

  return (
    <div
      style={{
        height: "100dvh",
        maxHeight: "100dvh",
        overflow: "hidden",
        background: "#e8e6df",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <style>{`
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
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "rgba(255,255,255,0.8)", marginBottom: "12px", marginLeft: "2px" }}>
            tec: técnicas · def: conceitos · list: tipos
          </p>
          <div className="flex gap-2">
            <button onClick={() => goTab("search")} style={tabStyle(view === "search")}>
              BUSCAR
            </button>
            <button onClick={() => goTab("dex")} style={tabStyle(view === "dex")}>
              MINHA POKÉDEX ({totalSavedCount})
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
                  background: "#8a1f1f",
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

            {!detailTarget && view === "search" && (
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
              />
            )}

            {!detailTarget && view === "dex" && (
              <DexView
                saved={saved}
                storageLoaded={storageLoaded}
                onToggleSave={toggleSave}
                onOpenDetail={openDetail}
                onOpenImport={() => openScreen("import")}
                onRemoveGroup={removeGroup}
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
              />
            )}

            {!detailTarget && view === "import" && (
              <ImportView onBack={backToTab} onImport={applyImport} saved={saved} detailCache={detailCache} />
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
                  background: COLORS.ink,
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
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
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
            </div>
          ) : (
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
              {isTab || detailTarget
                ? `${totalSavedCount} item(ns) registrado(s) em ${Object.keys(saved).length} assunto(s)`
                : "Bookdex"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
