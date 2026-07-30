import { Search, RefreshCw, KeyRound } from "lucide-react";
import { COLORS, slug, primaryButtonStyle } from "../theme";
import TechCard from "../components/TechCard";
import DefinitionCard from "../components/DefinitionCard";
import ListItemCard from "../components/ListItemCard";

const PLACEHOLDER_BY_MODE = {
  technique: "Ex.: respiração, canto, alongamentos para postura",
  definition: "Ex.: def: efeito placebo, def: juros compostos",
  list: "Ex.: list: tipos de memória, list: gêneros musicais",
};

export default function SearchView({
  query,
  loading,
  error,
  needsKey,
  result,
  scanCount,
  isSaved,
  onToggleSave,
  onOpenDetail,
  onRetry,
  onGoSettings,
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "380px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: `4px solid ${COLORS.screenBorder}`,
            borderTopColor: COLORS.lensBlue,
            animation: "spin 0.9s linear infinite",
            marginBottom: "12px",
          }}
        />
        <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "12px", color: COLORS.ink, letterSpacing: "0.04em" }}>
          ESCANEANDO "{query}"...
        </p>
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
            color: COLORS.screenBorder,
            maxWidth: "250px",
            marginTop: "4px",
            marginBottom: "14px",
          }}
        >
          Para escanear assuntos o app precisa de uma chave da API da Anthropic (sk-ant-...). Seus itens já salvos
          continuam acessíveis na Pokédex.
        </p>
        <button onClick={onGoSettings} style={primaryButtonStyle}>
          Abrir Configurações
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "380px" }}>
        <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, color: "#8a1f1f", marginBottom: "6px", fontSize: "15px" }}>
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
    const mode = query.trim().toLowerCase().startsWith("def:")
      ? "definition"
      : query.trim().toLowerCase().startsWith("list:")
        ? "list"
        : "technique";
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
          {PLACEHOLDER_BY_MODE[mode]}
        </p>
        <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px", color: COLORS.screenBorder, marginTop: "10px" }}>
          tec: técnicas &nbsp;·&nbsp; def: conceitos &nbsp;·&nbsp; list: tipos
        </p>
      </div>
    );
  }

  const { mode, data } = result;

  if (mode === "definition") {
    return (
      <div key={scanCount} style={{ animation: "flicker 0.4s ease-out" }}>
        <DefinitionCard
          definition={data}
          saved={isSaved("definition", data.term, slug(data.term))}
          onToggle={() => onToggleSave("definition", data.term, { definition: data })}
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
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#4a5540", marginBottom: "12px" }}>
          {data.subjectIntro}
        </p>
        {data.items.map((item, i) => (
          <ListItemCard
            key={item.name + i}
            index={i}
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
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#4a5540", marginBottom: "12px" }}>
        {data.subjectIntro}
      </p>
      {data.techniques.map((t, i) => (
        <TechCard
          key={t.name + i}
          index={i}
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
