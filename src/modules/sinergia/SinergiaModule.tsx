import { useEffect, useState } from "react";
import { GitCompare, ListTree, Settings as SettingsIcon, KeyRound } from "lucide-react";
import { COLORS, THEME_VARS, iconButtonStyle } from "./theme";
import { hasCredentials } from "./lib/anthropic";
import { getJSON, setJSON, KEYS } from "./lib/storage";
import { useEffectProfiles } from "./state/useEffectProfiles";
import storage from "./lib/storage";
import EffectsSection from "./components/EffectsSection";
import CompareView from "./views/CompareView";
import SettingsView from "./views/SettingsView";

/**
 * Estilo local dos botões "Efeitos"/"Comparar", igual ao App.jsx original do
 * Sinergia — DISTINTO do `tabStyle` exportado por `./theme` (usado em outros
 * lugares do app original, ex.: abas dentro de um perfil). Não colapsar os
 * dois: são visualmente diferentes de propósito.
 */
function headerTabStyle(active: boolean) {
  return {
    flex: 1,
    minHeight: "34px",
    borderRadius: "8px",
    border: "none",
    background: active ? "rgba(0,0,0,0.18)" : "transparent",
    color: active ? COLORS.white : "rgba(255,255,255,0.7)",
    fontFamily: '"Baloo 2", sans-serif',
    fontWeight: 700,
    fontSize: "12px",
    cursor: "pointer",
  } as const;
}

type View = "effects" | "compare" | "settings";

/**
 * Módulo Sinergia, self-contained: mesmo conteúdo funcional do App.jsx
 * original (abas Efeitos/Comparar/Configurações, aviso de API key ausente,
 * toast), mas SEM a casca de página do app original (100dvh wrapper, barra
 * vermelha do "aparelho", logo redondo, título "Efeitosdex") — isso agora é
 * responsabilidade do host (App.tsx do Bookdex). O módulo gerencia seu
 * próprio tema (claro/escuro) de forma independente do PrefsContext do
 * Bookdex, aplicando as THEME_VARS só dentro da própria raiz.
 */
export default function SinergiaModule() {
  const [view, setView] = useState<View>("effects");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hasKey, setHasKey] = useState(true);
  const [toast, setToast] = useState<{ msg: string } | null>(null);

  function showToast(msg: string) {
    setToast({ msg });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 2600);
  }

  const effects = useEffectProfiles(storage, showToast);
  const profileCount = Object.keys(effects.profiles || {}).length;

  useEffect(() => {
    (async () => {
      const savedTheme = await getJSON(KEYS.theme, "light");
      setTheme(savedTheme === "dark" ? "dark" : "light");
      setHasKey(await hasCredentials());
    })();
  }, []);

  async function changeTheme(next: string) {
    setTheme(next === "dark" ? "dark" : "light");
    await setJSON(KEYS.theme, next);
  }

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        .sinergia-module-root {
          ${Object.entries(THEME_VARS[theme] || THEME_VARS.light)
            .map(([k, v]) => `${k}: ${v};`)
            .join("\n          ")}
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="sinergia-module-root">
        <div className="flex gap-1.5" style={{ marginBottom: "10px" }}>
          <button onClick={() => setView("effects")} className="flex items-center justify-center gap-1.5" style={headerTabStyle(view === "effects")}>
            <ListTree size={13} /> Efeitos
          </button>
          <button onClick={() => setView("compare")} className="flex items-center justify-center gap-1.5" style={headerTabStyle(view === "compare")}>
            <GitCompare size={13} /> Comparar
          </button>
          <button onClick={() => setView("settings")} aria-label="Configurações" title="Configurações" style={iconButtonStyle}>
            <SettingsIcon size={17} />
          </button>
        </div>

        <div style={{ position: "relative" }}>
          {(view === "effects" || view === "compare") && !hasKey && (
            <div
              className="flex items-center gap-2"
              style={{
                background: "rgba(255,201,71,0.22)",
                border: `2px solid ${COLORS.gold}`,
                color: COLORS.ink,
                borderRadius: "8px",
                padding: "9px 10px",
                marginBottom: "12px",
                fontFamily: "Inter, sans-serif",
                fontSize: "11.5px",
              }}
            >
              <KeyRound size={15} style={{ flexShrink: 0 }} />
              <span>
                Sem API key configurada — a avaliação por IA não vai funcionar. Toque na engrenagem para configurar,
                ou adicione itens manualmente.
              </span>
            </div>
          )}

          {view === "effects" && <EffectsSection {...effects} />}

          {view === "compare" && <CompareView profiles={effects.profiles} onSetComparisonCache={effects.onSetComparisonCache} />}

          {view === "settings" && (
            <SettingsView
              onBack={() => setView("effects")}
              onCredentialsChanged={async () => setHasKey(await hasCredentials())}
              theme={theme}
              onChangeTheme={changeTheme}
            />
          )}
        </div>

        {toast && (
          <div
            style={{
              position: "sticky",
              bottom: "4px",
              left: 0,
              width: "100%",
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "#23291F",
                color: COLORS.white,
                padding: "8px 16px",
                borderRadius: "999px",
                fontSize: "12px",
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              }}
            >
              {toast.msg}
            </div>
          </div>
        )}

        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "11px",
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: "10px",
          }}
        >
          {profileCount} perfil(is) de efeito registrado(s)
        </div>
      </div>
    </div>
  );
}
