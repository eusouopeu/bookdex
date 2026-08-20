import { useState } from "react";
import { MoreHorizontal, Loader2, ArrowRight } from "lucide-react";
import { COLORS } from "../theme";
import { fetchRelatedConceptNames, MissingApiKeyError } from "../lib/anthropic";

// Mesmo visual do botão "Aprofundar" original, reaproveitado só pro "Relacionados" agora.
const bigBtnStyle = {
  flex: 1,
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
};

/**
 * "Relacionados" (...) reutilizado por DefinitionCard e ListItemCard, mais o
 * conteúdo expandido do "aprofundar" — cujo botão-gatilho agora mora no
 * cabeçalho do card (DeepDiveIconButton), controlado por useConceptDeepDive.
 * `deepDive` é só leitura aqui: { data, open, error }.
 */
export default function ConceptExpand({ term, category, onAddRelatedCard, deepDive }) {
  const [related, setRelated] = useState(null);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState(null);
  const [addedNames, setAddedNames] = useState([]);
  const [loadingNames, setLoadingNames] = useState([]);
  const [pickError, setPickError] = useState(null);

  async function toggleRelated(e) {
    e.stopPropagation();
    if (related) {
      setRelatedOpen((o) => !o);
      return;
    }
    setRelatedLoading(true);
    setRelatedError(null);
    try {
      const names = await fetchRelatedConceptNames(term, category);
      setRelated(names);
      setRelatedOpen(true);
    } catch (err) {
      setRelatedError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Falhou.");
    } finally {
      setRelatedLoading(false);
    }
  }

  async function pickRelated(name) {
    if (!onAddRelatedCard || addedNames.includes(name) || loadingNames.includes(name)) return;
    setPickError(null);
    setLoadingNames((prev) => [...prev, name]);
    try {
      await onAddRelatedCard(name);
      setAddedNames((prev) => [...prev, name]);
    } catch (err) {
      setPickError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível criar o card.");
    } finally {
      setLoadingNames((prev) => prev.filter((n) => n !== name));
    }
  }

  const showDeepDiveBox = deepDive && deepDive.data && deepDive.open;

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: "10px" }}>
      {deepDive?.error && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginBottom: "6px" }}>{deepDive.error}</p>
      )}
      {showDeepDiveBox && (
        <div
          style={{
            marginBottom: "8px",
            background: "rgba(46,134,222,0.08)",
            border: `1.5px solid ${COLORS.lensBlue}`,
            borderRadius: "8px",
            padding: "9px 10px",
          }}
        >
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text)", lineHeight: 1.45, margin: 0 }}>
            {deepDive.data.deepDive}
          </p>
          {!!(deepDive.data.extraPoints || []).length && (
            <ul style={{ margin: "6px 0 0", paddingLeft: "16px" }}>
              {deepDive.data.extraPoints.map((p, i) => (
                <li key={i} style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", lineHeight: 1.45 }}>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {onAddRelatedCard && (
        <div className="flex items-center" style={{ gap: "8px" }}>
          <button onClick={toggleRelated} aria-label="Ver relacionados" title="Ver relacionados" style={bigBtnStyle}>
            {relatedLoading ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <MoreHorizontal size={14} />}
            Relacionados
          </button>
        </div>
      )}

      {relatedError && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{relatedError}</p>
      )}
      {pickError && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{pickError}</p>
      )}
      {related && relatedOpen && (
        <div className="flex items-center" style={{ flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
          {related.map((name, i) => {
            const added = addedNames.includes(name);
            const isLoading = loadingNames.includes(name);
            return (
              <button
                key={name + i}
                onClick={() => pickRelated(name)}
                disabled={added || isLoading}
                className="flex items-center gap-1"
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "10.5px",
                  color: added ? "var(--success)" : COLORS.lensBlue,
                  background: added ? "rgba(46,125,50,0.1)" : "rgba(46,134,222,0.1)",
                  border: `1.5px solid ${added ? "var(--success)" : COLORS.lensBlue}`,
                  borderRadius: "999px",
                  padding: "2px 8px",
                  cursor: added || isLoading ? "default" : "pointer",
                }}
              >
                {name}{" "}
                {isLoading ? (
                  <Loader2 size={9} style={{ animation: "spin 0.9s linear infinite" }} />
                ) : added ? (
                  "✓"
                ) : (
                  <ArrowRight size={9} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
