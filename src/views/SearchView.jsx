import { useEffect, useState } from "react";
import { Search, RefreshCw, KeyRound, History, DatabaseZap, BookmarkCheck } from "lucide-react";
import { COLORS, slug, primaryButtonStyle } from "../theme";
import { PLACEHOLDER_BY_MODE } from "../lib/searchQuery";
import { useProgressiveMessage } from "../lib/hooks";
import { fetchDefinition } from "../lib/anthropic";
import { findSavedDefinition } from "../lib/dedupe";
import TechCard from "../components/TechCard";
import DefinitionCard from "../components/DefinitionCard";
import ListItemCard from "../components/ListItemCard";
import WordCard from "../components/WordCard";
import PlantCard from "../components/PlantCard";
import SkeletonList from "../components/Skeleton";

const SOURCE_NOTE = {
  cache: "Resultado guardado de uma busca anterior — não gastou chamada à API.",
  saved: "Você já tem isto capturado na Pokédex.",
  "saved-similar": "Você já tem uma palavra parecida capturada.",
};

/**
 * Faixa que explica quando o resultado NÃO veio da rede, com o atalho para
 * forçar uma busca nova. Sem isso, um resultado de cache passaria por recente
 * sem o usuário saber que pode pedir outro.
 */
function SourceNote({ source, onRedo }) {
  const note = SOURCE_NOTE[source];
  if (!note) return null;
  const fromCache = source === "cache";
  return (
    <div
      className="flex items-center gap-1.5"
      style={{ marginBottom: "8px", color: "var(--text-muted)", flexWrap: "wrap" }}
    >
      {fromCache ? <DatabaseZap size={13} style={{ flexShrink: 0 }} /> : <BookmarkCheck size={13} style={{ flexShrink: 0 }} />}
      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px" }}>{note}</span>
      <button
        onClick={onRedo}
        style={{
          fontFamily: '"Baloo 2", sans-serif',
          fontWeight: 700,
          fontSize: "11px",
          color: COLORS.lensBlue,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 4px",
        }}
      >
        Refazer busca
      </button>
    </div>
  );
}

