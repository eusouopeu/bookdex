import { useState } from "react";
import { ArrowRight, Plus, X } from "lucide-react";
import { COLORS } from "../theme";
import {
  criterionLinksList,
  criterionLinkKey,
  PROBABILITY_BUCKETS,
  CONFIDENCE_LEVELS,
  probabilityLabel,
  confidenceLabel,
  clampRating,
} from "../lib/effectProfiles";

const fieldSelectStyle = {
  flex: 1,
  minWidth: 0,
  borderRadius: "6px",
  border: `1.5px solid ${COLORS.screenBorder}`,
  padding: "5px 6px",
  fontFamily: "Inter, sans-serif",
  fontSize: "11px",
  background: COLORS.surface,
  color: COLORS.ink,
  outline: "none",
};

/**
 * Ligações causais critério->critério: a peça que faltava pra responder
 * "quem é causa e quem é consequência" entre os critérios de um perfil, sem
 * precisar unificar item e critério num tipo só. Alimenta o cálculo de
 * efeitos indiretos (2ª ordem) mostrado no card de efeito combinado.
 */
export default function CriteriaLinksPanel({ profile, onSetCriterionLink, onRemoveCriterionLink }: any) {
  const [adding, setAdding] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [magnitude, setMagnitude] = useState(2);
  const [probability, setProbability] = useState("provavel");
  const [confidence, setConfidence] = useState("mecanismo");
  const [reason, setReason] = useState("");

  const links = criterionLinksList(profile);
  const labelOf = (id: string) => profile.criteria.find((c: any) => c.id === id)?.label || id;

  if (profile.criteria.length < 2) return null;

  function submit() {
    if (!fromId || !toId || fromId === toId) return;
    const key = criterionLinkKey(fromId, toId);
    onSetCriterionLink(profile.id, key, fromId, toId, { magnitude, probability, confidence, reason: reason.trim() });
    setAdding(false);
    setFromId("");
    setToId("");
    setMagnitude(2);
    setReason("");
  }

  return (
    <div style={{ marginBottom: "14px" }}>
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: "6px" }}>
        <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>
          Ligações causais entre critérios
        </span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1"
          aria-label="Adicionar ligação causal entre dois critérios"
          style={{
            background: "none",
            border: `1.5px dashed ${COLORS.screenBorder}`,
            borderRadius: "999px",
            color: COLORS.screenBorder,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "10px",
            padding: "3px 8px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {adding ? <X size={11} /> : <Plus size={11} />} Ligação
        </button>
      </div>

      {links.length === 0 && !adding && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)" }}>
          Nenhuma ligação ainda — use pra registrar quando um critério causa outro (ex.: "Sono ruim" → "Ansiedade").
        </p>
      )}

      {links.map((link: any) => (
        <div
          key={link.key}
          className="flex items-start justify-between gap-2"
          style={{
            background: "rgba(46,134,222,0.08)",
            border: `1.5px solid ${COLORS.lensBlue}`,
            borderRadius: "8px",
            padding: "5px 8px",
            marginBottom: "5px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center gap-1" style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11.5px", color: COLORS.ink }}>
              {labelOf(link.fromId)} <ArrowRight size={11} /> {labelOf(link.toId)}
            </div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
              {link.magnitude > 0 ? `+${link.magnitude}` : link.magnitude} · {probabilityLabel(link.probability)} · {confidenceLabel(link.confidence)}
            </div>
            {link.reason && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text)", marginTop: "2px" }}>{link.reason}</div>}
          </div>
          <button
            onClick={() => onRemoveCriterionLink(profile.id, link.key)}
            aria-label={`Remover ligação ${labelOf(link.fromId)} -> ${labelOf(link.toId)}`}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {adding && (
        <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "8px" }}>
          <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} style={fieldSelectStyle} aria-label="Critério causa">
              <option value="">causa...</option>
              {profile.criteria.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <ArrowRight size={13} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
            <select value={toId} onChange={(e) => setToId(e.target.value)} style={fieldSelectStyle} aria-label="Critério consequência">
              <option value="">consequência...</option>
              {profile.criteria.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", flexShrink: 0 }}>Magnitude</span>
            <button
              onClick={() => setMagnitude((m) => clampRating(m - 1))}
              aria-label="Diminuir magnitude"
              style={{ width: "22px", height: "22px", borderRadius: "5px", border: `1.5px solid ${COLORS.screenBorder}`, background: "none", cursor: "pointer" }}
            >
              −
            </button>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: "12px", width: "24px", textAlign: "center" }}>
              {magnitude > 0 ? `+${magnitude}` : magnitude}
            </span>
            <button
              onClick={() => setMagnitude((m) => clampRating(m + 1))}
              aria-label="Aumentar magnitude"
              style={{ width: "22px", height: "22px", borderRadius: "5px", border: `1.5px solid ${COLORS.screenBorder}`, background: "none", cursor: "pointer" }}
            >
              +
            </button>
          </div>
          <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
            <select value={probability} onChange={(e) => setProbability(e.target.value)} style={fieldSelectStyle} aria-label="Probabilidade">
              {PROBABILITY_BUCKETS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
            <select value={confidence} onChange={(e) => setConfidence(e.target.value)} style={fieldSelectStyle} aria-label="Confiança">
              {CONFIDENCE_LEVELS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            style={{ ...fieldSelectStyle, width: "100%", marginBottom: "8px" }}
          />
          <button
            onClick={submit}
            disabled={!fromId || !toId || fromId === toId}
            style={{
              background: COLORS.lensBlue,
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11px",
              cursor: !fromId || !toId || fromId === toId ? "default" : "pointer",
              opacity: !fromId || !toId || fromId === toId ? 0.5 : 1,
            }}
          >
            Salvar ligação
          </button>
        </div>
      )}
    </div>
  );
}
