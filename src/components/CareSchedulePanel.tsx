import { CalendarClock, Check } from "lucide-react";
import { COLORS } from "../theme";
import { CARE_TASKS, defaultCareTask, daysUntilDue, type CareSchedule, type CareTaskState } from "../lib/plants";

interface CareSchedulePanelProps {
  care: CareSchedule | undefined;
  onChange: (taskId: string, patch: Partial<CareTaskState>) => void;
}

function dueLabel(days: number) {
  if (days < 0) return `Atrasado(a) ${Math.abs(days)} dia(s)`;
  if (days === 0) return "Hoje";
  return `Em ${days} dia(s)`;
}

/**
 * Cronograma de cuidados de uma planta salva: água e fertilização, cada uma
 * com intervalo configurável, contagem "em N dias" (ou "atrasado") e um botão
 * "Feito hoje" que reinicia a contagem. Tudo dado local — sem chamada de API.
 */
export default function CareSchedulePanel({ care, onChange }: CareSchedulePanelProps) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: "8px", marginBottom: "8px" }}>
      <div className="flex items-center gap-1.5" style={{ marginBottom: "6px" }}>
        <CalendarClock size={13} style={{ color: "var(--text-muted)" }} />
        <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11.5px", color: COLORS.ink }}>Cronograma de cuidados</span>
      </div>
      {CARE_TASKS.map((def) => {
        const task = care?.[def.id as keyof CareSchedule] || defaultCareTask(def.id);
        const days = daysUntilDue(task);
        return (
          <div
            key={def.id}
            className="flex items-center gap-2"
            style={{
              background: COLORS.surface,
              border: `1.5px solid ${COLORS.screenBorder}`,
              borderRadius: "8px",
              padding: "7px 9px",
              marginBottom: "6px",
              opacity: task.enabled ? 1 : 0.55,
            }}
          >
            <button
              onClick={() => onChange(def.id, { enabled: !task.enabled })}
              aria-pressed={task.enabled}
              aria-label={task.enabled ? `Desativar lembrete de ${def.label}` : `Ativar lembrete de ${def.label}`}
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "5px",
                border: `2px solid ${task.enabled ? "var(--success)" : COLORS.screenBorder}`,
                background: task.enabled ? "var(--success)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
                padding: 0,
              }}
            >
              {task.enabled && <Check size={11} color="#fff" strokeWidth={3} />}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>{def.label}</div>
              <div className="flex items-center gap-1.5" style={{ marginTop: "2px" }}>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "10.5px",
                    color: days < 0 && task.enabled ? "var(--danger)" : "var(--text-muted)",
                  }}
                >
                  {task.enabled ? dueLabel(days) : "Desativado"}
                </span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)" }}>·</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)" }}>a cada</span>
                <input
                  type="number"
                  min={1}
                  value={task.intervalDays}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value) && value > 0) onChange(def.id, { intervalDays: Math.round(value) });
                  }}
                  style={{
                    width: "36px",
                    border: `1.5px solid ${COLORS.screenBorder}`,
                    borderRadius: "5px",
                    padding: "1px 3px",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "10.5px",
                    background: "transparent",
                    color: COLORS.ink,
                    outline: "none",
                  }}
                />
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)" }}>dia(s)</span>
              </div>
            </div>

            <button
              onClick={() => onChange(def.id, { lastDoneAt: Date.now() })}
              style={{
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: "10.5px",
                color: COLORS.lensBlue,
                background: "none",
                border: `1.5px solid ${COLORS.lensBlue}`,
                borderRadius: "999px",
                padding: "4px 9px",
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              Feito hoje
            </button>
          </div>
        );
      })}
    </div>
  );
}
