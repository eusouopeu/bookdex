import { useState } from "react";
import { ArrowRight, Check, Loader2, Target } from "lucide-react";
import { COLORS } from "../theme";
import { fetchGoalSuggestions, MissingApiKeyError } from "../lib/anthropic";
import { parseGoalInput } from "../lib/goalSuggestions";

/**
 * Campo de meta dentro de uma coleção de área da vida: "+ alvo" (quero mais)
 * ou "- alvo" (quero menos) gera técnicas/ações sugeridas pra chegar lá,
 * cada uma com botão de adicionar direto na coleção.
 */
export default function GoalSuggestions({ areaName, existingItemNames, onAddSuggestion }) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [goal, setGoal] = useState(null); // { direction, target }
  const [suggestions, setSuggestions] = useState(null);
  const [addedNames, setAddedNames] = useState([]);
  const [addingNames, setAddingNames] = useState([]);

  async function submit() {
    const parsed = parseGoalInput(draft);
    if (!parsed) {
      setError('Comece com "+" (quero mais) ou "-" (quero menos) seguido do que você busca.');
      return;
    }
    setError(null);
    setLoading(true);
    setSuggestions(null);
    setGoal(parsed);
    setAddedNames([]);
    try {
      const result = await fetchGoalSuggestions(areaName, parsed.direction, parsed.target, existingItemNames);
      setSuggestions(result);
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
      /* falha ao adicionar — o item simplesmente não fica marcado como adicionado */
    } finally {
      setAddingNames((prev) => prev.filter((n) => n !== suggestion.name));
    }
  }

  return (
    <div
      style={{
        background: "rgba(255,201,71,0.15)",
        border: `2px solid ${COLORS.gold}`,
        borderRadius: "10px",
        padding: "10px 12px",
        marginBottom: "14px",
      }}
    >
      <div className="flex items-center gap-1.5" style={{ marginBottom: "8px" }}>
        <Target size={14} style={{ color: "#7A5A00", flexShrink: 0 }} />
        <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>
          O que você quer mais ou menos em "{areaName}"?
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder='+ ressonância  ou  - nasal'
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: "8px",
            border: `1.5px solid ${COLORS.screenBorder}`,
            padding: "8px 10px",
            fontFamily: "Inter, sans-serif",
            fontSize: "12.5px",
            background: COLORS.surface,
            color: COLORS.ink,
            outline: "none",
          }}
        />
        <button
          onClick={submit}
          disabled={loading || !draft.trim()}
          style={{
            background: COLORS.gold,
            color: "#4A3300",
            border: "none",
            borderRadius: "8px",
            padding: "0 14px",
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "12px",
            cursor: loading || !draft.trim() ? "default" : "pointer",
            opacity: loading || !draft.trim() ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          {loading ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : "Sugerir"}
        </button>
      </div>

      {error && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--danger)", marginTop: "8px" }}>{error}</p>
      )}

      {suggestions && goal && !error && (
        <div style={{ marginTop: "10px" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
            Pra ter {goal.direction} {goal.target}:
          </p>
          {suggestions.map((s, i) => {
            const added = addedNames.includes(s.name);
            const adding = addingNames.includes(s.name);
            return (
              <div
                key={s.name + i}
                className="flex items-start gap-2"
                style={{
                  background: COLORS.surface,
                  border: `1.5px solid ${COLORS.screenBorder}`,
                  borderRadius: "8px",
                  padding: "8px 10px",
                  marginBottom: "6px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>
                    {s.name}
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", lineHeight: 1.4 }}>
                    {s.description}
                  </div>
                </div>
                <button
                  onClick={() => pick(s)}
                  disabled={added || adding}
                  aria-label={added ? `"${s.name}" já adicionado` : `Adicionar "${s.name}" à coleção`}
                  className="flex items-center gap-1"
                  style={{
                    background: "none",
                    border: `1.5px solid ${added ? "var(--success)" : COLORS.lensBlue}`,
                    borderRadius: "999px",
                    color: added ? "var(--success)" : COLORS.lensBlue,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "10px",
                    padding: "4px 8px",
                    cursor: added || adding ? "default" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {adding ? (
                    <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} />
                  ) : added ? (
                    <Check size={11} />
                  ) : (
                    <ArrowRight size={11} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
