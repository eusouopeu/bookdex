import { ArrowLeft } from "lucide-react";
import { COLORS } from "../../../theme";
import { currentRatings, currentRatingMeta, expectedValue, probabilityLabel, criterionLinksList } from "../lib/effectProfiles";

function CausalRow({ label, magnitude, probability, reversed }: { label: string; magnitude: number; probability?: string; reversed?: boolean }) {
  const ev = expectedValue(magnitude, probability);
  const color = magnitude > 0 ? "var(--success)" : magnitude < 0 ? "var(--danger)" : "var(--text-muted)";
  const widthPct = Math.min(100, (Math.abs(ev) / 5) * 100);
  return (
    <div style={{ marginBottom: "8px" }}>
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color, flexShrink: 0 }}>
          {magnitude > 0 ? `+${magnitude}` : magnitude} · {probabilityLabel(probability)}
        </span>
      </div>
      <svg width="100%" height="10" style={{ display: "block", marginTop: "3px" }} aria-hidden="true">
        <line x1="2" y1="5" x2="calc(100% - 2px)" y2="5" stroke={COLORS.screenBorder} strokeWidth="1" opacity="0.3" />
        <line
          x1={reversed ? `${100 - widthPct}%` : "0%"}
          y1="5"
          x2={reversed ? "100%" : `${widthPct}%`}
          y2="5"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Mapa causal de um critério: causas à esquerda/acima (o que afeta ele —
 * itens avaliados nele + critérios ligados via `criteriaLinks`), consequências
 * abaixo (critérios que ele afeta via `criteriaLinks`). 1 salto só, largura da
 * barra proporcional ao valor esperado (magnitude × probabilidade).
 */
export default function CausalMapView({ profile, criterionId, onBack }: { profile: any; criterionId: string; onBack: () => void }) {
  const criterion = profile.criteria.find((c: any) => c.id === criterionId);
  if (!criterion) return null;

  const causesFromItems = profile.items
    .map((item: any) => {
      const ratings = currentRatings(item);
      const meta = currentRatingMeta(item);
      const magnitude = (ratings as any)[criterionId] || 0;
      if (!magnitude) return null;
      return { label: item.name, magnitude, probability: (meta as any)[criterionId]?.probability };
    })
    .filter(Boolean);

  const links = criterionLinksList(profile);
  const causesFromCriteria = links
    .filter((l: any) => l.toId === criterionId)
    .map((l: any) => ({ label: profile.criteria.find((c: any) => c.id === l.fromId)?.label || l.fromId, magnitude: l.magnitude, probability: l.probability }));
  const consequences = links
    .filter((l: any) => l.fromId === criterionId)
    .map((l: any) => ({ label: profile.criteria.find((c: any) => c.id === l.toId)?.label || l.toId, magnitude: l.magnitude, probability: l.probability }));

  const causes = [...causesFromCriteria, ...causesFromItems].sort((a: any, b: any) => Math.abs(b.magnitude) - Math.abs(a.magnitude));

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5"
        style={{
          background: "none",
          border: "none",
          color: COLORS.ink,
          fontFamily: '"Baloo 2", sans-serif',
          fontWeight: 700,
          fontSize: "12.5px",
          cursor: "pointer",
          padding: "8px 8px 8px 0",
          minHeight: "40px",
        }}
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <div
        style={{
          background: COLORS.surface,
          border: `2.5px solid ${COLORS.lensBlue}`,
          borderRadius: "10px",
          padding: "10px 12px",
          marginBottom: "14px",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "16px", color: COLORS.ink }}>{criterion.label}</div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)" }}>Mapa causal (1 salto)</div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink, marginBottom: "8px" }}>
          Causas ({causes.length})
        </div>
        {causes.length === 0 && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)" }}>
            Nenhuma causa conhecida — itens avaliados nesse critério ou ligações causais de outro critério aparecem aqui.
          </p>
        )}
        {causes.map((c: any, i: number) => (
          <CausalRow key={i} label={c.label} magnitude={c.magnitude} probability={c.probability} />
        ))}
      </div>

      <div>
        <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink, marginBottom: "8px" }}>
          Consequências ({consequences.length})
        </div>
        {consequences.length === 0 && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)" }}>
            Nenhuma ligação causal saindo desse critério ainda — adicione em "Ligações causais entre critérios".
          </p>
        )}
        {consequences.map((c: any, i: number) => (
          <CausalRow key={i} label={c.label} magnitude={c.magnitude} probability={c.probability} reversed />
        ))}
      </div>
    </div>
  );
}
