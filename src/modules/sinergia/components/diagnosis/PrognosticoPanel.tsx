import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { COLORS } from "../../../../theme";
import { fetchPrognosis } from "../../lib/effectsApi";
import { probabilityLabel } from "../../lib/effectProfiles";
import { ResultCard, MetaLine, ErrorLine, errorMessage, inputStyle, primarySmallButton } from "./shared";

export default function PrognosticoPanel({
  profile,
  onUpdateItemNote,
}: {
  profile: any;
  onUpdateItemNote: (profileId: string, itemId: string, note: string) => void;
}) {
  const [refId, setRefId] = useState("");
  const [criterionId, setCriterionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  async function run() {
    const item = profile.items.find((it: any) => it.id === refId);
    const crit = profile.criteria.find((c: any) => c.id === criterionId);
    if (!item || !crit) return;
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      setResult(await fetchPrognosis(profile.name, item.name, crit.label));
    } catch (err: any) {
      setError(errorMessage(err, "Não foi possível gerar agora."));
    } finally {
      setLoading(false);
    }
  }

  function saveToNote() {
    const item = profile.items.find((it: any) => it.id === refId);
    if (!item || !result) return;
    const text = `Prognóstico: ${probabilityLabel(result.probability)} de atingir a meta em ${result.timeframe} (nota esperada ${result.expectedMagnitude > 0 ? "+" : ""}${result.expectedMagnitude}). ${result.reason}`;
    onUpdateItemNote(profile.id, item.id, item.note ? `${item.note}\n\n${text}` : text);
    setSaved(true);
  }

  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: "8px" }}>
        <select value={refId} onChange={(e) => setRefId(e.target.value)} style={inputStyle}>
          <option value="">ação/item feito...</option>
          {profile.items.map((it: any) => (
            <option key={it.id} value={it.id}>
              {it.name}
            </option>
          ))}
        </select>
        <select value={criterionId} onChange={(e) => setCriterionId(e.target.value)} style={inputStyle}>
          <option value="">critério-alvo...</option>
          {profile.criteria.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <button onClick={run} disabled={loading || !refId || !criterionId} className="flex items-center gap-1.5" style={primarySmallButton(loading || !refId || !criterionId)}>
        {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
        Estimar prognóstico
      </button>
      <ErrorLine error={error} />
      {result && (
        <ResultCard>
          <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>
            {probabilityLabel(result.probability)} · {result.timeframe} · nota esperada {result.expectedMagnitude > 0 ? "+" : ""}
            {result.expectedMagnitude}
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text)", marginTop: "4px", lineHeight: 1.4 }}>{result.reason}</div>
          <MetaLine confidence={result.confidence} />
          <button onClick={saveToNote} disabled={saved} style={{ ...primarySmallButton(saved), marginTop: "6px" }}>
            {saved ? "Salvo na nota" : "Salvar na nota do item"}
          </button>
        </ResultCard>
      )}
    </div>
  );
}
