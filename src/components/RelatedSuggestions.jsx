import { Compass, RefreshCw, Sparkles } from "lucide-react";
import { COLORS } from "../theme";
import { MODE_LABELS } from "../lib/searchQuery";

/**
 * Card de sugestões de assuntos relacionados ao que já foi capturado,
 * gerado sob demanda (custa uma chamada à API) e cacheado até o usuário
 * pedir para atualizar.
 */
export default function RelatedSuggestions({ suggestions, loading, error, generatedAt, onGenerate, onPick }) {
  return (
    <div
      style={{
        background: "rgba(46,134,222,0.08)",
        border: `2px solid ${COLORS.lensBlue}`,
        borderRadius: "10px",
        padding: "10px 12px",
        marginBottom: "14px",
      }}
    >
      <div className="flex items-center gap-1.5" style={{ marginBottom: suggestions.length || loading ? "8px" : 0 }}>
        <Compass size={14} style={{ color: COLORS.lensBlue, flexShrink: 0 }} />
        <span style={{ flex: 1, fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>
          Sugestões para você
        </span>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="flex items-center gap-1"
          style={{
            background: "none",
            border: "none",
            cursor: loading ? "default" : "pointer",
            color: COLORS.lensBlue,
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "10.5px",
            padding: "4px 6px",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={11} style={loading ? { animation: "spin 0.9s linear infinite" } : undefined} />
          {suggestions.length ? "Atualizar" : "Gerar"}
        </button>
      </div>

      {error && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--danger)", margin: 0 }}>{error}</p>
      )}

      {loading && suggestions.length === 0 && (
        <p className="flex items-center gap-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)", margin: 0 }}>
          <Sparkles size={12} /> Pensando em sugestões...
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="flex" style={{ flexWrap: "wrap", gap: "6px" }}>
          {suggestions.map((s, i) => (
            <button
              key={s.term + i}
              onClick={() => onPick(s.mode, s.term)}
              title={s.reason}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "11px",
                color: COLORS.ink,
                background: COLORS.surface,
                border: `1.5px solid ${COLORS.lensBlue}`,
                borderRadius: "999px",
                padding: "5px 11px",
                cursor: "pointer",
              }}
            >
              {s.term} <span style={{ color: "var(--text-muted)", fontSize: "9.5px" }}>· {MODE_LABELS[s.mode] || s.mode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
