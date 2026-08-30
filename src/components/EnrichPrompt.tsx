import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { COLORS } from "../theme";
import { missingFields, needsEnrichment } from "../lib/convert";
import { estimateCost, formatCost } from "../lib/models";

const FIELD_LABELS = {
  stats: "as barras de avaliação",
  bestFor: "o “ideal para”",
  keyPoints: "os pontos-chave",
  example: "o exemplo",
  description: "a descrição",
};

/**
 * Faixa que aparece só num card recém-convertido a que ainda faltam campos
 * que a conversão local não sabe preencher. Chamar é opcional: o card é usável
 * sem isso, e a chamada à API só acontece se o usuário tocar no botão.
 */
export default function EnrichPrompt({ item, onEnrich }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  if (!onEnrich || !needsEnrichment(item)) return null;

  const pendentes = missingFields(item).map((f) => FIELD_LABELS[f] || f);
  const faltando = pendentes.join(" e ");
  const verbo = pendentes.length > 1 ? "Faltam" : "Falta";

  async function run(e) {
    e.stopPropagation();
    setLoading(true);
    setError(null);
    try {
      await onEnrich();
    } catch (err) {
      setError(err?.message || "Não foi possível completar agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "rgba(46,134,222,0.1)",
        border: `1.5px dashed ${COLORS.lensBlue}`,
        borderRadius: "8px",
        padding: "8px 10px",
        marginBottom: "9px",
      }}
    >
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink, margin: "0 0 6px", lineHeight: 1.35 }}>
        Card convertido — {verbo.toLowerCase()} {faltando}.
      </p>
      <button
        onClick={run}
        disabled={loading}
        title={`~${formatCost(estimateCost("enrichment"))}`}
        className="flex items-center gap-1"
        style={{
          background: COLORS.lensBlue,
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "6px 11px",
          fontFamily: '"Baloo 2", sans-serif',
          fontWeight: 700,
          fontSize: "11.5px",
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
        {loading ? "Completando..." : "Completar com IA"}
      </button>
      {error && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--danger)", margin: "6px 0 0" }}>{error}</p>
      )}
    </div>
  );
}
