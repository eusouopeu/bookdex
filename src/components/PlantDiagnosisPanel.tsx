import { useRef, useState } from "react";
import { Loader2, Stethoscope, CheckCircle2 } from "lucide-react";
import { COLORS } from "../theme";
import { fetchPlantDiagnosis, MissingApiKeyError } from "../lib/anthropic";
import { readAndCompressImage } from "../lib/imageUtils";
import { estimateCost, formatCost } from "../lib/models";
import { GREEN_TINT, aspectButtonStyle } from "./AspectButtons";

interface DiagnosisResult {
  diseasesFound: boolean;
  issues: { name: string; overview: string; causes: string[]; treatment: string }[];
  note: string;
}

/**
 * Auto-diagnóstico por foto: tira/escolhe uma foto da planta com aparência
 * problemática e devolve causas prováveis + tratamento — sem anotação de
 * região tocável na imagem (isso é visão computacional local, o LLM só lê a
 * foto inteira e escreve texto). Mesmo padrão de expandir/recolher e mesmo
 * tint dos outros botões do card de planta.
 */
export default function PlantDiagnosisPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const dataUrl = await readAndCompressImage(file);
      const diagnosis = await fetchPlantDiagnosis([dataUrl]);
      setResult(diagnosis);
    } catch (err: any) {
      setError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível diagnosticar agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: "8px", flex: open ? "1 1 100%" : "0 0 auto" }}>
      <button
        onClick={() => fileInput.current?.click()}
        disabled={loading}
        aria-label={`Diagnosticar doença por foto (~${formatCost(estimateCost("plantDiagnosis"))})`}
        title={`Diagnosticar por foto (~${formatCost(estimateCost("plantDiagnosis"))})`}
        style={aspectButtonStyle(open, loading, GREEN_TINT)}
      >
        {loading ? <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} /> : <Stethoscope size={15} />}
      </button>
      <input ref={fileInput} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />

      {open && !loading && (
        <div
          style={{
            marginTop: "8px",
            padding: "10px",
            borderRadius: "8px",
            border: `1.5px solid ${GREEN_TINT.boxBorder}`,
            background: GREEN_TINT.boxBg,
          }}
        >
          {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--danger)", margin: 0 }}>{error}</p>}

          {result && !result.diseasesFound && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0 }} />
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: COLORS.ink, margin: 0 }}>
                {result.note || "Nenhum problema aparente na foto."}
              </p>
            </div>
          )}

          {result && result.diseasesFound && (
            <div>
              {result.issues.map((issue, i) => (
                <div key={i} style={{ marginBottom: i < result.issues.length - 1 ? "10px" : 0 }}>
                  <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12.5px", color: COLORS.ink, marginBottom: "3px" }}>
                    {issue.name}
                  </div>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: COLORS.ink, lineHeight: 1.45, margin: "0 0 5px" }}>{issue.overview}</p>
                  {issue.causes?.length > 0 && (
                    <div className="flex" style={{ flexWrap: "wrap", gap: "5px", marginBottom: "5px" }}>
                      {issue.causes.map((cause, ci) => (
                        <span
                          key={ci}
                          style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: "10px",
                            color: GREEN_TINT.buttonColor,
                            border: `1.5px solid ${GREEN_TINT.buttonBorder}`,
                            borderRadius: "999px",
                            padding: "2px 8px",
                          }}
                        >
                          {cause}
                        </span>
                      ))}
                    </div>
                  )}
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", fontStyle: "italic", color: "var(--text-muted)", lineHeight: 1.4, margin: 0 }}>
                    {issue.treatment}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
