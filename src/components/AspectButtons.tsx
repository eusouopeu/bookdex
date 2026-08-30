import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { COLORS } from "../theme";
import { MissingApiKeyError } from "../lib/anthropic";

/**
 * Tons prontos pra colorir a fila de botões: nasceu verde no card de planta,
 * e o card de técnica/conceito usa o mesmo azul que o antigo "aprofundar" já
 * usava (ConceptExpand), pra não introduzir uma cor nova sem motivo.
 */
export const GREEN_TINT = {
  buttonBorder: "#6A9955",
  buttonBg: "rgba(106,153,85,0.15)",
  buttonColor: "#4a6b3b",
  boxBorder: "#6A9955",
  boxBg: "rgba(106,153,85,0.12)",
};

export const BLUE_TINT = {
  buttonBorder: COLORS.lensBlue,
  buttonBg: "rgba(46,134,222,0.15)",
  buttonColor: COLORS.lensBlue,
  boxBorder: COLORS.lensBlue,
  boxBg: "rgba(46,134,222,0.08)",
};

interface Tint {
  buttonBorder: string;
  buttonBg: string;
  buttonColor: string;
  boxBorder: string;
  boxBg: string;
}

export function aspectButtonStyle(filled: boolean, loading: boolean, tint: Tint) {
  return {
    flex: 1,
    minWidth: 0,
    minHeight: "38px",
    borderRadius: "8px",
    border: `1.5px solid ${filled ? tint.buttonBorder : COLORS.screenBorder}`,
    background: filled ? tint.buttonBg : "transparent",
    color: filled ? tint.buttonColor : COLORS.screenBorder,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: loading ? "default" : "pointer",
    opacity: loading ? 0.6 : 1,
  };
}

/**
 * Fila de botões-ícone que geram, sob demanda e um por vez, um bloco curto de
 * texto sobre um aspecto do item — o padrão nascido no card de planta, agora
 * compartilhado com técnica e conceito. Tocar num aspecto já gerado só
 * expande/recolhe o bloco; nada é pedido duas vezes.
 *
 * `onLocalChange(local)` é opcional: dispara sempre que um aspecto novo é
 * gerado nesta sessão, ainda não persistido (item não capturado). Só quem
 * precisa desse dado fora daqui (o card de planta, pro PDF de compartilhar)
 * passa esse callback.
 *
 * `costLabel`, quando dado, aparece no tooltip de cada aspecto ainda não
 * gerado ("Erros comuns (~US$ 0,003)") — custo é visível antes do gasto, não
 * só depois, no teto mensal.
 */
interface AspectDef {
  id: string;
  label: string;
  icon: any;
  prompt?: string;
}

interface AspectButtonsProps {
  aspects: AspectDef[];
  saved?: Record<string, string>;
  onFetch: (id: string) => Promise<string>;
  onGenerated?: (id: string, text: string) => void;
  onLocalChange?: (local: Record<string, string>) => void;
  tint: Tint;
  costLabel?: string;
}

export default function AspectButtons({ aspects, saved, onFetch, onGenerated, onLocalChange, tint, costLabel }: AspectButtonsProps) {
  const [local, setLocal] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (onLocalChange) onLocalChange(local);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  const values: Record<string, string> = { ...(saved || {}), ...local };

  async function toggle(id: string) {
    if (values[id]) {
      setOpen((o) => (o === id ? null : id));
      return;
    }
    if (loadingId) return;
    setLoadingId(id);
    setError(null);
    try {
      const text = await onFetch(id);
      setLocal((prev) => ({ ...prev, [id]: text }));
      setOpen(id);
      if (onGenerated) onGenerated(id, text);
    } catch (err: any) {
      setError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Falhou.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-1.5" style={{ marginBottom: "8px" }}>
        {aspects.map((aspect) => {
          const Icon = aspect.icon;
          const filled = !!values[aspect.id];
          const loading = loadingId === aspect.id;
          return (
            <button
              key={aspect.id}
              onClick={() => toggle(aspect.id)}
              disabled={!!loadingId}
              aria-label={filled ? `${aspect.label} — mostrar/ocultar` : `${aspect.label} (gera com IA)`}
              title={filled || !costLabel ? aspect.label : `${aspect.label} (~${costLabel})`}
              style={aspectButtonStyle(filled, loading, tint)}
            >
              {loading ? <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} /> : <Icon size={15} />}
            </button>
          );
        })}
      </div>

      {error && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginBottom: "8px" }}>{error}</p>
      )}

      {open && values[open] && (
        <div
          style={{
            background: tint.boxBg,
            border: `1.5px solid ${tint.boxBorder}`,
            borderRadius: "8px",
            padding: "9px 11px",
            marginBottom: "6px",
          }}
        >
          <div
            style={{
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11.5px",
              color: COLORS.ink,
              marginBottom: "4px",
            }}
          >
            {aspects.find((a) => a.id === open)?.label}
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text)", lineHeight: 1.5, margin: 0 }}>
            {values[open]}
          </p>
        </div>
      )}
    </div>
  );
}
