import { useState } from "react";
import { ClipboardCheck, Plus, X } from "lucide-react";
import { COLORS } from "../../../theme";
import { computeCombinedEffect, saturate } from "../lib/effectProfiles";
import { checkInList, criterionCalibration, itemDivergence } from "../lib/checkins";

const cellStyle = { textAlign: "right" as const, padding: "3px 0", fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px" };

function signed(value: number | null | undefined) {
  if (value == null) return "—";
  return value > 0 ? `+${value}` : String(value);
}

/**
 * Resultado real × previsto. O app inteiro estima e, sem isto, nunca conferia:
 * aqui você registra a nota que OBSERVOU em cada critério com a combinação que
 * estava ativa, e o painel mostra onde a previsão erra sistematicamente — por
 * critério e por item.
 */
export default function CheckInPanel({ profile, onAddCheckIn, onRemoveCheckIn }: any) {
  const [registering, setRegistering] = useState(false);
  const [observed, setObserved] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const predicted = computeCombinedEffect(profile);
  const list = checkInList(profile);
  const calibration = criterionCalibration(profile).filter((c: any) => c.n > 0);
  const divergences = itemDivergence(profile);
  const activeCount = profile.items.filter((it: any) => it.active).length;

  function start() {
    setObserved(Object.fromEntries(profile.criteria.map((c: any) => [c.id, 0])));
    setNote("");
    setRegistering(true);
  }

  function save() {
    onAddCheckIn(observed, note);
    setRegistering(false);
  }

  return (
    <div style={{ marginBottom: "14px" }}>
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: "6px" }}>
        <span className="flex items-center gap-1.5" style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>
          <ClipboardCheck size={13} /> Resultado real
        </span>
        {!registering && (
          <button
            onClick={start}
            disabled={!profile.criteria.length}
            className="flex items-center gap-1"
            style={{
              background: "none",
              border: `1.5px solid ${COLORS.lensBlue}`,
              borderRadius: "999px",
              color: COLORS.lensBlue,
              fontFamily: "Inter, sans-serif",
              fontSize: "10.5px",
              padding: "4px 10px",
              cursor: profile.criteria.length ? "pointer" : "default",
              opacity: profile.criteria.length ? 1 : 0.5,
              flexShrink: 0,
            }}
          >
            <Plus size={11} /> Registrar check-in
          </button>
        )}
      </div>

      {registering && (
        <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.lensBlue}`, borderRadius: "8px", padding: "9px 10px", marginBottom: "8px" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", marginBottom: "8px", lineHeight: 1.4 }}>
            Com os {activeCount} item(ns) ativo(s) agora: como cada critério está DE FATO, na mesma escala −5 a +5?
          </p>
          {profile.criteria.map((c: any) => {
            const value = observed[c.id] ?? 0;
            return (
              <div key={c.id} className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
                <span style={{ flex: "1 1 70px", minWidth: 0, fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.label}
                </span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "9.5px", color: "var(--text-muted)", flexShrink: 0 }}>
                  prev {signed(saturate(predicted[c.id] || 0))}
                </span>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={1}
                  value={value}
                  onChange={(e) => setObserved((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                  aria-label={`Nota observada de ${c.label}`}
                  style={{ flex: "1.2 1 80px", minWidth: 0, accentColor: COLORS.lensBlue }}
                />
                <span
                  style={{
                    width: "24px",
                    textAlign: "right",
                    flexShrink: 0,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "11px",
                    fontWeight: 700,
                    color: value > 0 ? "var(--success)" : value < 0 ? "var(--danger)" : "var(--text-muted)",
                  }}
                >
                  {signed(value)}
                </span>
              </div>
            );
          })}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Contexto (opcional): dormi mal, semana puxada..."
            style={{
              width: "100%",
              borderRadius: "6px",
              border: `1.5px solid ${COLORS.screenBorder}`,
              padding: "6px 8px",
              fontFamily: "Inter, sans-serif",
              fontSize: "11px",
              background: COLORS.surface,
              color: COLORS.ink,
              outline: "none",
              resize: "vertical",
              margin: "4px 0 8px",
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              style={{ background: COLORS.lensBlue, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11.5px", cursor: "pointer" }}
            >
              Salvar check-in
            </button>
            <button
              onClick={() => setRegistering(false)}
              style={{ background: "transparent", color: COLORS.ink, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "7px 14px", fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11.5px", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {list.length === 0 && !registering && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
          Nenhum check-in ainda. Sem eles o perfil só estima — com eles dá pra ver onde a estimativa erra.
        </p>
      )}

      {calibration.length > 0 && (
        <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "8px 10px", marginBottom: "8px" }}>
          <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: COLORS.ink, marginBottom: "4px" }}>
            Calibração ({list.length} check-in{list.length === 1 ? "" : "s"})
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontFamily: "Inter, sans-serif", fontSize: "10px" }}>
                <th style={{ textAlign: "left", fontWeight: 400 }}>Critério</th>
                <th style={{ textAlign: "right", fontWeight: 400 }}>n</th>
                <th style={{ textAlign: "right", fontWeight: 400 }}>Viés</th>
                <th style={{ textAlign: "right", fontWeight: 400 }}>Erro</th>
              </tr>
            </thead>
            <tbody>
              {calibration.map(({ criterion, n, bias, absError }: any) => (
                <tr key={criterion.id} style={{ borderTop: `1px solid ${COLORS.screenBorder}` }}>
                  <td style={{ padding: "3px 0", fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink }}>{criterion.label}</td>
                  <td style={{ ...cellStyle, color: "var(--text-muted)" }}>{n}</td>
                  <td style={{ ...cellStyle, fontWeight: 700, color: bias > 0 ? "var(--success)" : bias < 0 ? "var(--danger)" : "var(--text-muted)" }}>{signed(bias)}</td>
                  <td style={{ ...cellStyle, color: "var(--text-muted)" }}>{absError ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
            Viés negativo = o perfil promete mais do que entrega nesse critério.
          </p>
        </div>
      )}

      {divergences.length > 0 && (
        <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "8px 10px", marginBottom: "8px" }}>
          <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: COLORS.ink, marginBottom: "4px" }}>Itens com divergência</div>
          {divergences.slice(0, 5).map(({ item, n, bias }: any) => (
            <div key={item.id} className="flex items-center justify-between gap-2" style={{ marginBottom: "3px" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.name}
              </span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", flexShrink: 0, color: bias > 0 ? "var(--success)" : bias < 0 ? "var(--danger)" : "var(--text-muted)" }}>
                {signed(bias)} · {n} check-in(s)
              </span>
            </div>
          ))}
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
            Heurística: o erro do check-in é atribuído aos itens ativos, só nos critérios em que eles declaram efeito. Com poucos registros, é ruído.
          </p>
        </div>
      )}

      {list.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory((s) => !s)}
            aria-expanded={showHistory}
            style={{ background: "none", border: "none", color: COLORS.lensBlue, fontFamily: "Inter, sans-serif", fontSize: "11px", cursor: "pointer", padding: 0 }}
          >
            {showHistory ? "Ocultar histórico" : `Ver histórico (${list.length})`}
          </button>
          {showHistory && (
            <div style={{ marginTop: "6px" }}>
              {list.map((ci: any) => (
                <div
                  key={ci.id}
                  className="flex items-start justify-between gap-2"
                  style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "6px 9px", marginBottom: "5px" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "var(--text-muted)" }}>
                      {new Date(ci.at).toLocaleDateString("pt-BR")} · {ci.activeIds.length} ativo(s)
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink, marginTop: "2px" }}>
                      {profile.criteria
                        .filter((c: any) => ci.observed?.[c.id] != null)
                        .map((c: any) => `${c.label} ${signed(ci.observed[c.id])}`)
                        .join(" · ")}
                    </div>
                    {ci.note && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", marginTop: "2px" }}>{ci.note}</div>}
                  </div>
                  <button onClick={() => onRemoveCheckIn(ci.id)} aria-label="Remover check-in" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
