import { useState, type ReactNode } from "react";
import { Check, Loader2, Search, Sparkles } from "lucide-react";
import { COLORS } from "../../../theme";
import { MissingApiKeyError } from "../lib/anthropic";
import {
  fetchReverseDiagnosis,
  fetchGoalPaths,
  fetchForwardConsequences,
  fetchPrognosis,
  fetchProtocol,
  fetchIndicators,
  fetchDirectionArbitration,
  fetchConversationExtraction,
} from "../lib/effectsApi";
import {
  createCriterionId,
  currentRatings,
  currentVariantIndex,
  probabilityLabel,
  confidenceLabel,
  latencyLabel,
} from "../lib/effectProfiles";

/**
 * Oito botões soltos viraram três grupos: as perguntas eram a MESMA pergunta
 * sobre o mesmo grafo, em direções diferentes. "Explorar" olha o grafo (o que
 * causa, o que decorre, quem causa quem), "Agir" transforma isso em ação
 * (caminho, protocolo, indicadores, prognóstico) e "Importar" traz nós de
 * fora. O sub-modo só aparece depois de escolher o grupo.
 */
const GROUPS = [
  {
    key: "explorar",
    label: "Explorar",
    subs: [
      { key: "causas", label: "O que causa" },
      { key: "consequencias", label: "O que decorre" },
      { key: "direcao", label: "Quem causa quem" },
    ],
  },
  {
    key: "agir",
    label: "Agir",
    subs: [
      { key: "caminhos", label: "Caminhos" },
      { key: "protocolo", label: "Protocolo" },
      { key: "indicadores", label: "Indicadores" },
      { key: "prognostico", label: "Prognóstico" },
    ],
  },
  {
    key: "importar",
    label: "Importar",
    subs: [{ key: "extrair", label: "Colar conversa" }],
  },
];

const inputStyle = {
  flex: 1,
  minWidth: 0,
  borderRadius: "6px",
  border: `1.5px solid ${COLORS.screenBorder}`,
  padding: "6px 8px",
  fontFamily: "Inter, sans-serif",
  fontSize: "11.5px",
  background: COLORS.surface,
  color: COLORS.ink,
  outline: "none",
};

const primarySmallButton = (disabled: boolean) => ({
  background: COLORS.lensBlue,
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "6px 12px",
  fontFamily: '"Baloo 2", sans-serif',
  fontWeight: 700,
  fontSize: "11px",
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.5 : 1,
  flexShrink: 0,
});

/** Seletor de critérios-alvo com direção (mais/menos), igual ao padrão do EffectSuggestionsPanel. */
function CriteriaTargetPicker({ criteria, targets, onCycle }: any) {
  return (
    <div className="flex items-center gap-1.5" style={{ flexWrap: "wrap", marginBottom: "8px" }}>
      {criteria.map((c: any) => {
        const dir = targets[c.id];
        return (
          <button
            key={c.id}
            onClick={() => onCycle(c.id)}
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
    </div>
  );
}

function ResultCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "7px 9px", marginBottom: "6px" }}>
      {children}
    </div>
  );
}

function MetaLine({ probability, confidence, latency }: { probability?: string; confidence?: string; latency?: string }) {
  const parts = [
    probability && probabilityLabel(probability),
    confidence && confidenceLabel(confidence),
    latency && latencyLabel(latency),
  ].filter(Boolean);
  if (!parts.length) return null;
  return <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "9.5px", color: "var(--text-muted)", marginTop: "2px" }}>{parts.join(" · ")}</div>;
}

/**
 * As perguntas causais que você faz no chat, viradas em botões: causa
 * reversa (1 critério ou uma síndrome de vários), caminhos pra um objetivo,
 * consequências à frente, prognóstico, protocolo de uso, indicadores de
 * acerto/erro, arbitragem de direção causal entre dois critérios, e extração
 * de nós candidatos a partir de um trecho de conversa colado. Cada resultado
 * tem uma ação que grava direto no perfil — nada fica só em texto solto.
 */