export default function SearchView({
  query,
  searchMode,
  loading,
  error,
  needsKey,
  result,
  scanCount,
  history,
  isSaved,
  onToggleSave,
  onOpenDetail,
  onRetry,
  onGoSettings,
  onRunHistoryTerm,
  onSearchRelated,
  hasDetail,
  isIrrelevant,
  onMarkIrrelevant,
  isPlantSaved,
  onToggleWord,
  isWordSaved,
  saved,
}) {
  // Cards extras criados ao clicar num relacionado da mini-lista ("..."), encadeados
  // abaixo do card que os originou. Reseta a cada novo escaneamento.
  const [extraCards, setExtraCards] = useState([]);
  useEffect(() => {
    setExtraCards([]);
  }, [scanCount]);

  function addExtraCard(parentKey, definition) {
    const childKey = `${parentKey}::${slug(definition.term)}`;
    setExtraCards((prev) => (prev.some((c) => c.key === childKey) ? prev : [...prev, { key: childKey, parentKey, definition }]));
  }

  async function expandRelated(parentKey, name) {
    const already = findSavedDefinition(saved, name);
    const def = already || (await fetchDefinition(name));
    addExtraCard(parentKey, def);
  }

  function renderChildren(parentKey) {
    return extraCards
      .filter((c) => c.parentKey === parentKey)
      .map((c) => (
        <div
          key={c.key}
          style={{
            marginTop: "10px",
            marginBottom: "10px",
            paddingLeft: "10px",
            borderLeft: `2px dashed ${COLORS.screenBorder}`,
            animation: "flicker 0.4s ease-out",
          }}
        >
          <DefinitionCard
            definition={c.definition}
            saved={isSaved("definition", c.definition.term, slug(c.definition.term))}
            onToggle={() => onToggleSave("definition", c.definition.term, { definition: c.definition })}
            onSearchRelated={onSearchRelated ? (term) => onSearchRelated("definition", term) : undefined}
            onAddRelatedCard={(name) => expandRelated(c.key, name)}
          />
          {renderChildren(c.key)}
        </div>
      ));
  }

  const loadingMsg = useProgressiveMessage(loading, [
    `ESCANEANDO "${query}"...`,
    "AINDA ESCANEANDO...",
    "QUASE LÁ...",
  ]);

  if (loading) {
    return (
      <div>
        <p
          className="flex items-center gap-2"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "11.5px",
            color: COLORS.ink,
            letterSpacing: "0.03em",
            marginBottom: "14px",
          }}
        >
          <span
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "50%",
              background: COLORS.lensBlue,
              animation: "spin 0.9s linear infinite, flicker 1s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          {loadingMsg}
        </p>
        <SkeletonList count={["definition", "word", "plant"].includes(searchMode) ? 1 : 3} />
      </div>
    );
  }

  if (needsKey) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "380px" }}>
        <KeyRound size={36} strokeWidth={1.5} style={{ marginBottom: "10px", color: COLORS.screenBorder }} />
        <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "15px", color: COLORS.ink }}>
          Configure sua API key
        </p>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            color: "var(--text-muted)",
            maxWidth: "250px",
            marginTop: "4px",
            marginBottom: "6px",
          }}
        >
          Para escanear assuntos o app precisa de uma chave da API da Anthropic (sk-ant-...). Seus itens já salvos
          continuam acessíveis na Pokédex.
        </p>
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "11.5px",
            color: COLORS.lensBlue,
            marginBottom: "14px",
          }}
        >
          Criar chave em console.anthropic.com
        </a>
        <button onClick={onGoSettings} style={primaryButtonStyle}>
          Abrir Configurações
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "380px" }}>
        <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, color: "var(--danger)", marginBottom: "6px", fontSize: "15px" }}>
          Sinal perdido
        </p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: COLORS.ink, maxWidth: "240px", marginBottom: "12px" }}>
          {error}
        </p>
        <button onClick={onRetry} className="flex items-center gap-1.5" style={primaryButtonStyle}>
          <RefreshCw size={14} /> Tentar novamente
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ minHeight: "380px", color: COLORS.screenBorder }}
      >
        <Search size={36} strokeWidth={1.5} style={{ marginBottom: "10px" }} />
        <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "15px", color: COLORS.ink }}>
          Digite um assunto para escanear
        </p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", maxWidth: "240px", marginTop: "4px" }}>
          {PLACEHOLDER_BY_MODE[searchMode]}
        </p>
        <p
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "10.5px",
            color: "var(--text-muted)",
            marginTop: "10px",
            lineHeight: 1.6,
          }}
        >
          tec: técnicas &nbsp;·&nbsp; def: conceitos &nbsp;·&nbsp; list: tipos
          <br />
          cmp: comparar &nbsp;·&nbsp; pal: palavra &nbsp;·&nbsp; plt: planta
        </p>

        {!!(history && history.length) && (
          <div style={{ marginTop: "22px", width: "100%", maxWidth: "280px" }}>
            <div
              className="flex items-center justify-center gap-1.5"
              style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: COLORS.ink, marginBottom: "8px" }}
            >
              <History size={13} /> Buscas recentes
            </div>
            <div className="flex" style={{ flexWrap: "wrap", gap: "6px", justifyContent: "center" }}>
              {history.map((h, i) => (
                <button
                  key={h.mode + h.term + i}
                  onClick={() => onRunHistoryTerm(h.mode, h.term)}
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "11px",
                    color: COLORS.ink,
                    background: COLORS.surface,
                    border: `1.5px solid ${COLORS.screenBorder}`,
                    borderRadius: "999px",
                    padding: "5px 11px",
                    cursor: "pointer",
                  }}
                >
                  {h.term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const { mode, data, source } = result;
  const sourceNote = <SourceNote source={source} onRedo={onRetry} />;

  if (mode === "word") {
    return (
      <div key={scanCount} style={{ animation: "flicker 0.4s ease-out" }}>
        {sourceNote}
        <WordCard
          data={data}
          saved={isWordSaved ? isWordSaved(data.languageCode, data.language, data.word) : false}
          onToggle={onToggleWord}
        />
      </div>
    );
  }

  if (mode === "plant") {
    return (
      <div key={scanCount} style={{ animation: "flicker 0.4s ease-out" }}>
        {sourceNote}
        <PlantCard
          plant={data}
          saved={isPlantSaved ? isPlantSaved(data) : false}
          onToggle={() => onToggleSave("plant", data.family || "Plantas", { plant: data })}
        />
      </div>
    );
  }

  const isEmpty =
    (mode === "list" && (!data.items || data.items.length === 0)) ||
    ((mode === "technique" || mode === "compare") && (!data.techniques || data.techniques.length === 0));

  if (isEmpty) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ minHeight: "380px", color: COLORS.screenBorder }}
      >
        <Search size={36} strokeWidth={1.5} style={{ marginBottom: "10px" }} />
        <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "15px", color: COLORS.ink }}>
          Nenhum resultado encontrado
        </p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", maxWidth: "240px", marginTop: "4px" }}>
          Não encontramos nada para "{query}". Tente reformular o assunto ou usar termos mais gerais.
        </p>
        <button onClick={onRetry} className="flex items-center gap-1.5" style={{ ...primaryButtonStyle, marginTop: "14px" }}>
          <RefreshCw size={14} /> Tentar novamente
        </button>
      </div>
    );
  }

  if (mode === "definition") {
    return (
      <div key={scanCount} style={{ animation: "flicker 0.4s ease-out" }}>
        {sourceNote}
        <DefinitionCard
          definition={data}
          saved={isSaved("definition", data.term, slug(data.term))}
          onToggle={() => onToggleSave("definition", data.term, { definition: data })}
          onSearchRelated={onSearchRelated ? (term) => onSearchRelated("definition", term) : undefined}
          onAddRelatedCard={(name) => expandRelated("root", name)}
        />
        {renderChildren("root")}
      </div>
    );
  }

  if (mode === "list") {
    return (
      <div key={scanCount} style={{ animation: "flicker 0.4s ease-out" }}>
        {sourceNote}
        <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink }}>
          {data.subject}
        </h2>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          {data.subjectIntro}
        </p>
        {data.items.map((item, i) => {
          const itemKey = `list-${i}`;
          return (
            <div key={item.name + i}>
              <ListItemCard
                subjectDisplay={data.subject}
                item={item}
                saved={isSaved("list", data.subject, slug(item.name))}
                onToggle={() => onToggleSave("list", data.subject, { item })}
                onAddRelatedCard={(name) => expandRelated(itemKey, name)}
                irrelevant={isIrrelevant ? isIrrelevant(data.subject, item.name) : false}
                onMarkIrrelevant={onMarkIrrelevant ? () => onMarkIrrelevant(data.subject, "list", item) : undefined}
              />
              {renderChildren(itemKey)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div key={scanCount} style={{ animation: "flicker 0.4s ease-out" }}>
      {sourceNote}
      <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink }}>
        {data.subject}
      </h2>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
        {data.subjectIntro}
      </p>
      {data.techniques.map((t, i) => {
        // No modo "cmp:" cada item é seu próprio assunto (não "X vs Y"), pra
        // ficar no mesmo lugar que uma captura via "tec:" desse mesmo item.
        const subjectDisplay = mode === "compare" ? t.name : data.subject;
        return (
          <TechCard
            key={t.name + i}
            subjectDisplay={subjectDisplay}
            technique={t}
            statLabels={data.statLabels}
            saved={isSaved("technique", subjectDisplay, slug(t.name))}
            onToggle={() => onToggleSave("technique", subjectDisplay, { technique: t, statLabels: data.statLabels })}
            onOpenDetail={() => onOpenDetail(subjectDisplay, { ...t, statLabels: data.statLabels })}
            hasDetail={hasDetail ? hasDetail(subjectDisplay, t) : false}
            irrelevant={isIrrelevant ? isIrrelevant(subjectDisplay, t.name) : false}
            onMarkIrrelevant={onMarkIrrelevant ? () => onMarkIrrelevant(subjectDisplay, "technique", t) : undefined}
          />
        );
      })}
    </div>
  );
}
