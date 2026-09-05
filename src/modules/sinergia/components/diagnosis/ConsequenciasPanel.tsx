import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { COLORS } from "../../../../theme";
import { fetchForwardConsequences } from "../../lib/effectsApi";
import { createCriterionId, currentRatings, currentVariantIndex } from "../../lib/effectProfiles";
import { ResultCard, MetaLine, ErrorLine, errorMessage, inputStyle, primarySmallButton } from "./shared";

export default function ConsequenciasPanel({
  profile,
  onAddCriterion,
  onFillCriterionForItem,
  onSetRatingMeta,
  onSetCriterionLink,
}: {
  profile: any;
  onAddCriterion: (profileId: string, label: string) => void;
  onFillCriterionForItem: (profileId: string, itemId: string, variantIndex: number, criterionId: string, value: number, reason: string) => void;
  onSetRatingMeta: (profileId: string, itemId: string, criterionId: string, meta: any, variantIndex?: number) => void;
  onSetCriterionLink: (profileId: string, key: string, fromId: string, toId: string, data: any) => void;
}) {
  const [refKind, setRefKind] = useState("item");
  const [refId, setRefId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [addedLabels, setAddedLabels] = useState<string[]>([]);

  async function run() {
    const ref = refKind === "item" ? profile.items.find((it: any) => it.id === refId) : profile.criteria.find((c: any) => c.id === refId);
    if (!ref) return;
    const label = refKind === "item" ? ref.name : ref.label;
    const summary = refKind === "item" ? Object.entries(currentRatings(ref)).map(([, v]) => v).length + " critérios avaliados" : "";
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      setResult(await fetchForwardConsequences(profile.name, label, summary));
    } catch (err: any) {
      setError(errorMessage(err, "Não foi possível gerar agora."));
    } finally {
      setLoading(false);
    }
  }

  function addAsCriterion(entry: any) {
    if (addedLabels.includes(entry.label)) return;
    const predictedId = createCriterionId(profile.criteria.map((c: any) => c.id), entry.label);
    onAddCriterion(profile.id, entry.label);
    if (refKind === "item") {
      const refItem = profile.items.find((it: any) => it.id === refId);
      if (refItem) {
        const variantIndex = currentVariantIndex(refItem);
        onFillCriterionForItem(profile.id, refItem.id, variantIndex, predictedId, entry.magnitude, entry.reason);
        onSetRatingMeta(profile.id, refItem.id, predictedId, { probability: entry.probability, confidence: entry.confidence, latency: entry.latency });
      }
    } else {
      const key = `${refId}=>${predictedId}`;
      onSetCriterionLink(profile.id, key, refId, predictedId, {
        magnitude: entry.magnitude,
        probability: entry.probability,
        confidence: entry.confidence,
        latency: entry.latency,
        reason: entry.reason,
      });
    }
    setAddedLabels((prev) => [...prev, entry.label]);
  }

  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: "8px" }}>
        <select
          value={`${refKind}:${refId}`}
          onChange={(e) => {
            const [kind, id] = e.target.value.split(":");
            setRefKind(kind);
            setRefId(id);
          }}
          style={inputStyle}
        >
          <option value="item:">item...</option>
          {profile.items.map((it: any) => (
            <option key={it.id} value={`item:${it.id}`}>
              {it.name}
            </option>
          ))}
          <option value="criterion:">— ou critério —</option>
          {profile.criteria.map((c: any) => (
            <option key={c.id} value={`criterion:${c.id}`}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <button onClick={run} disabled={loading || !refId} className="flex items-center gap-1.5" style={primarySmallButton(loading || !refId)}>
        {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
        Ver consequências
      </button>
      <ErrorLine error={error} />
      {result && (
        <div style={{ marginTop: "8px" }}>
          {result.map((c: any, i: number) => (
            <ResultCard key={i}>
              <div className="flex items-start justify-between gap-2">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>{c.label}</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text)", marginTop: "2px" }}>{c.reason}</div>
                  <MetaLine probability={c.probability} confidence={c.confidence} latency={c.latency} />
                </div>
                <button
                  onClick={() => addAsCriterion(c)}
                  disabled={addedLabels.includes(c.label)}
                  aria-label={`Adicionar "${c.label}" como critério ligado`}
                  style={{
                    background: "none",
                    border: `1.5px solid ${addedLabels.includes(c.label) ? "var(--success)" : COLORS.lensBlue}`,
                    borderRadius: "999px",
                    color: addedLabels.includes(c.label) ? "var(--success)" : COLORS.lensBlue,
                    padding: "4px 8px",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {addedLabels.includes(c.label) ? <Check size={12} /> : "+"}
                </button>
              </div>
            </ResultCard>
          ))}
        </div>
      )}
    </div>
  );
}
