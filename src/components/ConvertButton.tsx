import { useState } from "react";
import { Repeat2 } from "lucide-react";
import { COLORS } from "../theme";
import { ITEM_KINDS, KIND_LABELS } from "../lib/savedModel";

/**
 * Converte o card entre técnica, conceito e tipo. Abre um menuzinho com os
 * dois destinos possíveis; a conversão em si é local e instantânea (ver
 * lib/convert.js), e o card resultante é quem oferece completar com IA.
 */
interface ConvertButtonProps {
  kind: string;
  onConvert?: (target: string) => void;
}

export default function ConvertButton({ kind, onConvert }: ConvertButtonProps) {
  const [open, setOpen] = useState(false);
  if (!onConvert) return null;
  const targets = ITEM_KINDS.filter((k) => k !== kind);

  return (
    <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Converter este card em outro tipo"
        title="Converter este card em outro tipo"
        aria-expanded={open}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "9px",
          margin: "-9px",
          display: "flex",
          color: open ? COLORS.lensBlue : COLORS.screenBorder,
        }}
      >
        <Repeat2 size={15} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 5,
            background: COLORS.surface,
            border: `2px solid ${COLORS.screenBorder}`,
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
            minWidth: "132px",
          }}
        >
          {targets.map((target, i) => (
            <button
              key={target}
              onClick={() => {
                setOpen(false);
                onConvert(target);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "9px 12px",
                background: "none",
                border: "none",
                borderBottom: i < targets.length - 1 ? `1px solid ${COLORS.screenBorder}` : "none",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                fontSize: "12px",
                color: COLORS.ink,
                whiteSpace: "nowrap",
              }}
            >
              Virar {KIND_LABELS[target].toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
