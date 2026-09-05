import { Gauge } from "lucide-react";
import { COLORS, primaryButtonStyle } from "../theme";
import { TIER_LABELS, MODELS } from "../lib/models";
import { costOfByModel, totalsOf, type UsageState } from "../lib/usageCore";

/**
 * Painel único de "Uso da API" cruzando os módulos — antes cada um (Cognidex,
 * Sinergia) desenhava sua própria tabela isolada, e um teto mensal configurado
 * num módulo não aparecia no gasto total visto no outro (fácil gastar 2x o
 * limite que o usuário achava ter posto). O orçamento/teto continua separado
 * por módulo (arquitetura deliberada — ver CLAUDE.md), só a VISÃO de gasto
 * foi unificada: soma tudo numa tabela só, com coluna de módulo.
 */
export interface ModuleUsage {
  key: string;
  label: string;
  usage: UsageState | null;
}

function usd(value: number) {
  return value < 0.01 ? `US$ ${value.toFixed(3)}` : `US$ ${value.toFixed(2)}`;
}

function modelLabel(model: string) {
  if (model === MODELS.sonnet) return TIER_LABELS.sonnet;
  if (model === MODELS.haiku) return TIER_LABELS.haiku;
  return model;
}

const cellRight = { textAlign: "right" as const };

interface UsageSummaryPanelProps {
  modules: ModuleUsage[];
  onReset: (moduleKey: string) => void;
}

export default function UsageSummaryPanel({ modules, onReset }: UsageSummaryPanelProps) {
  const rows = modules.flatMap(({ key, label, usage }) =>
    Object.entries(usage?.byModel || {}).map(([model, bucket]) => ({
      moduleKey: key,
      moduleLabel: label,
      model,
      bucket,
    }))
  );
  const grandTotal = modules.reduce(
    (acc, m) => {
      const t = totalsOf(m.usage?.byModel);
      return {
        calls: acc.calls + t.calls,
        inputTokens: acc.inputTokens + t.inputTokens,
        outputTokens: acc.outputTokens + t.outputTokens,
        cost: acc.cost + costOfByModel(m.usage?.byModel),
      };
    },
    { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 }
  );

  return (
    <div style={{ marginTop: "22px", borderTop: `2px solid ${COLORS.screenBorder}`, paddingTop: "14px" }}>
      <div className="flex items-center gap-1.5" style={{ marginBottom: "8px" }}>
        <Gauge size={15} style={{ color: COLORS.ink }} />
        <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "13px", color: COLORS.ink, margin: 0 }}>
          Uso da API (todos os módulos)
        </h3>
      </div>

      {grandTotal.calls === 0 ? (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)" }}>
          Nenhuma chamada registrada ainda neste aparelho.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "Inter, sans-serif",
            fontSize: "11.5px",
            color: "var(--text)",
            marginBottom: "8px",
          }}
        >
          <thead>
            <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
              <th style={{ fontWeight: 400, paddingBottom: "4px" }}>Módulo</th>
              <th style={{ fontWeight: 400 }}>Modelo</th>
              <th style={{ fontWeight: 400, ...cellRight }}>Chamadas</th>
              <th style={{ fontWeight: 400, ...cellRight }}>Tokens (E/S)</th>
              <th style={{ fontWeight: 400, ...cellRight }}>Custo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ moduleKey, moduleLabel, model, bucket }) => (
              <tr key={`${moduleKey}:${model}`} style={{ borderTop: `1px solid ${COLORS.screenBorder}` }}>
                <td style={{ padding: "5px 0" }}>{moduleLabel}</td>
                <td style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px" }}>{modelLabel(model)}</td>
                <td style={cellRight}>{bucket.calls}</td>
                <td style={cellRight}>
                  {(bucket.inputTokens || 0).toLocaleString("pt-BR")}/{(bucket.outputTokens || 0).toLocaleString("pt-BR")}
                </td>
                <td style={cellRight}>{usd(costOfByModel({ [model]: bucket }))}</td>
              </tr>
            ))}
            <tr style={{ borderTop: `2px solid ${COLORS.screenBorder}`, fontWeight: 600 }}>
              <td style={{ padding: "5px 0" }} colSpan={2}>
                Total
              </td>
              <td style={cellRight}>{grandTotal.calls}</td>
              <td style={cellRight}>
                {grandTotal.inputTokens.toLocaleString("pt-BR")}/{grandTotal.outputTokens.toLocaleString("pt-BR")}
              </td>
              <td style={cellRight}>{usd(grandTotal.cost)}</td>
            </tr>
          </tbody>
        </table>
      )}

      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px", lineHeight: 1.45 }}>
        Preço de lista, pode variar. Cada módulo tem seu próprio teto mensal (configurado na aba de cada um) — este total é
        só a soma dos dois contadores, pra ver o gasto real do aparelho num lugar só.
      </p>

      <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
        {modules.map((m) => (
          <button
            key={m.key}
            onClick={() => onReset(m.key)}
            style={{
              ...primaryButtonStyle,
              background: "transparent",
              color: COLORS.ink,
              border: `2px solid ${COLORS.screenBorder}`,
              padding: "8px 14px",
              minHeight: "36px",
              fontSize: "11.5px",
            }}
          >
            Zerar contador ({m.label})
          </button>
        ))}
      </div>
    </div>
  );
}
