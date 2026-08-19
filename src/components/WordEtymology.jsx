import { useState } from "react";
import { Landmark, Loader2, ArrowRight } from "lucide-react";
import { COLORS } from "../theme";
import { fetchWordEtymology, MissingApiKeyError } from "../lib/anthropic";

// Mesmo visual do botão "Aprofundar" do TechCard/ConceptExpand, pra ficar consistente entre os cards.
const bigBtnStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  minHeight: "40px",
  background: "transparent",
  border: `2px solid ${COLORS.screenBorder}`,
  borderRadius: "8px",
  color: COLORS.ink,
  fontFamily: '"Baloo 2", sans-serif',
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer",
  marginTop: "10px",
};

/**
 * Botão "Etimologia": busca sob demanda a origem da palavra e a cadeia de
 * formas/significados até chegar na atual. Autocontido, como ConceptExpand —
 * não persiste (a etimologia é ephemeral, refeita a cada expansão).
 */
export default function WordEtymology({ word, language }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function toggle(e) {
    e.stopPropagation();
    if (data) {
      setOpen((o) => !o);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const parsed = await fetchWordEtymology(word, language);
      setData(parsed);
      setOpen(true);
    } catch (err) {
      setError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Falhou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button onClick={toggle} aria-label="Ver etimologia" title="Ver etimologia" style={bigBtnStyle}>
        {loading ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <Landmark size={14} />}
        Etimologia
      </button>

      {error && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>
      )}

      {data && open && (
        <div
          style={{
            marginTop: "8px",
            background: "rgba(255,201,71,0.15)",
            border: `1.5px solid ${COLORS.gold}`,
            borderRadius: "8px",
            padding: "10px 12px",
          }}
        >
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "#7A5A00", marginBottom: "4px" }}>
            ORIGEM: {(data.originLanguage || "").toUpperCase()}
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text)", lineHeight: 1.45, margin: "0 0 10px" }}>
            {data.summary}
          </p>
          {!!(data.lineage || []).length && (
            <div className="flex items-center" style={{ flexWrap: "wrap", gap: "4px" }}>
              {data.lineage.map((step, i) => (
                <span key={i} className="flex items-center" style={{ gap: "4px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      background: COLORS.surface,
                      border: `1.5px solid ${COLORS.screenBorder}`,
                      borderRadius: "8px",
                      padding: "4px 8px",
                      fontFamily: "Inter, sans-serif",
                      fontSize: "11px",
                      color: COLORS.ink,
                      lineHeight: 1.3,
                    }}
                  >
                    <strong style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: "9.5px", color: "var(--text-muted)" }}>
                      {step.language}
                    </strong>
                    <br />
                    {step.form} <span style={{ color: "var(--text-muted)" }}>— {step.meaning}</span>
                  </span>
                  {i < data.lineage.length - 1 && <ArrowRight size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
