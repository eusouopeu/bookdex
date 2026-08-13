import { Search, RefreshCw, KeyRound, History } from "lucide-react";
import { COLORS, slug, primaryButtonStyle } from "../theme";
import { PLACEHOLDER_BY_MODE } from "../lib/searchQuery";
import { useProgressiveMessage } from "../lib/hooks";
import TechCard from "../components/TechCard";
import DefinitionCard from "../components/DefinitionCard";
import ListItemCard from "../components/ListItemCard";
import SkeletonList from "../components/Skeleton";

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
}) {
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
        <SkeletonList count={searchMode === "definition" ? 1 : 3} />
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
        <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px", color: "var(--text-muted)", marginTop: "10px" }}>
          tec: técnicas &nbsp;·&nbsp; def: conceitos &nbsp;·&nbsp; list: tipos
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

  const { mode, data } = result;
  const isEmpty =
    (mode === "list" && (!data.items || data.items.length === 0)) ||
    (mode === "technique" && (!data.techniques || data.techniques.length === 0));

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
        <DefinitionCard
          definition={data}
          saved={isSaved("definition", data.term, slug(data.term))}
          onToggle={() => onToggleSave("definition", data.term, { definition: data })}
          onSearchRelated={onSearchRelated ? (term) => onSearchRelated("definition", term) : undefined}
        />
      </div>
    );
  }

  if (mode === "list") {
    return (
      <div key={scanCount} style={{ animation: "flicker 0.4s ease-out" }}>
        <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink }}>
          {data.subject}
        </h2>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          {data.subjectIntro}
        </p>
        {data.items.map((item, i) => (
          <ListItemCard
            key={item.name + i}
            index={i}
            subjectDisplay={data.subject}
            item={item}
            saved={isSaved("list", data.subject, slug(item.name))}
            onToggle={() => onToggleSave("list", data.subject, { item })}
          />
        ))}
      </div>
    );
  }

  return (
    <div key={scanCount} style={{ animation: "flicker 0.4s ease-out" }}>
      <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink }}>
        {data.subject}
      </h2>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
        {data.subjectIntro}
      </p>
      {data.techniques.map((t, i) => (
        <TechCard
          key={t.name + i}
          index={i}
          subjectDisplay={data.subject}
          technique={t}
          statLabels={data.statLabels}
          saved={isSaved("technique", data.subject, slug(t.name))}
          onToggle={() => onToggleSave("technique", data.subject, { technique: t, statLabels: data.statLabels })}
          onOpenDetail={() => onOpenDetail(data.subject, { ...t, statLabels: data.statLabels })}
        />
      ))}
    </div>
  );
}
