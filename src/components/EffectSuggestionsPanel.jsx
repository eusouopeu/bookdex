import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { COLORS, primaryButtonStyle } from "../theme";
import { fetchEffectSuggestions, MissingApiKeyError } from "../lib/anthropic";

/**
 * Painel de sugestões de adição/substituição pra um perfil de efeito: você
 * escolhe 1+ critérios-alvo e a direção desejada, a IA sugere itens novos
 * ou trocas dos itens ativos atuais.
 */
export default function EffectSuggestionsPanel({ profile, activeItems, onAddSuggestion, onClose }) {
  const [targets, setTargets] = useState({}); // { [criterionId]: "mais" | "menos" | undefined }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [addedNames, setAddedNames] = useState([]);
  const [addingNames, setAddingNames] = useState([]);

  function cycleTarget(criterionId) {
    setTargets((prev) => {
      const current = prev[criterionId];
      const next = { ...prev };
      if (!current) next[criterionId] = "mais";
      else if (current === "mais") next[criterionId] = "menos";
      else delete next[criterionId];
      return next;
    });
  }

  async function submit() {
    const targetCriteria = profile.criteria
      .filter((c) => targets[c.id])
      .map((c) => ({ id: c.id, label: c.label, direction: targets[c.id] }));
    if (!targetCriteria.length) {
      setError("Escolha pelo menos um critério, tocando nele até aparecer + ou -.");
      return;
    }
    setError(null);
    setLoading(true);
    setSuggestions(null);
    try {
      const result = await fetchEffectSuggestions(profile.name, activeItems, targetCriteria);
      setSuggestions(result.map((s) => ({ ...s, targetCriteria })));
    } catch (err) {
      setError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível gerar sugestões agora.");
    } finally {
      setLoading(false);
    }
  }

  async function pick(suggestion) {
    if (addedNames.includes(suggestion.name) || addingNames.includes(suggestion.name)) return;
    setAddingNames((prev) => [...prev, suggestion.name]);
    try {
      await onAddSuggestion(suggestion);
      setAddedNames((prev) => [...prev, suggestion.name]);
    } catch {
      /* falha ao adicionar — só não marca como adicionado */
    } finally {
      setAddingNames((prev) => prev.filter((n) => n !== suggestion.name));
    }
  }

  return (
    <div
      style={{
        background: "rgba(46,134,222,0.08)",
        border: `2px solid ${COLORS.lensBlue}`,
        borderRadius: "10px",
        padding: "12px",
        marginBottom: "14px",
      }}
    >
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", marginBottom: "8px" }}>
        Toque nos critérios que quer melhorar (alterna entre + mais e − menos):
      </p>
      <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
        {profile.criteria.map((c) => {
          const dir = targets[c.id];
          return (
            <button
              key={c.id}
              onClick={() => cycleTarget(c.id)}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10.5px",
                color: dir ? "#fff" : COLORS.ink,
                background: dir === "mais" ? "var(--success)" : dir === "menos" ? "var(--danger)" : COLORS.surface,
                border: `1.5px solid ${dir === "mais" ? "var(--success)" : dir === "menos" ? "var(--danger)" : COLORS.screenBorder}`,
                borderRadius: "999px",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              {dir === "mais" ? "+ " : dir === "menos" ? "− " : ""}
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={loading}
          className="flex items-center justify-center gap-1.5"
          style={{ ...primaryButtonStyle, flex: 1, minHeight: "38px", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={14} />}
          {loading ? "Pensando..." : "Sugerir"}
        </button>
        <button
          onClick={onClose}
          style={{
            ...primaryButtonStyle,
            background: "transparent",
            color: COLORS.ink,
            border: `2px solid ${COLORS.screenBorder}`,
            minHeight: "38px",
          }}
        >
          Fechar
        </button>
      </div>

      {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--danger)", marginTop: "8px" }}>{error}</p>}

      {suggestions && (
        <div style={{ marginTop: "10px" }}>
          {suggestions.length === 0 && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)" }}>Nenhuma sugestão desta vez.</p>
          )}
          {suggestions.map((s, i) => {
            const added = addedNames.includes(s.name);
            const adding = addingNames.includes(s.name);
            return (
              <div
                key={s.name + i}
                style={{
                  background: COLORS.surface,
                  border: `1.5px solid ${COLORS.screenBorder}`,
                  borderRadius: "8px",
                  padding: "8px 10px",
                  marginBottom: "6px",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>
                      {s.name}
                      {s.kind === "substituicao" && s.replaces && (
                        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 400, fontSize: "10.5px", color: "var(--text-muted)" }}>
                          {" "}
                          — troca {s.replaces}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", lineHeight: 1.4, marginTop: "2px" }}>
                      {s.reason}
                    </div>
                  </div>
                  <button
                    onClick={() => pick(s)}
                    disabled={added || adding}
                    aria-label={added ? `"${s.name}" já adicionado` : `Adicionar "${s.name}"`}
                    style={{
                      background: "none",
                      border: `1.5px solid ${added ? "var(--success)" : COLORS.lensBlue}`,
                      borderRadius: "999px",
                      color: added ? "var(--success)" : COLORS.lensBlue,
                      padding: "4px 8px",
                      cursor: added || adding ? "default" : "pointer",
                      flexShrink: 0,
                      display: "flex",
                    }}
                  >
                    {adding ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : added ? <Check size={12} /> : "+"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
