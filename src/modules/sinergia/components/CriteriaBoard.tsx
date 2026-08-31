import { useState } from "react";
import { Check, Loader2, Map, MoreHorizontal, Pencil, Plus, Sparkles, X } from "lucide-react";
import { COLORS } from "../../../theme";
import { criterionWeight } from "../lib/effectProfiles";
import ScaledBar from "./ScaledBar";

/**
 * Critérios e efeito combinado num quadro só: uma LINHA por critério, com o
 * nome, as ações do critério e, na mesma linha, o total dele na combinação
 * ativa (barra proporcional + número). Antes eram dois blocos separados — as
 * tags de critério em cima e as barras do efeito combinado embaixo — e era
 * preciso casar os dois na cabeça.
 *
 * Tocar no nome oculta/mostra o critério: oculto some dos cards de item e sai
 * da barra (linha cinza, valor "—"), mas continua existindo e contando no
 * score. As ações menos frequentes (peso) ficam no "⋯", pra linha caber num
 * celular sem virar um amontoado de alvos de 10px.
 */
export default function CriteriaBoard({
  profile,
  totals,
  combinedMaxValue,
  weightedTotal,
  scorePct,
  secondOrderTotals,
  activeCount,
  missingCountFor,
  fillingCriterionId,
  onFillMissing,
  onAddCriterion,
  onRenameCriterion,
  onSetCriterionWeight,
  onSetCriterionHidden,
  onRemoveCriterion,
  onOpenCausalMap,
  onToggleSaturation,
}: any) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  const visible = profile.criteria.filter((c: any) => !c.hidden);
  const hidden = profile.criteria.filter((c: any) => c.hidden);
  const hasSecondOrder = Object.values(secondOrderTotals || {}).some((v: any) => Math.abs(v) >= 0.5);

  function submitAdd() {
    const clean = draft.trim();
    if (clean) onAddCriterion(clean);
    setDraft("");
    setAdding(false);
  }

  function submitEdit() {
    const clean = editLabel.trim();
    if (clean && editingId) onRenameCriterion(editingId, clean);
    setEditingId(null);
  }

  function iconButton(color: string) {
    return {
      width: "24px",
      height: "24px",
      flexShrink: 0,
      background: "none",
      border: "none",
      cursor: "pointer",
      color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
    } as const;
  }

  function renderRow(c: any) {
    const isHidden = !!c.hidden;
    const weight = criterionWeight(c);
    const missing = missingCountFor(c.id);
    const total = totals[c.id] || 0;
    const muted = isHidden ? "var(--text-faint)" : COLORS.ink;

    return (
      <div key={c.id} style={{ marginBottom: "6px" }}>
        <div className="flex items-center" style={{ gap: "3px" }}>
          <button onClick={() => setConfirmingRemoveId(confirmingRemoveId === c.id ? null : c.id)} aria-label={`Remover critério ${c.label}`} style={iconButton("var(--text-muted)")}>
            <X size={14} />
          </button>

          {editingId === c.id ? (
            <input
              autoFocus
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onBlur={submitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitEdit();
                if (e.key === "Escape") setEditingId(null);
              }}
              style={{
                flex: "1 1 72px",
                minWidth: 0,
                fontFamily: "Inter, sans-serif",
                fontSize: "11.5px",
                color: COLORS.ink,
                background: COLORS.surface,
                border: `1.5px solid ${COLORS.lensBlue}`,
                borderRadius: "8px",
                padding: "5px 8px",
                outline: "none",
              }}
            />
          ) : (
            <button
              onClick={() => onSetCriterionHidden(c.id, !isHidden)}
              aria-pressed={!isHidden}
              aria-label={isHidden ? `Mostrar critério ${c.label}` : `Ocultar critério ${c.label}`}
              title={isHidden ? "Oculto nos cards — tocar para mostrar" : "Visível nos cards — tocar para ocultar"}
              style={{
                flex: "1 1 72px",
                minWidth: 0,
                textAlign: "left",
                fontFamily: "Inter, sans-serif",
                fontSize: "11.5px",
                color: muted,
                background: isHidden ? "rgba(120,120,120,0.12)" : "rgba(46,134,222,0.10)",
                border: `1.5px solid ${isHidden ? "var(--text-faint)" : COLORS.lensBlue}`,
                borderRadius: "8px",
                padding: "5px 8px",
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.label}
            </button>
          )}

          <button
            onClick={() => setMenuId(menuId === c.id ? null : c.id)}
            aria-label={`Mais opções de ${c.label}`}
            aria-expanded={menuId === c.id}
            style={iconButton("var(--text-muted)")}
          >
            <MoreHorizontal size={14} />
          </button>
          <button
            onClick={() => {
              setEditingId(c.id);
              setEditLabel(c.label);
            }}
            aria-label={`Renomear critério ${c.label}`}
            style={iconButton(muted)}
          >
            <Pencil size={13} />
          </button>
          <button onClick={() => onOpenCausalMap(c.id)} aria-label={`Ver mapa causal de ${c.label}`} title="Mapa causal" style={iconButton(muted)}>
            <Map size={13} />
          </button>

          {missing > 0 && (
            <button
              onClick={() => onFillMissing(c)}
              disabled={fillingCriterionId === c.id}
              aria-label={`Avaliar ${missing} item(ns) sem nota em ${c.label}`}
              title={`${missing} item(ns) sem nota nesse critério`}
              className="flex items-center gap-1"
              style={{
                background: isHidden ? "rgba(120,120,120,0.2)" : COLORS.gold,
                color: isHidden ? "var(--text-muted)" : "#4A3300",
                border: "none",
                borderRadius: "999px",
                padding: "2px 7px",
                fontFamily: "Inter, sans-serif",
                fontSize: "9.5px",
                fontWeight: 700,
                flexShrink: 0,
                cursor: fillingCriterionId === c.id ? "default" : "pointer",
              }}
            >
              {fillingCriterionId === c.id ? <Loader2 size={9} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={9} />}
              {missing}
            </button>
          )}

          <div style={{ flex: "1.4 1 60px", minWidth: 0 }}>
            {isHidden ? (
              <div className="flex items-center gap-2">
                <div style={{ flex: 1, minWidth: 0, borderTop: `1.5px solid ${COLORS.screenBorder}`, opacity: 0.5 }} />
                <span style={{ width: "26px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px", color: "var(--text-faint)" }}>—</span>
              </div>
            ) : (
              <ScaledBar value={total} max={combinedMaxValue} />
            )}
          </div>
        </div>

        {confirmingRemoveId === c.id && (
          <div className="flex items-center gap-2" style={{ margin: "2px 0 6px 24px" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--danger)", flex: 1, minWidth: 0 }}>
              Remover "{c.label}" apaga a nota dele em todos os itens.
            </span>
            <button
              onClick={() => {
                onRemoveCriterion(c.id);
                setConfirmingRemoveId(null);
              }}
              style={{
                background: "var(--danger)",
                color: "#fff",
                border: "none",
                borderRadius: "999px",
                padding: "3px 10px",
                fontFamily: "Inter, sans-serif",
                fontSize: "10.5px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Remover
            </button>
            <button
              onClick={() => setConfirmingRemoveId(null)}
              style={{ background: "none", border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "999px", padding: "3px 10px", fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: COLORS.ink, cursor: "pointer", flexShrink: 0 }}
            >
              Cancelar
            </button>
          </div>
        )}

        {menuId === c.id && (
          <div className="flex items-center gap-2" style={{ margin: "2px 0 6px 24px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)" }}>Peso</span>
            {[0, 1, 2, 3].map((w) => (
              <button
                key={w}
                onClick={() => onSetCriterionWeight(c.id, w)}
                aria-pressed={weight === w}
                aria-label={`Peso ${w} para ${c.label}`}
                style={{
                  minWidth: "30px",
                  minHeight: "30px",
                  borderRadius: "8px",
                  border: `1.5px solid ${weight === w ? COLORS.lensBlue : COLORS.screenBorder}`,
                  background: weight === w ? "rgba(46,134,222,0.12)" : "transparent",
                  color: weight === w ? COLORS.lensBlue : COLORS.ink,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                {w}
              </button>
            ))}
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)" }}>0 = não conta no score</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `2px solid ${COLORS.screenBorder}`,
        borderRadius: "10px",
        padding: "10px 12px",
        marginBottom: "14px",
      }}
    >
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: "10px" }}>
        <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "14px", color: COLORS.ink }}>Efeito combinado</span>
        <span
          title={`${activeCount} item(ns) ativo(s) — ${scorePct}% do máximo teórico`}
          style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "13px", color: "var(--text-muted)", flexShrink: 0 }}
        >
          Score: {weightedTotal > 0 ? `+${weightedTotal}` : weightedTotal}{" "}
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px" }}>({scorePct}%)</span>
        </span>
      </div>

      {profile.criteria.length === 0 && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "8px" }}>
          Nenhum critério ainda. Adicione o primeiro abaixo.
        </p>
      )}

      {visible.map(renderRow)}

      {hidden.length > 0 && (
        <>
          <div style={{ borderTop: `1.5px solid ${COLORS.screenBorder}`, margin: "8px 0" }} />
          {hidden.map(renderRow)}
        </>
      )}

      <div style={{ marginTop: "8px" }}>
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submitAdd}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAdd();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder="novo critério"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "11.5px",
              border: `1.5px solid ${COLORS.lensBlue}`,
              borderRadius: "8px",
              padding: "6px 10px",
              width: "150px",
              background: COLORS.surface,
              color: COLORS.ink,
              outline: "none",
            }}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "11.5px",
              color: "var(--text-muted)",
              background: "transparent",
              border: `1.5px dashed ${COLORS.screenBorder}`,
              borderRadius: "8px",
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            <Plus size={12} /> Critério
          </button>
        )}
      </div>

      {hasSecondOrder && (
        <div style={{ marginTop: "10px", borderTop: `1.5px solid ${COLORS.screenBorder}`, paddingTop: "8px" }}>
          <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "10.5px", color: "var(--text-muted)", marginBottom: "4px" }}>
            Efeitos indiretos estimados (via ligações causais)
          </div>
          <div className="flex" style={{ flexWrap: "wrap", gap: "5px" }}>
            {visible
              .filter((c: any) => Math.abs(secondOrderTotals[c.id] || 0) >= 0.5)
              .map((c: any) => {
                const v = secondOrderTotals[c.id] || 0;
                const color = v > 0 ? "var(--success)" : "var(--danger)";
                return (
                  <span key={c.id} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color, border: `1.5px dashed ${color}`, borderRadius: "999px", padding: "2px 8px" }}>
                    {c.label}: {v > 0 ? "+" : ""}
                    {v.toFixed(1)}
                  </span>
                );
              })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2" style={{ marginTop: "10px", borderTop: `1.5px solid ${COLORS.screenBorder}`, paddingTop: "8px" }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", lineHeight: 1.35 }}>
          Retornos decrescentes — o 2º item que empurra o mesmo critério rende menos que o 1º.
        </span>
        <button
          onClick={() => onToggleSaturation(!profile.saturation)}
          aria-pressed={!!profile.saturation}
          aria-label="Alternar retornos decrescentes no efeito combinado"
          className="flex items-center gap-1"
          style={{
            flexShrink: 0,
            background: profile.saturation ? "rgba(46,134,222,0.12)" : "transparent",
            border: `1.5px solid ${profile.saturation ? COLORS.lensBlue : COLORS.screenBorder}`,
            borderRadius: "999px",
            color: profile.saturation ? COLORS.lensBlue : COLORS.ink,
            fontFamily: "Inter, sans-serif",
            fontSize: "10.5px",
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          {profile.saturation && <Check size={11} />}
          {profile.saturation ? "Ligado" : "Desligado"}
        </button>
      </div>
    </div>
  );
}
