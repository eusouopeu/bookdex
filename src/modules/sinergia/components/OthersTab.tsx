import { useState } from "react";
import { Download, Layers, Loader2, X, Zap } from "lucide-react";
import { COLORS } from "../../../theme";
import { fetchPairInteraction } from "../lib/effectsApi";
import { buildProfileBackup, downloadBackup } from "../lib/backup";
import { computeCombinedEffect, computeScenarioTotals, currentRatings, pairKey, snapshotScenario } from "../lib/effectProfiles";
import EffectSuggestionsPanel from "./EffectSuggestionsPanel";
import BatchConfirm from "./BatchConfirm";

function sectionTitle(text: string) {
  return <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink, marginBottom: "6px" }}>{text}</div>;
}

/**
 * Aba "Outros": sugestões de itens novos, cenários A/B, detecção de
 * interação entre pares de itens ativos e exportar só este perfil. Estado de
 * cenário/interações é local — só esta aba usa.
 */
export default function OthersTab({
  profile,
  batch,
  onAddItem,
  onRemoveItem,
  onSetInteraction,
  onRemoveInteraction,
}: {
  profile: any;
  batch: any;
  onAddItem: (profileId: string, payload: any) => void;
  onRemoveItem: (profileId: string, itemId: string) => void;
  onSetInteraction: (profileId: string, key: string, itemAId: string, itemBId: string, adjustments: any, reasons: any) => void;
  onRemoveInteraction: (profileId: string, key: string) => void;
}) {
  const [scenarioA, setScenarioA] = useState<any>(null);

  const hasCriteria = profile.criteria.length > 0;
  const activeItems = profile.items.filter((it: any) => it.active);
  const totals = computeCombinedEffect(profile);
  const visibleCriteria = profile.criteria.filter((c: any) => !c.hidden);
  const scenarioATotals = scenarioA ? computeScenarioTotals(profile, scenarioA) : null;
  const interactionsList = Object.entries(profile.interactions || {}).map(([key, inter]: [string, any]) => {
    const itemA = profile.items.find((it: any) => it.id === inter.itemAId);
    const itemB = profile.items.find((it: any) => it.id === inter.itemBId);
    return { key, ...inter, itemA, itemB };
  });

  function toggleScenarioA() {
    setScenarioA(scenarioA ? null : snapshotScenario(profile));
  }

  async function addSuggestionToProfile(suggestion: any) {
    if (suggestion.kind === "substituicao" && suggestion.replaces) {
      const target = profile.items.find((it: any) => it.name.toLowerCase() === suggestion.replaces.toLowerCase());
      if (target) onRemoveItem(profile.id, target.id);
    }
    const ratings: any = {};
    (suggestion.targetCriteria || []).forEach((c: any, i: number) => {
      ratings[c.id] = suggestion.estimatedRatings ? suggestion.estimatedRatings[i] : 0;
    });
    onAddItem(profile.id, { name: suggestion.name, variantLabels: [], ratings: [ratings], reasons: [{}], aiEvaluated: [true] });
  }

  /** Interações entre todos os pares de itens ativos ainda não avaliados — O(n²) chamadas, agora com aviso e cancelamento. */
  function detectInteractions() {
    if (activeItems.length < 2) return;
    const labels = profile.criteria.map((c: any) => c.label);
    const pairs: any[] = [];
    for (let i = 0; i < activeItems.length; i++) {
      for (let j = i + 1; j < activeItems.length; j++) {
        const key = pairKey(activeItems[i].id, activeItems[j].id);
        if (!(profile.interactions || {})[key]) pairs.push([activeItems[i], activeItems[j], key]);
      }
    }
    if (!pairs.length) return;

    batch.request({
      label: `Avaliar ${pairs.length} par(es) de itens ativos`,
      units: pairs.length,
      calls: pairs.length,
      kind: "interaction",
      run: async (step: () => void, isCancelled: () => boolean) => {
        let failures = 0;
        for (const [itemA, itemB, key] of pairs) {
          if (isCancelled()) break;
          try {
            // eslint-disable-next-line no-await-in-loop
            const result = await fetchPairInteraction(profile.name, itemA.name, itemB.name, labels);
            const adjustments: any = {};
            const reasonsMap: any = {};
            profile.criteria.forEach((c: any, ci: number) => {
              const found = result.find((r: any) => r.criterion === c.label) || result[ci];
              const v = found ? Math.max(-2, Math.min(2, Math.round(found.value))) : 0;
              if (v !== 0) {
                adjustments[c.id] = v;
                reasonsMap[c.id] = found?.reason || "";
              }
            });
            onSetInteraction(profile.id, key, itemA.id, itemB.id, adjustments, reasonsMap);
          } catch {
            failures++;
          }
          step();
        }
        if (failures) throw new Error(`${failures} par(es) não puderam ser avaliados agora.`);
      },
    });
  }

  return (
    <>
      {hasCriteria && (
        <EffectSuggestionsPanel
          profile={profile}
          activeItems={activeItems.map((it: any) => ({ name: it.name, ratings: currentRatings(it) }))}
          onAddSuggestion={addSuggestionToProfile}
        />
      )}

      {/* Cenários A/B — congela a seleção ativa atual como Cenário A pra comparar com o que você for montando depois */}
      <div style={{ marginBottom: "14px" }}>
        {sectionTitle("Cenários A/B")}
        <button
          onClick={toggleScenarioA}
          className="flex items-center gap-1.5"
          style={{
            background: "none",
            border: `1.5px solid ${scenarioA ? COLORS.lensBlue : COLORS.screenBorder}`,
            borderRadius: "999px",
            color: scenarioA ? COLORS.lensBlue : COLORS.ink,
            fontFamily: "Inter, sans-serif",
            fontSize: "10.5px",
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          <Layers size={11} />
          {scenarioA ? "Limpar cenário A" : "Fixar seleção atual como Cenário A"}
        </button>

        {scenarioA && (
          <div style={{ marginTop: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)", textAlign: "right" }}>
                  <th style={{ textAlign: "left", fontWeight: 400 }}>Critério</th>
                  <th style={{ fontWeight: 400 }}>A</th>
                  <th style={{ fontWeight: 400 }}>B (atual)</th>
                  <th style={{ fontWeight: 400 }}>Δ</th>
                </tr>
              </thead>
              <tbody>
                {visibleCriteria.map((c: any) => {
                  const a = (scenarioATotals as any)[c.id] || 0;
                  const b = (totals as any)[c.id] || 0;
                  const delta = Math.round((b - a) * 10) / 10;
                  const deltaColor = delta > 0 ? "var(--success)" : delta < 0 ? "var(--danger)" : "var(--text-muted)";
                  return (
                    <tr key={c.id} style={{ borderTop: `1px solid ${COLORS.screenBorder}` }}>
                      <td style={{ padding: "3px 0", fontFamily: "Inter, sans-serif", color: COLORS.ink }}>{c.label}</td>
                      <td style={{ textAlign: "right", color: "var(--text-muted)" }}>{a > 0 ? `+${a}` : a}</td>
                      <td style={{ textAlign: "right", color: COLORS.ink }}>{b > 0 ? `+${b}` : b}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: deltaColor }}>{delta > 0 ? `+${delta}` : delta}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
              Ative/desative itens na aba Geral pra montar o Cenário B e comparar com o A congelado.
            </p>
          </div>
        )}
      </div>

      {/* Interações entre itens ativos — sinergia/antagonismo além da soma simples */}
      <div style={{ marginBottom: "14px" }}>
        {sectionTitle("Interações entre itens ativos")}
        <button
          onClick={detectInteractions}
          disabled={activeItems.length < 2 || !!batch.progress}
          className="flex items-center gap-1.5"
          aria-label="Detectar interações entre os itens ativos"
          style={{
            background: "none",
            border: `1.5px solid ${COLORS.screenBorder}`,
            borderRadius: "999px",
            color: COLORS.ink,
            fontFamily: "Inter, sans-serif",
            fontSize: "10.5px",
            padding: "4px 10px",
            cursor: activeItems.length < 2 || batch.progress ? "default" : "pointer",
            opacity: activeItems.length < 2 || batch.progress ? 0.6 : 1,
          }}
        >
          {batch.progress ? <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} /> : <Zap size={11} />}
          Detectar interações ({activeItems.length} ativo{activeItems.length === 1 ? "" : "s"})
        </button>
        <BatchConfirm batch={batch} />
        {interactionsList.length > 0 && (
          <div className="flex flex-col gap-1" style={{ marginTop: "8px" }}>
            {interactionsList.map(({ key, itemA, itemB, adjustments, reasons }: any) => {
              if (!itemA || !itemB) return null;
              const parts = Object.entries(adjustments || {})
                .map(([critId, v]: [string, any]) => {
                  const c = profile.criteria.find((cr: any) => cr.id === critId);
                  return c ? `${c.label} ${v > 0 ? "+" : ""}${v}` : null;
                })
                .filter(Boolean);
              const reasonText = Object.values(reasons || {})[0];
              return (
                <div
                  key={key}
                  className="flex items-start justify-between gap-2"
                  style={{ background: "rgba(46,134,222,0.08)", border: `1.5px solid ${COLORS.lensBlue}`, borderRadius: "8px", padding: "5px 8px" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: COLORS.ink }}>
                      {itemA.name} × {itemB.name}
                    </div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {parts.length ? parts.join(" · ") : "sem ajuste"}
                    </div>
                    {reasonText ? <div style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text)", marginTop: "2px" }}>{reasonText as string}</div> : null}
                  </div>
                  <button
                    onClick={() => onRemoveInteraction(profile.id, key)}
                    aria-label={`Remover interação entre ${itemA.name} e ${itemB.name}`}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "14px" }}>
        {sectionTitle("Exportar")}
        <button
          onClick={() => downloadBackup(buildProfileBackup(profile), profile.name)}
          className="flex items-center gap-1.5"
          style={{
            background: "none",
            border: `1.5px solid ${COLORS.screenBorder}`,
            borderRadius: "999px",
            color: COLORS.ink,
            fontFamily: "Inter, sans-serif",
            fontSize: "10.5px",
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          <Download size={11} /> Exportar só este perfil
        </button>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
          Gera um arquivo com este perfil só. Na importação (Configurações) dá pra mesclar sem tocar nos outros.
        </p>
      </div>
    </>
  );
}
