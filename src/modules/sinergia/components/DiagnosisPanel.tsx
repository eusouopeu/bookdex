import { useState } from "react";
import { COLORS } from "../../../theme";
import { fetchReverseDiagnosis, fetchGoalPaths } from "../lib/effectsApi";
import { GROUPS } from "./diagnosis/shared";
import CauseOrPathPanel from "./diagnosis/CauseOrPathPanel";
import ConsequenciasPanel from "./diagnosis/ConsequenciasPanel";
import PrognosticoPanel from "./diagnosis/PrognosticoPanel";
import ProtocoloPanel from "./diagnosis/ProtocoloPanel";
import IndicadoresPanel from "./diagnosis/IndicadoresPanel";
import DirecaoPanel from "./diagnosis/DirecaoPanel";
import ExtrairPanel from "./diagnosis/ExtrairPanel";

/**
 * As perguntas causais que você faz no chat, viradas em botões: causa
 * reversa (1 critério ou uma síndrome de vários), caminhos pra um objetivo,
 * consequências à frente, prognóstico, protocolo de uso, indicadores de
 * acerto/erro, arbitragem de direção causal entre dois critérios, e extração
 * de nós candidatos a partir de um trecho de conversa colado. Cada resultado
 * tem uma ação que grava direto no perfil — nada fica só em texto solto.
 *
 * Esse arquivo só cuida do seletor de grupo ("Explorar"/"Agir"/"Importar") e
 * de sub-modo, e despacha pro painel certo em `./diagnosis/*` — cada um com
 * seu próprio estado de loading/erro/resultado (trocar de sub-modo desmonta
 * o painel anterior, o que já limpa esse estado sozinho).
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

  const hasCriteria = profile.criteria.length > 0;

  function selectGroup(key: string) {
    const next = group === key ? null : key;
    setGroup(next);
    // Grupo de um sub-modo só (Importar) já abre nele — não faz sentido pedir dois toques.
    const subs = GROUPS.find((g) => g.key === next)?.subs || [];
    setSub(next && subs.length === 1 ? subs[0].key : null);
  }

  function selectSub(key: string) {
    setSub(sub === key ? null : key);
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
        <CauseOrPathPanel
          profile={profile}
          onAddItem={onAddItem}
          hint="Marque o(s) critério(s) observado(s) e a direção — 1 só ou vários (síndrome)."
          actionLabel="Diagnosticar"
          fetch={(name, targets) => fetchReverseDiagnosis(name, targets)}
        />
      )}

      {sub === "caminhos" && hasCriteria && (
        <CauseOrPathPanel
          profile={profile}
          onAddItem={onAddItem}
          hint="Marque o(s) critério(s)-alvo e a direção desejada."
          actionLabel="Sugerir caminhos"
          fetch={(name, targets) => fetchGoalPaths(name, targets)}
        />
      )}

      {sub === "consequencias" && hasCriteria && (
        <ConsequenciasPanel
          profile={profile}
          onAddCriterion={onAddCriterion}
          onFillCriterionForItem={onFillCriterionForItem}
          onSetRatingMeta={onSetRatingMeta}
          onSetCriterionLink={onSetCriterionLink}
        />
      )}

      {sub === "prognostico" && hasCriteria && <PrognosticoPanel profile={profile} onUpdateItemNote={onUpdateItemNote} />}

      {sub === "protocolo" && hasCriteria && <ProtocoloPanel profile={profile} onSetItemProtocol={onSetItemProtocol} />}

      {sub === "indicadores" && hasCriteria && <IndicadoresPanel profile={profile} onSetItemIndicators={onSetItemIndicators} />}

      {sub === "direcao" && hasCriteria && <DirecaoPanel profile={profile} onSetCriterionLink={onSetCriterionLink} />}

      {sub === "extrair" && <ExtrairPanel profile={profile} onAddItem={onAddItem} onAddCriterion={onAddCriterion} />}
    </div>
  );
}
