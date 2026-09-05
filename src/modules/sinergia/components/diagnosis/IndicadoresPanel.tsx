import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { COLORS } from "../../../../theme";
import { fetchIndicators } from "../../lib/effectsApi";
import { ResultCard, ErrorLine, errorMessage, inputStyle, primarySmallButton } from "./shared";

export default function IndicadoresPanel({
  profile,
  onSetItemIndicators,
}: {
  profile: any;
  onSetItemIndicators: (profileId: string, itemId: string, indicators: any) => void;
}) {
  const [refId, setRefId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  async function run() {
    const item = profile.items.find((it: any) => it.id === refId);
    if (!item) return;
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      setResult(await fetchIndicators(profile.name, item.name));
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
      <button onClick={run} disabled={loading || !refId} className="flex items-center gap-1.5" style={primarySmallButton(loading || !refId)}>
        {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
        Listar indicadores
      </button>
      <ErrorLine error={error} />
      {result && (
        <ResultCard>
          <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: "var(--success)" }}>Sinais de que está indo bem</div>
          <ul style={{ margin: "4px 0 8px", paddingLeft: "16px", fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink }}>
            {result.positive.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: "var(--danger)" }}>Sinais de ajuste</div>
          <ul style={{ margin: "4px 0 0", paddingLeft: "16px", fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink }}>
            {result.negative.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <button
            onClick={() => {
              onSetItemIndicators(profile.id, refId, result);
              setSaved(true);
            }}
            disabled={saved}
            style={{ ...primarySmallButton(saved), marginTop: "8px" }}
          >
            {saved ? "Salvo no item" : "Salvar no item"}
          </button>
        </ResultCard>
      )}
    </div>
  );
}
