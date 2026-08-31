import { useState, type ComponentType, type ReactNode } from "react";
import { GitCompare, HelpCircle, ListChecks, Loader2 } from "lucide-react";
import { COLORS } from "../../../theme";
import {
  currentRatings,
  currentVariantIndex,
  pairKey,
} from "../lib/effectProfiles";
import { fetchComparisonMechanism, fetchComparisonVerdict, fetchComparisonScenarios } from "../lib/effectsApi";
import { MissingApiKeyError } from "../lib/anthropic";
import ScaledBar from "../components/ScaledBar";

const selectStyle = {
  width: "100%",
  borderRadius: "8px",
  border: `1.5px solid ${COLORS.screenBorder}`,
  padding: "9px 10px",
  fontFamily: "Inter, sans-serif",
  fontSize: "12.5px",
  background: COLORS.surface,
  color: COLORS.ink,
  outline: "none",
};

function itemLabel(item: any) {
  const idx = currentVariantIndex(item);
  const suffix = item.variantLabels && item.variantLabels.length ? ` (${item.variantLabels[idx]})` : "";
  return item.name + suffix;
}

function ratingsSummary(item: any, criteria: any[]) {
  const ratings = currentRatings(item);
  return criteria.map((c) => `${c.label}: ${((ratings as any)[c.id] || 0) > 0 ? "+" : ""}${(ratings as any)[c.id] || 0}`).join(", ");
}

/** Uma seção de explicação sob demanda (mecanismo/veredito/situações), com cache persistido no perfil. */
function ExplainSection({
  icon: Icon,
  label,
  cached,
  onGenerate,
}: {
  id: string;
  icon: ComponentType<any>;
  label: string;
  cached: ReactNode;
  onGenerate: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (cached) return;
    setError(null);
    setLoading(true);
    try {
      await onGenerate();
    } catch (err: any) {
      setError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível gerar agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: "10px" }}>
      <button
        onClick={toggle}
        aria-label={label}
        className="flex items-center gap-1.5"
        style={{
          background: "none",
          border: `1.5px solid ${expanded ? COLORS.lensBlue : COLORS.screenBorder}`,
          borderRadius: "999px",
          color: expanded ? COLORS.lensBlue : COLORS.ink,
          fontFamily: "Inter, sans-serif",
          fontSize: "11.5px",
          padding: "5px 12px",
          cursor: "pointer",
        }}
      >
        {loading ? <Loader2 size={13} style={{ animation: "spin 0.9s linear infinite" }} /> : <Icon size={13} />}
        {label}
      </button>
      {expanded && (
        <div style={{ marginTop: "6px" }}>
          {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--danger)" }}>{error}</p>}
          {!error && cached}
        </div>
      )}
    </div>
  );
}

const mechanismBox = {
  background: COLORS.surface,
  border: `1.5px solid ${COLORS.screenBorder}`,
  borderRadius: "8px",
  padding: "8px 10px",
  marginBottom: "6px",
};

/**
 * Aba de comparação item-a-item, dentro de um perfil: barras escaladas lado a
 * lado por critério (mesma estrutura visual da barra proporcional do efeito
 * combinado) e três explicações sob demanda geradas pela IA — mecanismo de
 * cada item, veredito de qual é preferível e situações em que cada um se
 * destaca. Tudo fica em cache no próprio perfil (profile.comparisons),
 * indexado pelo par de itens.
 */