export default function DiagnosisPanel({
  profile,
  onAddItem,
  onAddCriterion,
  onFillCriterionForItem,
  onSetRatingMeta,
  onSetCriterionLink,
  onSetItemProtocol,
  onSetItemIndicators,
  onUpdateItemNote,
}: any) {
  const [group, setGroup] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [refId, setRefId] = useState("");
  const [refKind, setRefKind] = useState("item"); // "item" | "criterion"
  const [criterionAId, setCriterionAId] = useState("");
  const [criterionBId, setCriterionBId] = useState("");
  const [pasteText, setPasteText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [addedKeys, setAddedKeys] = useState<string[]>([]);

  const hasCriteria = profile.criteria.length > 0;

  function reset() {
    setTargets({});
    setRefId("");
    setCriterionAId("");
    setCriterionBId("");
    setPasteText("");
    setError(null);
    setResult(null);
    setAddedKeys([]);
  }

  function selectGroup(key: string) {
    const next = group === key ? null : key;
    setGroup(next);
    // Grupo de um sub-modo só (Importar) já abre nele — não faz sentido pedir dois toques.
    const subs = GROUPS.find((g) => g.key === next)?.subs || [];
    setSub(next && subs.length === 1 ? subs[0].key : null);
    reset();
  }

  function selectSub(key: string) {
    setSub(sub === key ? null : key);
    reset();
  }

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

  function markAdded(key: string) {
    setAddedKeys((prev) => [...prev, key]);
  }

  async function run(fn: () => Promise<any>) {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const r = await fn();
      setResult(r);
    } catch (err: any) {
      setError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível gerar agora.");
    } finally {
      setLoading(false);
    }
  }

  const targetCriteria = profile.criteria.filter((c: any) => targets[c.id]).map((c: any) => ({ id: c.id, label: c.label, direction: targets[c.id] }));

  function addCauseOrPathAsItem(entry: any) {
    if (addedKeys.includes(entry.name)) return;
    const ratings: Record<string, number> = {};
    const ratingMeta: Record<string, any> = {};
    const reasons: Record<string, string> = {};
    targetCriteria.forEach((c: any, i: number) => {
      ratings[c.id] = entry.estimatedRatings ? entry.estimatedRatings[i] || 0 : 0;
      ratingMeta[c.id] = { probability: entry.probability, confidence: entry.confidence };
      reasons[c.id] = entry.reason || "";
    });
    onAddItem(profile.id, {
      name: entry.name,
      variantLabels: [],
      ratings: [ratings],
      reasons: [reasons],
      aiEvaluated: [true],
      ratingMeta: [ratingMeta],
    });
    markAdded(entry.name);
  }

  function addConsequenceAsCriterion(entry: any) {
    if (addedKeys.includes(entry.label)) return;
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
    markAdded(entry.label);
  }

  function saveDirectionAsLink() {
    if (!result || !criterionAId || !criterionBId) return;
    const dir = result.direction;
    const base = { magnitude: result.magnitude, probability: result.probability, confidence: result.confidence, reason: result.reason };
    if (dir === "a_causa_b") onSetCriterionLink(profile.id, `${criterionAId}=>${criterionBId}`, criterionAId, criterionBId, base);
    else if (dir === "b_causa_a") onSetCriterionLink(profile.id, `${criterionBId}=>${criterionAId}`, criterionBId, criterionAId, base);
    else if (dir === "bidirecional") {
      onSetCriterionLink(profile.id, `${criterionAId}=>${criterionBId}`, criterionAId, criterionBId, base);
      onSetCriterionLink(profile.id, `${criterionBId}=>${criterionAId}`, criterionBId, criterionAId, base);
    }
    markAdded("direction");
  }

  const directionLabels: Record<string, string> = { a_causa_b: "A causa B", b_causa_a: "B causa A", bidirecional: "Se retroalimentam", confundida: "Correlação sem causa direta clara" };

  const [extraction, setExtraction] = useState<any>(null);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [checkedCriteria, setCheckedCriteria] = useState<string[]>([]);

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
      setError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível extrair agora.");
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
    markAdded("extraction");
  }

  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink, marginBottom: "6px" }}>
        Diagnóstico & planejamento
      </div>
      <div className="flex gap-2" style={{ marginBottom: "8px" }}>
        {GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => selectGroup(g.key)}
            aria-pressed={group === g.key}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: "34px",
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11.5px",
              color: group === g.key ? "#fff" : COLORS.ink,
              background: group === g.key ? COLORS.lensBlue : COLORS.surface,
              border: `1.5px solid ${group === g.key ? COLORS.lensBlue : COLORS.screenBorder}`,
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {group && (GROUPS.find((g) => g.key === group)?.subs || []).length > 1 && (
        <div className="flex" style={{ flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
          {GROUPS.find((g) => g.key === group)!.subs.map((s) => (
            <button
              key={s.key}
              onClick={() => selectSub(s.key)}
              aria-pressed={sub === s.key}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10px",
                color: sub === s.key ? "#fff" : COLORS.ink,
                background: sub === s.key ? COLORS.screenBorder : COLORS.surface,
                border: `1.5px solid ${COLORS.screenBorder}`,
                borderRadius: "999px",
                padding: "4px 9px",
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {sub && !hasCriteria && sub !== "extrair" && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)" }}>Adicione ao menos um critério antes.</p>
      )}

      {sub === "causas" && hasCriteria && (
        <div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", marginBottom: "6px" }}>
            Marque o(s) critério(s) observado(s) e a direção — 1 só ou vários (síndrome).
          </p>
          <CriteriaTargetPicker criteria={profile.criteria} targets={targets} onCycle={cycleTarget} />
          <button
            onClick={() => run(() => fetchReverseDiagnosis(profile.name, targetCriteria))}
            disabled={loading || !targetCriteria.length}
            className="flex items-center gap-1.5"
            style={primarySmallButton(loading || !targetCriteria.length)}
          >
            {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
            Diagnosticar
          </button>
          {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>}
          {result && (
            <div style={{ marginTop: "8px" }}>
              {result.map((c: any, i: number) => (
                <ResultCard key={i}>
                  <div className="flex items-start justify-between gap-2">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>{c.name}</div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text)", marginTop: "2px" }}>{c.reason}</div>
                      <MetaLine probability={c.probability} confidence={c.confidence} />
                    </div>
                    <button
                      onClick={() => addCauseOrPathAsItem(c)}
                      disabled={addedKeys.includes(c.name)}
                      aria-label={`Adicionar "${c.name}" como item`}
                      style={{ background: "none", border: `1.5px solid ${addedKeys.includes(c.name) ? "var(--success)" : COLORS.lensBlue}`, borderRadius: "999px", color: addedKeys.includes(c.name) ? "var(--success)" : COLORS.lensBlue, padding: "4px 8px", cursor: "pointer", flexShrink: 0 }}
                    >
                      {addedKeys.includes(c.name) ? <Check size={12} /> : "+"}
                    </button>
                  </div>
                </ResultCard>
              ))}
            </div>
          )}
        </div>
      )}

      {sub === "caminhos" && hasCriteria && (
        <div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", marginBottom: "6px" }}>
            Marque o(s) critério(s)-alvo e a direção desejada.
          </p>
          <CriteriaTargetPicker criteria={profile.criteria} targets={targets} onCycle={cycleTarget} />
          <button
            onClick={() => run(() => fetchGoalPaths(profile.name, targetCriteria))}
            disabled={loading || !targetCriteria.length}
            className="flex items-center gap-1.5"
            style={primarySmallButton(loading || !targetCriteria.length)}
          >
            {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
            Sugerir caminhos
          </button>
          {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>}
          {result && (
            <div style={{ marginTop: "8px" }}>
              {result.map((p: any, i: number) => (
                <ResultCard key={i}>
                  <div className="flex items-start justify-between gap-2">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>{p.name}</div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text)", marginTop: "2px" }}>{p.reason}</div>
                      <MetaLine probability={p.probability} confidence={p.confidence} />
                    </div>
                    <button
                      onClick={() => addCauseOrPathAsItem(p)}
                      disabled={addedKeys.includes(p.name)}
                      aria-label={`Adicionar "${p.name}" como item`}
                      style={{ background: "none", border: `1.5px solid ${addedKeys.includes(p.name) ? "var(--success)" : COLORS.lensBlue}`, borderRadius: "999px", color: addedKeys.includes(p.name) ? "var(--success)" : COLORS.lensBlue, padding: "4px 8px", cursor: "pointer", flexShrink: 0 }}
                    >
                      {addedKeys.includes(p.name) ? <Check size={12} /> : "+"}
                    </button>
                  </div>
                </ResultCard>
              ))}
            </div>
          )}
        </div>
      )}

      {sub === "consequencias" && hasCriteria && (
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
          <button
            onClick={() => {
              const ref = refKind === "item" ? profile.items.find((it: any) => it.id === refId) : profile.criteria.find((c: any) => c.id === refId);
              if (!ref) return;
              const label = refKind === "item" ? ref.name : ref.label;
              const summary = refKind === "item" ? Object.entries(currentRatings(ref)).map(([, v]) => v).length + " critérios avaliados" : "";
              run(() => fetchForwardConsequences(profile.name, label, summary));
            }}
            disabled={loading || !refId}
            className="flex items-center gap-1.5"
            style={primarySmallButton(loading || !refId)}
          >
            {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
            Ver consequências
          </button>
          {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>}
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
                      onClick={() => addConsequenceAsCriterion(c)}
                      disabled={addedKeys.includes(c.label)}
                      aria-label={`Adicionar "${c.label}" como critério ligado`}
                      style={{ background: "none", border: `1.5px solid ${addedKeys.includes(c.label) ? "var(--success)" : COLORS.lensBlue}`, borderRadius: "999px", color: addedKeys.includes(c.label) ? "var(--success)" : COLORS.lensBlue, padding: "4px 8px", cursor: "pointer", flexShrink: 0 }}
                    >
                      {addedKeys.includes(c.label) ? <Check size={12} /> : "+"}
                    </button>
                  </div>
                </ResultCard>
              ))}
            </div>
          )}
        </div>
      )}

      {sub === "prognostico" && hasCriteria && (
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
            <select value={criterionAId} onChange={(e) => setCriterionAId(e.target.value)} style={inputStyle}>
              <option value="">critério-alvo...</option>
              {profile.criteria.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              const item = profile.items.find((it: any) => it.id === refId);
              const crit = profile.criteria.find((c: any) => c.id === criterionAId);
              if (!item || !crit) return;
              run(() => fetchPrognosis(profile.name, item.name, crit.label));
            }}
            disabled={loading || !refId || !criterionAId}
            className="flex items-center gap-1.5"
            style={primarySmallButton(loading || !refId || !criterionAId)}
          >
            {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
            Estimar prognóstico
          </button>
          {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>}
          {result && (
            <ResultCard>
              <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>
                {probabilityLabel(result.probability)} · {result.timeframe} · nota esperada {result.expectedMagnitude > 0 ? "+" : ""}
                {result.expectedMagnitude}
              </div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text)", marginTop: "4px", lineHeight: 1.4 }}>{result.reason}</div>
              <MetaLine confidence={result.confidence} />
              <button
                onClick={() => {
                  const item = profile.items.find((it: any) => it.id === refId);
                  if (!item) return;
                  const text = `Prognóstico: ${probabilityLabel(result.probability)} de atingir a meta em ${result.timeframe} (nota esperada ${result.expectedMagnitude > 0 ? "+" : ""}${result.expectedMagnitude}). ${result.reason}`;
                  onUpdateItemNote(profile.id, item.id, item.note ? `${item.note}\n\n${text}` : text);
                  markAdded("prognosis");
                }}
                disabled={addedKeys.includes("prognosis")}
                style={{ ...primarySmallButton(addedKeys.includes("prognosis")), marginTop: "6px" }}
              >
                {addedKeys.includes("prognosis") ? "Salvo na nota" : "Salvar na nota do item"}
              </button>
            </ResultCard>
          )}
        </div>
      )}

      {sub === "protocolo" && hasCriteria && (
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
          <button
            onClick={() => {
              const item = profile.items.find((it: any) => it.id === refId);
              if (!item) return;
              run(() => fetchProtocol(profile.name, item.name, targetCriteria));
            }}
            disabled={loading || !refId}
            className="flex items-center gap-1.5"
            style={primarySmallButton(loading || !refId)}
          >
            {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
            Recomendar protocolo
          </button>
          {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>}
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
                  markAdded("protocol");
                }}
                disabled={addedKeys.includes("protocol")}
                style={{ ...primarySmallButton(addedKeys.includes("protocol")), marginTop: "6px" }}
              >
                {addedKeys.includes("protocol") ? "Salvo no item" : "Salvar no item"}
              </button>
            </ResultCard>
          )}
        </div>
      )}

      {sub === "indicadores" && hasCriteria && (
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
          <button
            onClick={() => {
              const item = profile.items.find((it: any) => it.id === refId);
              if (!item) return;
              run(() => fetchIndicators(profile.name, item.name));
            }}
            disabled={loading || !refId}
            className="flex items-center gap-1.5"
            style={primarySmallButton(loading || !refId)}
          >
            {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
            Listar indicadores
          </button>
          {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>}
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
                  markAdded("indicators");
                }}
                disabled={addedKeys.includes("indicators")}
                style={{ ...primarySmallButton(addedKeys.includes("indicators")), marginTop: "8px" }}
              >
                {addedKeys.includes("indicators") ? "Salvo no item" : "Salvar no item"}
              </button>
            </ResultCard>
          )}
        </div>
      )}

      {sub === "direcao" && hasCriteria && (
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
            onClick={() => {
              const a = profile.criteria.find((c: any) => c.id === criterionAId);
              const b = profile.criteria.find((c: any) => c.id === criterionBId);
              if (!a || !b || a.id === b.id) return;
              run(() => fetchDirectionArbitration(profile.name, a.label, b.label));
            }}
            disabled={loading || !criterionAId || !criterionBId || criterionAId === criterionBId}
            className="flex items-center gap-1.5"
            style={primarySmallButton(loading || !criterionAId || !criterionBId || criterionAId === criterionBId)}
          >
            {loading ? <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={12} />}
            Arbitrar direção
          </button>
          {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>}
          {result && (
            <ResultCard>
              <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>{directionLabels[result.direction] || result.direction}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text)", marginTop: "4px", lineHeight: 1.4 }}>{result.reason}</div>
              <MetaLine probability={result.probability} confidence={result.confidence} />
              {result.direction !== "confundida" && (
                <button onClick={saveDirectionAsLink} disabled={addedKeys.includes("direction")} style={{ ...primarySmallButton(addedKeys.includes("direction")), marginTop: "6px" }}>
                  {addedKeys.includes("direction") ? "Salvo como ligação" : "Salvar como ligação causal"}
                </button>
              )}
            </ResultCard>
          )}
        </div>
      )}

      {sub === "extrair" && (
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
          {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>}
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
      )}
    </div>
  );
}
