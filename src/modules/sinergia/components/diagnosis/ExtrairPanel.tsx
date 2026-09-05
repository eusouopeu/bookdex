import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { COLORS } from "../../../../theme";
import { fetchConversationExtraction } from "../../lib/effectsApi";
import { probabilityLabel } from "../../lib/effectProfiles";
import { ErrorLine, errorMessage, inputStyle, primarySmallButton } from "./shared";

export default function ExtrairPanel({
  profile,
  onAddItem,
  onAddCriterion,
}: {
  profile: any;
  onAddItem: (profileId: string, payload: any) => void;
  onAddCriterion: (profileId: string, label: string) => void;
}) {
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<any>(null);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [checkedCriteria, setCheckedCriteria] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);

  async function runExtraction() {
    setError(null);
    setLoading(true);
    setExtraction(null);
    try {
      const r = await fetchConversationExtraction(profile.name, pasteText);
      setExtraction(r);
      setCheckedItems(r.items);
      setCheckedCriteria(r.criteria);
    } catch (err: any) {
      setError(errorMessage(err, "Não foi possível extrair agora."));
    } finally {
      setLoading(false);
    }
  }

  function applyExtraction() {
    const existingItemNames = new Set(profile.items.map((it: any) => it.name.toLowerCase()));
    const existingCriterionLabels = new Set(profile.criteria.map((c: any) => c.label.toLowerCase()));
    checkedItems.forEach((name) => {
      if (existingItemNames.has(name.toLowerCase())) return;
      onAddItem(profile.id, { name, variantLabels: [], ratings: [{}], reasons: [{}], aiEvaluated: [false] });
    });
    checkedCriteria.forEach((label) => {
      if (existingCriterionLabels.has(label.toLowerCase())) return;
      onAddCriterion(profile.id, label);
    });
    setExtraction(null);
    setPasteText("");
    setApplied(true);
  }

  return (
    <div>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", marginBottom: "6px" }}>
        Cole um trecho de conversa (ex.: do Claude) — a IA extrai itens e critérios candidatos pra você aprovar.
      </p>
      <textarea
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        rows={4}
        placeholder="Cole aqui..."
        style={{ ...inputStyle, width: "100%", resize: "vertical", marginBottom: "8px" }}
      />
      <button onClick={runExtraction} disabled={loading || !pasteText.trim()} className="flex items-center gap-1.5" style={primarySmallButton(loading || !pasteText.trim())}>
        {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Search size={12} />}
        Extrair candidatos
      </button>
      <ErrorLine error={error} />
      {applied && !extraction && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--success)", marginTop: "6px" }}>Candidatos aplicados.</p>
      )}
      {extraction && (
        <div style={{ marginTop: "8px" }}>
          {extraction.items.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: COLORS.ink, marginBottom: "4px" }}>Itens</div>
              {extraction.items.map((name: string) => (
                <label key={name} className="flex items-center gap-2" style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: COLORS.ink, marginBottom: "3px" }}>
                  <input
                    type="checkbox"
                    checked={checkedItems.includes(name)}
                    onChange={(e) => setCheckedItems((prev) => (e.target.checked ? [...prev, name] : prev.filter((n) => n !== name)))}
                  />
                  {name}
                </label>
              ))}
            </div>
          )}
          {extraction.criteria.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: COLORS.ink, marginBottom: "4px" }}>Critérios</div>
              {extraction.criteria.map((label: string) => (
                <label key={label} className="flex items-center gap-2" style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: COLORS.ink, marginBottom: "3px" }}>
                  <input
                    type="checkbox"
                    checked={checkedCriteria.includes(label)}
                    onChange={(e) => setCheckedCriteria((prev) => (e.target.checked ? [...prev, label] : prev.filter((n) => n !== label)))}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
          {extraction.edges.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: COLORS.ink, marginBottom: "4px" }}>
                Relações identificadas (adicione manualmente depois de aprovar os nós acima)
              </div>
              {extraction.edges.map((e: any, i: number) => (
                <div key={i} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "var(--text-muted)" }}>
                  {e.from} → {e.to}: {e.magnitude > 0 ? "+" : ""}
                  {e.magnitude} ({probabilityLabel(e.probability)}) — {e.reason}
                </div>
              ))}
            </div>
          )}
          <button onClick={applyExtraction} disabled={!checkedItems.length && !checkedCriteria.length} style={primarySmallButton(!checkedItems.length && !checkedCriteria.length)}>
            Aplicar selecionados
          </button>
        </div>
      )}
    </div>
  );
}
