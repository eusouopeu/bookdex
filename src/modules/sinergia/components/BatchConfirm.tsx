import { Loader2, X } from "lucide-react";
import { COLORS } from "../../../theme";
import { usd } from "../lib/batchCost";

/** Caixa de confirmação + barra de progresso de um lote de chamadas (ver `useBatchRun`). */
export default function BatchConfirm({ batch }: { batch: any }) {
  const { pending, progress, error, note } = batch;

  if (progress) {
    const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100);
    return (
      <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.lensBlue}`, borderRadius: "8px", padding: "8px 10px", marginTop: "8px" }}>
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: "6px" }}>
          <span className="flex items-center gap-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: COLORS.ink }}>
            <Loader2 size={12} style={{ animation: "spin 0.9s linear infinite" }} />
            {progress.done} de {progress.total}
          </span>
          <button
            onClick={batch.cancel}
            style={{
              background: "none",
              border: `1.5px solid ${COLORS.screenBorder}`,
              borderRadius: "999px",
              color: COLORS.ink,
              fontFamily: "Inter, sans-serif",
              fontSize: "11px",
              padding: "3px 10px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Cancelar
          </button>
        </div>
        <div style={{ height: "6px", borderRadius: "3px", background: "rgba(120,120,120,0.2)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: COLORS.lensBlue, transition: "width 0.2s ease" }} />
        </div>
      </div>
    );
  }

  if (pending) {
    const { estimate } = pending;
    return (
      <div style={{ background: "rgba(255,201,71,0.15)", border: `2px solid ${COLORS.gold}`, borderRadius: "8px", padding: "9px 10px", marginTop: "8px" }}>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: COLORS.ink, lineHeight: 1.45, marginBottom: "8px" }}>
          {pending.label}: <strong>{estimate.calls} chamada(s)</strong> à IA, ~{usd(estimate.cost)} (estimativa grosseira, preço de lista).
          {estimate.limit ? ` Este mês: ${usd(estimate.spent)} de ${usd(estimate.limit)}.` : ""}
          {estimate.exceedsBudget ? " Isso deve estourar o teto mensal — o lote para sozinho quando o teto for atingido." : ""}
        </p>
        <div className="flex gap-2">
          <button
            onClick={batch.confirm}
            style={{
              background: COLORS.lensBlue,
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "7px 14px",
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11.5px",
              cursor: "pointer",
            }}
          >
            Continuar
          </button>
          <button
            onClick={batch.dismiss}
            style={{
              background: "transparent",
              color: COLORS.ink,
              border: `1.5px solid ${COLORS.screenBorder}`,
              borderRadius: "8px",
              padding: "7px 14px",
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11.5px",
              cursor: "pointer",
            }}
          >
            Agora não
          </button>
        </div>
      </div>
    );
  }

  if (error || note) {
    return (
      <div className="flex items-start justify-between gap-2" style={{ marginTop: "8px" }}>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: error ? "var(--danger)" : "var(--text-muted)", lineHeight: 1.4 }}>{error || note}</p>
        <button onClick={batch.dismiss} aria-label="Fechar aviso" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}>
          <X size={12} />
        </button>
      </div>
    );
  }

  return null;
}
