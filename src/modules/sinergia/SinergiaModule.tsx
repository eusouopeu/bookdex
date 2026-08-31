import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { COLORS, THEME_VARS } from "../../theme";
import { hasCredentials } from "./lib/anthropic";
import { getJSON, setJSON, KEYS } from "./lib/storage";
import { useEffectProfiles } from "./state/useEffectProfiles";
import storage from "./lib/storage";
import EffectsSection from "./components/EffectsSection";
import CompareView from "./views/CompareView";
import SettingsView from "./views/SettingsView";

export type SinergiaView = "effects" | "compare" | "settings";

interface SinergiaModuleProps {
  view: SinergiaView;
  onViewChange: (view: SinergiaView) => void;
  /** Nome de um item vindo do Cognidex (ponte "Avaliar no Sinergia") — acha o
   *  perfil de mesmo nome ou cria um novo, e já abre. */
  pendingProfileName?: string | null;
  onConsumedPendingProfile?: () => void;
  onOpenInCognidex?: (name: string) => void;
}

/**
 * Módulo Sinergia, self-contained: mesmo conteúdo funcional do App.jsx
 * original (abas Efeitos/Comparar/Configurações, aviso de API key ausente,
 * toast), mas SEM a casca de página do app original (100dvh wrapper, barra
 * vermelha do "aparelho", logo redondo, título "Efeitosdex") — isso agora é
 * responsabilidade do host (App.tsx do Cognidex), que TAMBÉM controla qual
 * aba (`view`) está ativa — a navegação do módulo mora na barra vermelha
 * compartilhada (AppHeader), não dentro da tela. O módulo gerencia seu
 * próprio tema (claro/escuro) de forma independente do PrefsContext do
 * Cognidex, aplicando as THEME_VARS só dentro da própria raiz.
 */
export default function SinergiaModule({ view, onViewChange, pendingProfileName, onConsumedPendingProfile, onOpenInCognidex }: SinergiaModuleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hasKey, setHasKey] = useState(true);
  const [toast, setToast] = useState<{ msg: string } | null>(null);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);

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

  // Ponte "Avaliar no Sinergia" vinda do Cognidex: acha o perfil de mesmo
  // nome (sem diferenciar maiúsculas) ou cria um novo, e abre direto nele.
  useEffect(() => {
    if (!pendingProfileName || !effects.loaded) return;
    const clean = pendingProfileName.trim();
    const existing = Object.values(effects.profiles || {}).find(
      (p: any) => p.name.trim().toLowerCase() === clean.toLowerCase()
    ) as any;
    const id = existing ? existing.id : effects.onCreateProfile(clean);
    if (id) {
      setOpenProfileId(id);
      onViewChange("effects");
    }
    onConsumedPendingProfile?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingProfileName, effects.loaded]);

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

          {view === "effects" && (
            <EffectsSection {...effects} openId={openProfileId} onOpenChange={setOpenProfileId} onOpenInCognidex={onOpenInCognidex} />
          )}

          {view === "compare" && <CompareView profiles={effects.profiles} onSetComparisonCache={effects.onSetComparisonCache} />}

          {view === "settings" && (
            <SettingsView
              onBack={() => onViewChange("effects")}
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
