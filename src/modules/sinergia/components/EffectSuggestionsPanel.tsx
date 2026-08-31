import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { COLORS } from "../../../theme";
import { fetchEffectSuggestions } from "../lib/effectsApi";
import { MissingApiKeyError } from "../lib/anthropic";

/**
 * Painel de sugestões de adição/substituição pra um perfil de efeito: você
 * escolhe 1+ critérios-alvo e a direção desejada, a IA sugere itens novos
 * ou trocas dos itens ativos atuais. Sempre visível quando o perfil tem
 * critérios — compacto de propósito, então o botão de gerar é só um ícone.
 */
export default function EffectSuggestionsPanel({ profile, activeItems, onAddSuggestion }: any) {
  const [targets, setTargets] = useState<Record<string, string>>({}); // { [criterionId]: "mais" | "menos" | undefined }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [addedNames, setAddedNames] = useState<string[]>([]);
  const [addingNames, setAddingNames] = useState<string[]>([]);

  function cycleTarget(criterionId: string) {
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
      .filter((c: any) => targets[c.id])
      .map((c: any) => ({ id: c.id, label: c.label, direction: targets[c.id] }));
    if (!targetCriteria.length) {
      setError("Toque num critério até aparecer + ou − antes de sugerir.");
      return;
    }
    setError(null);
    setLoading(true);
    setSuggestions(null);
    try {
      const result = await fetchEffectSuggestions(profile.name, activeItems, targetCriteria);
      setSuggestions(result.map((s: any) => ({ ...s, targetCriteria })));
    } catch (err: any) {
      setError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível gerar sugestões agora.");
    } finally {
      setLoading(false);
    }
  }

  async function pick(suggestion: any) {
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
        padding: "8px 10px",
        marginBottom: "14px",
      }}
    >
      <div className="flex items-center gap-1.5" style={{ flexWrap: "wrap" }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", flexShrink: 0 }}>Melhorar:</span>
        {profile.criteria.map((c: any) => {
          const dir = targets[c.id];
          return (
            <button
              key={c.id}
              onClick={() => cycleTarget(c.id)}
              aria-label={`${c.label}: ${dir === "mais" ? "quero mais (tocar para menos)" : dir === "menos" ? "quero menos (tocar para desmarcar)" : "tocar para marcar como alvo"}`}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10px",
                color: dir ? "#fff" : COLORS.ink,
                background: dir === "mais" ? "var(--success)" : dir === "menos" ? "var(--danger)" : COLORS.surface,
                border: `1.5px solid ${dir === "mais" ? "var(--success)" : dir === "menos" ? "var(--danger)" : COLORS.screenBorder}`,
                borderRadius: "999px",
                padding: "3px 8px",
                cursor: "pointer",
              }}
            >
              {dir === "mais" ? "+ " : dir === "menos" ? "− " : ""}
              {c.label}
            </button>
          );
        })}
        <button
          onClick={submit}
          disabled={loading}
          aria-label="Gerar sugestões pros critérios marcados"
          style={{
            width: "26px",
            height: "26px",
            flexShrink: 0,
            marginLeft: "auto",
            borderRadius: "999px",
            border: "none",
            background: COLORS.lensBlue,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? <Loader2 size={13} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={13} />}
        </button>
      </div>

      {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>}

      {suggestions && (
        <div style={{ marginTop: "8px" }}>
          {suggestions.length === 0 && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)" }}>Nenhuma sugestão desta vez.</p>
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
                  padding: "6px 8px",
                  marginBottom: "5px",
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
