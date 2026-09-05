import { useState } from "react";
import { Check, Copy, Loader2, Shield } from "lucide-react";
import { COLORS } from "../../../theme";
import { fetchCounterbalanceSuggestions, fetchSimilarEffectSuggestions } from "../lib/effectsApi";
import { MissingApiKeyError } from "../lib/anthropic";
import { negativeOrNullCriteria, strongPositiveCriteria } from "../lib/effectProfiles";

/** Linha de sugestões (contrabalançar/parecidos) sob cada item da lista — ver EffectProfileDetail. */
export default function ItemSuggestionsRow({ item, profile, onAddByName }: any) {
  const [activeKind, setActiveKind] = useState<string | null>(null); // null | "counter" | "similar"
  const [cache, setCache] = useState<any>({ counter: null, similar: null });
  const [loadingKind, setLoadingKind] = useState<string | null>(null);
  const [errors, setErrors] = useState<any>({ counter: null, similar: null });
  const [addedNames, setAddedNames] = useState<any>({ counter: [], similar: [] });
  const [addingNames, setAddingNames] = useState<any>({ counter: [], similar: [] });

  async function handleClick(kind: string) {
    if (activeKind === kind) {
      setActiveKind(null);
      return;
    }
    setActiveKind(kind);
    if (cache[kind] || loadingKind === kind) return;
    setLoadingKind(kind);
    setErrors((prev: any) => ({ ...prev, [kind]: null }));
    try {
      const isCounter = kind === "counter";
      const criteria = isCounter ? negativeOrNullCriteria(item, profile.criteria) : strongPositiveCriteria(item, profile.criteria);
      const fn = isCounter ? fetchCounterbalanceSuggestions : fetchSimilarEffectSuggestions;
      const result = await fn(profile.name, item.name, criteria);
      setCache((prev: any) => ({ ...prev, [kind]: result }));
    } catch (err: any) {
      setErrors((prev: any) => ({
        ...prev,
        [kind]: err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível gerar sugestões agora.",
      }));
    } finally {
      setLoadingKind(null);
    }
  }

  async function pick(kind: string, name: string) {
    if (addedNames[kind].includes(name) || addingNames[kind].includes(name)) return;
    setAddingNames((prev: any) => ({ ...prev, [kind]: [...prev[kind], name] }));
    try {
      await onAddByName(name);
      setAddedNames((prev: any) => ({ ...prev, [kind]: [...prev[kind], name] }));
    } catch {
      /* a pílula fica pronta pra tentar de novo */
    } finally {
      setAddingNames((prev: any) => ({ ...prev, [kind]: prev[kind].filter((n: string) => n !== name) }));
    }
  }

  const kinds = [
    { key: "counter", Icon: Shield, label: "Contrabalançar", aria: `Sugerir itens que contrabalancem ${item.name}` },
    { key: "similar", Icon: Copy, label: "Parecidos", aria: `Sugerir itens parecidos com ${item.name}` },
  ];

  return (
    <div style={{ marginTop: "6px" }}>
      <div className="flex items-center gap-2" style={{ flexWrap: "nowrap" }}>
        {kinds.map(({ key, Icon, label, aria }) => {
          const active = activeKind === key;
          return (
            <button
              key={key}
              onClick={() => handleClick(key)}
              className="flex items-center justify-center gap-1"
              aria-label={aria}
              aria-pressed={active}
              style={{
                flex: 1,
                minWidth: 0,
                background: active ? "rgba(46,134,222,0.12)" : "none",
                border: `1.5px solid ${active ? COLORS.lensBlue : COLORS.screenBorder}`,
                borderRadius: "999px",
                color: active ? COLORS.lensBlue : COLORS.ink,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10px",
                padding: "3px 6px",
                cursor: "pointer",
              }}
            >
              {loadingKind === key ? <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} /> : <Icon size={11} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            </button>
          );
        })}
      </div>
      {activeKind && (
        <div style={{ marginTop: "6px" }}>
          {errors[activeKind] && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--danger)" }}>{errors[activeKind]}</p>}
          {cache[activeKind] && cache[activeKind].length === 0 && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)" }}>Nenhuma sugestão desta vez.</p>
          )}
          {cache[activeKind] && cache[activeKind].length > 0 && (
            <div className="flex" style={{ flexWrap: "wrap", gap: "5px" }}>
              {cache[activeKind].map((s: any, i: number) => {
                const added = addedNames[activeKind].includes(s.name);
                const adding = addingNames[activeKind].includes(s.name);
                return (
                  <button
                    key={s.name + i}
                    onClick={() => pick(activeKind, s.name)}
                    disabled={added || adding}
                    title={s.reason}
                    className="flex items-center gap-1"
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: "10px",
                      color: added ? "var(--success)" : COLORS.lensBlue,
                      background: COLORS.surface,
                      border: `1.5px solid ${added ? "var(--success)" : COLORS.lensBlue}`,
                      borderRadius: "999px",
                      padding: "3px 9px",
                      cursor: added || adding ? "default" : "pointer",
                    }}
                  >
                    {adding ? <Loader2 size={10} style={{ animation: "spin 0.9s linear infinite" }} /> : added ? <Check size={10} /> : "+"}
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
