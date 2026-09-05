import { useState } from "react";
import { Droplet } from "lucide-react";
import { COLORS } from "../theme";
import { PLANT_WATER_TYPES, WATER_SEASONS, estimateWatering } from "../lib/waterCalculator";
import { GREEN_TINT, aspectButtonStyle } from "./AspectButtons";

const selectStyle = {
  flex: 1,
  minWidth: 0,
  borderRadius: "8px",
  border: `1.5px solid ${COLORS.screenBorder}`,
  padding: "7px 8px",
  fontFamily: "Inter, sans-serif",
  fontSize: "11.5px",
  background: COLORS.surface,
  color: COLORS.ink,
  outline: "none",
};

/**
 * Calculadora de água: diâmetro do vaso + tipo de planta + estação → quanto
 * regar e a cada quantos dias. Pura conta local (ver lib/waterCalculator.ts),
 * sem chamada de API — abre/fecha igual aos botões de aspecto, mesmo tint.
 */
export default function WaterCalculatorPanel() {
  const [open, setOpen] = useState(false);
  const [diameter, setDiameter] = useState("15");
  const [typeId, setTypeId] = useState(PLANT_WATER_TYPES[0].id);
  const [seasonId, setSeasonId] = useState(WATER_SEASONS[1].id);

  const result = estimateWatering(Number(diameter), typeId, seasonId);

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: "8px", flex: open ? "1 1 100%" : "0 0 auto" }}>
      <button onClick={() => setOpen((v) => !v)} aria-pressed={open} aria-label="Calculadora de água" title="Calculadora de água" style={aspectButtonStyle(open, false, GREEN_TINT)}>
        <Droplet size={15} />
      </button>
      {open && (
        <div
          style={{
            marginTop: "8px",
            padding: "10px",
            borderRadius: "8px",
            border: `1.5px solid ${GREEN_TINT.boxBorder}`,
            background: GREEN_TINT.boxBg,
          }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={diameter}
              onChange={(e) => setDiameter(e.target.value)}
              placeholder="Diâmetro do vaso (cm)"
              style={{ ...selectStyle, flex: "0 0 120px" }}
            />
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} style={selectStyle}>
              {PLANT_WATER_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex" style={{ gap: "6px", marginBottom: "8px" }}>
            {WATER_SEASONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSeasonId(s.id)}
                aria-pressed={seasonId === s.id}
                style={{
                  flex: 1,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "10.5px",
                  padding: "5px 6px",
                  borderRadius: "999px",
                  border: `1.5px solid ${GREEN_TINT.buttonBorder}`,
                  background: seasonId === s.id ? GREEN_TINT.buttonBorder : "transparent",
                  color: seasonId === s.id ? "#fff" : GREEN_TINT.buttonColor,
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          {result ? (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: COLORS.ink, lineHeight: 1.45, margin: 0 }}>
              ≈ <strong>{result.waterMl} ml</strong> de água a cada <strong>{result.frequencyDays} dia(s)</strong>.
            </p>
          ) : (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)", margin: 0 }}>Informe o diâmetro do vaso.</p>
          )}
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)", marginTop: "6px", marginBottom: 0, lineHeight: 1.4 }}>
            Estimativa aproximada (vaso tratado como cilindro) — ajuste pela observação do solo, não é receita fixa.
          </p>
        </div>
      )}
    </div>
  );
}
