import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { COLORS } from "../../../../theme";
import { CriteriaTargetPicker, ResultCard, MetaLine, ErrorLine, errorMessage, primarySmallButton } from "./shared";

/**
 * "O que causa" e "Caminhos" fazem a mesma pergunta ao grafo em direções
 * opostas (causa reversa vs. caminho até a meta): mesmo formulário — critérios-
 * alvo com direção —, mesma lista de resultados com botão de adicionar como
 * item. Só o texto e a função de busca mudam.
 */
export default function CauseOrPathPanel({
  profile,
  onAddItem,
  hint,
  actionLabel,
  fetch,
}: {
  profile: any;
  onAddItem: (profileId: string, payload: any) => void;
  hint: string;
  actionLabel: string;
  fetch: (profileName: string, targetCriteria: any[]) => Promise<any>;
}) {
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [addedNames, setAddedNames] = useState<string[]>([]);

  const targetCriteria = profile.criteria.filter((c: any) => targets[c.id]).map((c: any) => ({ id: c.id, label: c.label, direction: targets[c.id] }));

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

  async function run() {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      setResult(await fetch(profile.name, targetCriteria));
    } catch (err: any) {
      setError(errorMessage(err, "Não foi possível gerar agora."));
    } finally {
      setLoading(false);
    }
  }

  function addAsItem(entry: any) {
    if (addedNames.includes(entry.name)) return;
    const ratings: Record<string, number> = {};
    const ratingMeta: Record<string, any> = {};
    const reasons: Record<string, string> = {};
    targetCriteria.forEach((c: any, i: number) => {
      ratings[c.id] = entry.estimatedRatings ? entry.estimatedRatings[i] || 0 : 0;
      ratingMeta[c.id] = { probability: entry.probability, confidence: entry.confidence };
      reasons[c.id] = entry.reason || "";
    });
    onAddItem(profile.id, { name: entry.name, variantLabels: [], ratings: [ratings], reasons: [reasons], aiEvaluated: [true], ratingMeta: [ratingMeta] });
    setAddedNames((prev) => [...prev, entry.name]);
  }

  return (
    <div>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", marginBottom: "6px" }}>{hint}</p>
      <CriteriaTargetPicker criteria={profile.criteria} targets={targets} onCycle={cycleTarget} />
      <button onClick={run} disabled={loading || !targetCriteria.length} className="flex items-center gap-1.5" style={primarySmallButton(loading || !targetCriteria.length)}>
        {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
        {actionLabel}
      </button>
      <ErrorLine error={error} />
      {result && (
        <div style={{ marginTop: "8px" }}>
          {result.map((entry: any, i: number) => (
            <ResultCard key={i}>
              <div className="flex items-start justify-between gap-2">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>{entry.name}</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text)", marginTop: "2px" }}>{entry.reason}</div>
                  <MetaLine probability={entry.probability} confidence={entry.confidence} />
                </div>
                <button
                  onClick={() => addAsItem(entry)}
                  disabled={addedNames.includes(entry.name)}
                  aria-label={`Adicionar "${entry.name}" como item`}
                  style={{
                    background: "none",
                    border: `1.5px solid ${addedNames.includes(entry.name) ? "var(--success)" : COLORS.lensBlue}`,
                    borderRadius: "999px",
                    color: addedNames.includes(entry.name) ? "var(--success)" : COLORS.lensBlue,
                    padding: "4px 8px",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {addedNames.includes(entry.name) ? <Check size={12} /> : "+"}
                </button>
              </div>
            </ResultCard>
          ))}
        </div>
      )}
    </div>
  );
}
