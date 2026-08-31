import { COLORS } from "../theme";

/**
 * Barra proporcional centrada no zero: preenche pra direita (verde) quando o
 * valor é positivo, pra esquerda (vermelho) quando negativo, com a largura do
 * preenchimento proporcional a `max` (o valor que ocuparia a barra inteira de
 * um dos lados) — em vez dos 5 blocos de tamanho fixo do EffectRatingBar, útil
 * quando o valor pode passar de -5/+5 (ex.: efeito combinado) ou quando dois
 * valores em escalas iguais precisam ser comparados lado a lado com precisão
 * visual maior que 5 degraus.
 */
export default function ScaledBar({ label, value, max, height = 10 }: { label?: string; value: number; max?: number; height?: number }) {
  const v = value || 0;
  const safeMax = Math.max(1, max || 1);
  const pct = Math.min(100, (Math.abs(v) / safeMax) * 100);
  const color = v > 0 ? "var(--success)" : v < 0 ? "var(--danger)" : "var(--text-muted)";

  return (
    <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
      {label && (
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "9.5px",
            color: COLORS.ink,
            width: "84px",
            flexShrink: 0,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            lineHeight: 1.15,
          }}
        >
          {label}
        </span>
      )}
      <div
        className="flex items-center"
        style={{
          flex: 1,
          minWidth: 0,
          height: `${height}px`,
          borderRadius: "3px",
          background: "rgba(120,120,120,0.12)",
          border: `1px solid ${COLORS.screenBorder}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", background: COLORS.screenBorder, opacity: 0.6 }} />
        <div
          style={{
            position: "absolute",
            top: "1px",
            bottom: "1px",
            [v >= 0 ? "left" : "right"]: "50%",
            width: `${pct / 2}%`,
            background: color,
            borderRadius: "2px",
          }}
        />
      </div>
      <span
        style={{
          width: "26px",
          flexShrink: 0,
          textAlign: "right",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "10.5px",
          fontWeight: 700,
          color,
        }}
      >
        {v > 0 ? `+${v}` : v}
      </span>
    </div>
  );
}
