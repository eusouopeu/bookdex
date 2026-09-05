import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { COLORS } from "../../../../theme";
import { fetchProtocol } from "../../lib/effectsApi";
import { CriteriaTargetPicker, ResultCard, ErrorLine, errorMessage, inputStyle, primarySmallButton } from "./shared";

export default function ProtocoloPanel({
  profile,
  onSetItemProtocol,
}: {
  profile: any;
  onSetItemProtocol: (profileId: string, itemId: string, protocol: any) => void;
}) {
  const [refId, setRefId] = useState("");
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [saved, setSaved] = useState(false);

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
    const item = profile.items.find((it: any) => it.id === refId);
    if (!item) return;
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      setResult(await fetchProtocol(profile.name, item.name, targetCriteria));
    } catch (err: any) {
      setError(errorMessage(err, "Não foi possível gerar agora."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: "8px" }}>
        <select value={refId} onChange={(e) => setRefId(e.target.value)} style={inputStyle}>
          <option value="">item...</option>
          {profile.items.map((it: any) => (
            <option key={it.id} value={it.id}>
              {it.name}
            </option>
          ))}
        </select>
      </div>
      <CriteriaTargetPicker criteria={profile.criteria} targets={targets} onCycle={cycleTarget} />
      <button onClick={run} disabled={loading || !refId} className="flex items-center gap-1.5" style={primarySmallButton(loading || !refId)}>
        {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
        Recomendar protocolo
      </button>
      <ErrorLine error={error} />
      {result && (
        <ResultCard>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink, lineHeight: 1.6 }}>
            <strong>Intensidade:</strong> {result.intensity}
            <br />
            <strong>Frequência:</strong> {result.frequency}
            <br />
            <strong>Duração:</strong> {result.duration}
            {result.order && (
              <>
                <br />
                <strong>Ordem:</strong> {result.order}
              </>
            )}
            {result.timing && (
              <>
                <br />
                <strong>Momento:</strong> {result.timing}
              </>
            )}
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", marginTop: "4px" }}>{result.reason}</div>
          <button
            onClick={() => {
              onSetItemProtocol(profile.id, refId, result);
              setSaved(true);
            }}
            disabled={saved}
            style={{ ...primarySmallButton(saved), marginTop: "6px" }}
          >
            {saved ? "Salvo no item" : "Salvar no item"}
          </button>
        </ResultCard>
      )}
    </div>
  );
}