export default function CompareView({ profiles, onSetComparisonCache }: { profiles: Record<string, any>; onSetComparisonCache: (profileId: string, key: string, patch: any) => void }) {
  const comparable = Object.values(profiles || {}).filter((p: any) => p.items.length >= 2);
  const [profileId, setProfileId] = useState((comparable[0] as any)?.id || "");
  const [itemAId, setItemAId] = useState("");
  const [itemBId, setItemBId] = useState("");

  const profile = comparable.find((p: any) => p.id === profileId) || null;
  const itemA = (profile as any)?.items.find((it: any) => it.id === itemAId) || null;
  const itemB = (profile as any)?.items.find((it: any) => it.id === itemBId) || null;
  const key = itemA && itemB ? pairKey(itemA.id, itemB.id) : null;
  const cached = key ? ((profile as any).comparisons || {})[key] || {} : {};

  function selectProfile(id: string) {
    setProfileId(id);
    setItemAId("");
    setItemBId("");
  }

  async function generateMechanism() {
    const criteria = (profile as any).criteria.map((c: any) => c.label);
    const result = await fetchComparisonMechanism(
      (profile as any).name,
      itemLabel(itemA),
      ratingsSummary(itemA, (profile as any).criteria),
      itemLabel(itemB),
      ratingsSummary(itemB, (profile as any).criteria),
      criteria
    );
    onSetComparisonCache((profile as any).id, key!, { mechanism: result });
  }

  async function generateVerdict() {
    const criteria = (profile as any).criteria.map((c: any) => c.label);
    const text = await fetchComparisonVerdict(
      (profile as any).name,
      itemLabel(itemA),
      ratingsSummary(itemA, (profile as any).criteria),
      itemLabel(itemB),
      ratingsSummary(itemB, (profile as any).criteria),
      criteria
    );
    onSetComparisonCache((profile as any).id, key!, { verdict: text });
  }

  async function generateScenarios() {
    const criteria = (profile as any).criteria.map((c: any) => c.label);
    const result = await fetchComparisonScenarios(
      (profile as any).name,
      itemLabel(itemA),
      ratingsSummary(itemA, (profile as any).criteria),
      itemLabel(itemB),
      ratingsSummary(itemB, (profile as any).criteria),
      criteria
    );
    onSetComparisonCache((profile as any).id, key!, { scenarios: result });
  }

  return (
    <div>
      <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink, marginBottom: "12px" }}>
        Comparar
      </h2>

      {comparable.length === 0 ? (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text-muted)", textAlign: "center", marginTop: "20px" }}>
          Crie um perfil com pelo menos 2 itens em Efeitos pra comparar.
        </p>
      ) : (
        <>
          <select value={profileId} onChange={(e) => selectProfile(e.target.value)} style={{ ...selectStyle, marginBottom: "8px" }} aria-label="Perfil">
            {comparable.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2" style={{ marginBottom: "14px" }}>
            <select value={itemAId} onChange={(e) => setItemAId(e.target.value)} style={selectStyle} aria-label="Item A">
              <option value="">Item A...</option>
              {(profile as any).items.map((it: any) => (
                <option key={it.id} value={it.id} disabled={it.id === itemBId}>
                  {itemLabel(it)}
                </option>
              ))}
            </select>
            <select value={itemBId} onChange={(e) => setItemBId(e.target.value)} style={selectStyle} aria-label="Item B">
              <option value="">Item B...</option>
              {(profile as any).items.map((it: any) => (
                <option key={it.id} value={it.id} disabled={it.id === itemAId}>
                  {itemLabel(it)}
                </option>
              ))}
            </select>
          </div>

          {itemA && itemB && (
            <>
              <div
                style={{
                  background: COLORS.surface,
                  border: `2px solid ${COLORS.screenBorder}`,
                  borderRadius: "10px",
                  padding: "10px 12px",
                  marginBottom: "14px",
                }}
              >
                <div className="flex items-center justify-between gap-2" style={{ marginBottom: "8px" }}>
                  <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12.5px", color: COLORS.ink }}>{itemLabel(itemA)}</span>
                  <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12.5px", color: COLORS.ink }}>{itemLabel(itemB)}</span>
                </div>
                {(profile as any).criteria.map((c: any) => {
                  const a = (currentRatings(itemA) as any)[c.id] || 0;
                  const b = (currentRatings(itemB) as any)[c.id] || 0;
                  return (
                    <div key={c.id} style={{ marginBottom: "8px" }}>
                      <div
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: "9.5px",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                          marginBottom: "2px",
                        }}
                      >
                        {c.label}
                      </div>
                      <ScaledBar value={a} max={5} />
                      <ScaledBar value={b} max={5} />
                    </div>
                  );
                })}
              </div>

              <ExplainSection
                id="mechanism"
                icon={HelpCircle}
                label="Mecanismo de cada"
                cached={
                  cached.mechanism && (
                    <>
                      <div style={mechanismBox}>
                        <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11.5px", color: COLORS.ink, marginBottom: "4px" }}>
                          {itemLabel(itemA)}
                        </div>
                        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", lineHeight: 1.4, margin: 0 }}>
                          {cached.mechanism.itemA}
                        </p>
                      </div>
                      <div style={mechanismBox}>
                        <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11.5px", color: COLORS.ink, marginBottom: "4px" }}>
                          {itemLabel(itemB)}
                        </div>
                        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", lineHeight: 1.4, margin: 0 }}>
                          {cached.mechanism.itemB}
                        </p>
                      </div>
                    </>
                  )
                }
                onGenerate={generateMechanism}
              />

              <ExplainSection
                id="verdict"
                icon={GitCompare}
                label="Qual é melhor e por quê"
                cached={
                  cached.verdict && (
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", lineHeight: 1.4 }}>{cached.verdict}</p>
                  )
                }
                onGenerate={generateVerdict}
              />

              <ExplainSection
                id="scenarios"
                icon={ListChecks}
                label="Quando escolher cada um"
                cached={
                  cached.scenarios && (
                    <>
                      <div style={mechanismBox}>
                        <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11.5px", color: COLORS.ink, marginBottom: "4px" }}>
                          {itemLabel(itemA)}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: "16px", fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", lineHeight: 1.5 }}>
                          {cached.scenarios.itemA.map((s: string, i: number) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div style={mechanismBox}>
                        <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11.5px", color: COLORS.ink, marginBottom: "4px" }}>
                          {itemLabel(itemB)}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: "16px", fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", lineHeight: 1.5 }}>
                          {cached.scenarios.itemB.map((s: string, i: number) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )
                }
                onGenerate={generateScenarios}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
