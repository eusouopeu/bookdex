/**
 * Peças compartilhadas pelos sub-painéis de Diagnóstico & planejamento (ver
 * `../DiagnosisPanel.tsx`, que só cuida do seletor de grupo/sub-modo e
 * despacha pro painel certo). Cada painel tem seu próprio estado local de
 * loading/erro/resultado — como só um fica montado por vez (o pai troca de
 * `sub` via unmount/mount), trocar de sub-modo já limpa o estado sozinho, sem
 * precisar de um `reset()` explícito compartilhado.
 */
import type { ReactNode } from "react";
import { COLORS } from "../../../../theme";
import { MissingApiKeyError } from "../../lib/anthropic";
import { probabilityLabel, confidenceLabel, latencyLabel } from "../../lib/effectProfiles";

export const GROUPS = [
  {
    key: "explorar",
    label: "Explorar",
    subs: [
      { key: "causas", label: "O que causa" },
      { key: "consequencias", label: "O que decorre" },
      { key: "direcao", label: "Quem causa quem" },
    ],
  },
  {
    key: "agir",
    label: "Agir",
    subs: [
      { key: "caminhos", label: "Caminhos" },
      { key: "protocolo", label: "Protocolo" },
      { key: "indicadores", label: "Indicadores" },
      { key: "prognostico", label: "Prognóstico" },
    ],
  },
  {
    key: "importar",
    label: "Importar",
    subs: [{ key: "extrair", label: "Colar conversa" }],
  },
];

export const inputStyle = {
  flex: 1,
  minWidth: 0,
  borderRadius: "6px",
  border: `1.5px solid ${COLORS.screenBorder}`,
  padding: "6px 8px",
  fontFamily: "Inter, sans-serif",
  fontSize: "11.5px",
  background: COLORS.surface,
  color: COLORS.ink,
  outline: "none",
};

export const primarySmallButton = (disabled: boolean) => ({
  background: COLORS.lensBlue,
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "6px 12px",
  fontFamily: '"Baloo 2", sans-serif',
  fontWeight: 700,
  fontSize: "11px",
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.5 : 1,
  flexShrink: 0,
});

/** Seletor de critérios-alvo com direção (mais/menos), igual ao padrão do EffectSuggestionsPanel. */
export function CriteriaTargetPicker({ criteria, targets, onCycle }: any) {
  return (
    <div className="flex items-center gap-1.5" style={{ flexWrap: "wrap", marginBottom: "8px" }}>
      {criteria.map((c: any) => {
        const dir = targets[c.id];
        return (
          <button
            key={c.id}
            onClick={() => onCycle(c.id)}
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "10px",
              color: dir ? "#fff" : COLORS.ink,
              background: dir === "mais" ? "var(--success)" : dir === "menos" ? "var(--danger)" : COLORS.surface,
              border: `1.5px solid ${dir === "mais" ? "var(--success)" : dir === "menos" ? "var(--danger)" : COLORS.screenBorder}`,
              borderRadius: "999px",
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            {dir === "mais" ? "+ " : dir === "menos" ? "− " : ""}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export function ResultCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "7px 9px", marginBottom: "6px" }}>
      {children}
    </div>
  );
}

export function MetaLine({ probability, confidence, latency }: { probability?: string; confidence?: string; latency?: string }) {
  const parts = [
    probability && probabilityLabel(probability),
    confidence && confidenceLabel(confidence),
    latency && latencyLabel(latency),
  ].filter(Boolean);
  if (!parts.length) return null;
  return <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "9.5px", color: "var(--text-muted)", marginTop: "2px" }}>{parts.join(" · ")}</div>;
}

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>;
}

export function errorMessage(err: any, fallback: string) {
  return err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || fallback;
}
