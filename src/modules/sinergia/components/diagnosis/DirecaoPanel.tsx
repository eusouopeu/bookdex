import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { COLORS } from "../../../../theme";
import { fetchDirectionArbitration } from "../../lib/effectsApi";
import { ResultCard, MetaLine, ErrorLine, errorMessage, inputStyle, primarySmallButton } from "./shared";

const DIRECTION_LABELS: Record<string, string> = {
  a_causa_b: "A causa B",
  b_causa_a: "B causa A",
  bidirecional: "Se retroalimentam",
  confundida: "Correlação sem causa direta clara",
};

export default function DirecaoPanel({
  profile,
  onSetCriterionLink,
}: {
  profile: any;
  onSetCriterionLink: (profileId: string, key: string, fromId: string, toId: string, data: any) => void;
}) {
  const [criterionAId, setCriterionAId] = useState("");
  const [criterionBId, setCriterionBId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  async function run() {
    const a = profile.criteria.find((c: any) => c.id === criterionAId);
    const b = profile.criteria.find((c: any) => c.id === criterionBId);
    if (!a || !b || a.id === b.id) return;
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      setResult(await fetchDirectionArbitration(profile.name, a.label, b.label));
    } catch (err: any) {
      setError(errorMessage(err, "Não foi possível gerar agora."));
    } finally {
      setLoading(false);
    }
  }

  function saveAsLink() {
    if (!result || !criterionAId || !criterionBId) return;
    const dir = result.direction;
    const base = { magnitude: result.magnitude, probability: result.probability, confidence: result.confidence, reason: result.reason };
    if (dir === "a_causa_b") onSetCriterionLink(profile.id, `${criterionAId}=>${criterionBId}`, criterionAId, criterionBId, base);
    else if (dir === "b_causa_a") onSetCriterionLink(profile.id, `${criterionBId}=>${criterionAId}`, criterionBId, criterionAId, base);
    else if (dir === "bidirecional") {
      onSetCriterionLink(profile.id, `${criterionAId}=>${criterionBId}`, criterionAId, criterionBId, base);
      onSetCriterionLink(profile.id, `${criterionBId}=>${criterionAId}`, criterionBId, criterionAId, base);
    }
    setSaved(true);
  }

  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: "8px" }}>
        <select value={criterionAId} onChange={(e) => setCriterionAId(e.target.value)} style={inputStyle}>
          <option value="">A: critério...</option>
          {profile.criteria.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={criterionBId} onChange={(e) => setCriterionBId(e.target.value)} style={inputStyle}>
          <option value="">B: critério...</option>
          {profile.criteria.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={run}
        disabled={loading || !criterionAId || !criterionBId || criterionAId === criterionBId}
        className="flex items-center gap-1.5"
        style={primarySmallButton(loading || !criterionAId || !criterionBId || criterionAId === criterionBId)}
      >
        {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
        Arbitrar direção
      </button>
      <ErrorLine error={error} />
      {result && (
        <ResultCard>
          <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>{DIRECTION_LABELS[result.direction] || result.direction}</div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text)", marginTop: "4px", lineHeight: 1.4 }}>{result.reason}</div>
          <MetaLine probability={result.probability} confidence={result.confidence} />
          {result.direction !== "confundida" && (
            <button onClick={saveAsLink} disabled={saved} style={{ ...primarySmallButton(saved), marginTop: "6px" }}>
              {saved ? "Salvo como ligação" : "Salvar como ligação causal"}
            </button>
          )}
        </ResultCard>
      )}
    </div>
  );
}
