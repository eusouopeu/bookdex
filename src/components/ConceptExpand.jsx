import { useState } from "react";
import { Plus, Minus, MoreHorizontal, Loader2, ArrowRight } from "lucide-react";
import { COLORS } from "../theme";
import { fetchConceptDeepDive, fetchRelatedConceptNames, MissingApiKeyError } from "../lib/anthropic";

const iconBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  background: "transparent",
  border: `1.5px solid ${COLORS.screenBorder}`,
  borderRadius: "999px",
  color: COLORS.ink,
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: "10.5px",
  padding: "3px 9px",
  minHeight: "26px",
  cursor: "pointer",
};

/**
 * Controles de "aprofundar" (+) e "relacionados" (...) reutilizados por
 * DefinitionCard e ListItemCard. Autocontido: busca sozinho na API e só
 * delega pro card pai a criação de um NOVO card quando um relacionado
 * listado é clicado (onAddRelatedCard).
 */
export default function ConceptExpand({ term, category, summary, onAddRelatedCard }) {
  const [deepDive, setDeepDive] = useState(null);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState(null);

  const [related, setRelated] = useState(null);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState(null);
  const [addedNames, setAddedNames] = useState([]);
  const [loadingNames, setLoadingNames] = useState([]);
  const [pickError, setPickError] = useState(null);

  async function toggleDeepDive(e) {
    e.stopPropagation();
    if (deepDive) {
      setDeepDiveOpen((o) => !o);
      return;
    }
    setDeepDiveLoading(true);
    setDeepDiveError(null);
    try {
      const data = await fetchConceptDeepDive(term, category, summary);
      setDeepDive(data);
      setDeepDiveOpen(true);
    } catch (err) {
      setDeepDiveError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Falhou.");
    } finally {
      setDeepDiveLoading(false);
    }
  }

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

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: "10px" }}>
      <div className="flex items-center" style={{ gap: "6px", flexWrap: "wrap" }}>
        <button onClick={toggleDeepDive} aria-label="Aprofundar explicação" title="Aprofundar explicação" style={iconBtnStyle}>
          {deepDiveLoading ? (
            <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} />
          ) : deepDive && deepDiveOpen ? (
            <Minus size={11} />
          ) : (
            <Plus size={11} />
          )}
          Aprofundar
        </button>
        {onAddRelatedCard && (
          <button onClick={toggleRelated} aria-label="Ver relacionados" title="Ver relacionados" style={iconBtnStyle}>
            {relatedLoading ? <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} /> : <MoreHorizontal size={11} />}
            Relacionados
          </button>
        )}
      </div>

      {deepDiveError && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{deepDiveError}</p>
      )}
      {deepDive && deepDiveOpen && (
        <div
          style={{
            marginTop: "8px",
            background: "rgba(46,134,222,0.08)",
            border: `1.5px solid ${COLORS.lensBlue}`,
            borderRadius: "8px",
            padding: "9px 10px",
          }}
        >
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text)", lineHeight: 1.45, margin: 0 }}>
            {deepDive.deepDive}
          </p>
          {!!(deepDive.extraPoints || []).length && (
            <ul style={{ margin: "6px 0 0", paddingLeft: "16px" }}>
              {deepDive.extraPoints.map((p, i) => (
                <li key={i} style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", lineHeight: 1.45 }}>
                  {p}
                </li>
              ))}
            </ul>
          )}
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
