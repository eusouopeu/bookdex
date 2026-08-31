import { Settings as SettingsIcon, Upload, ListTree, GitCompare } from "lucide-react";
import { COLORS, tabStyle, iconButtonStyle } from "../theme";
import type { SinergiaView } from "../modules/sinergia/SinergiaModule";

export interface ModuleColor {
  main: string;
  light: string;
  label: string;
}

export type AppModule = "bookdex" | "sinergia" | "plants";
export type AppScreen = "search" | "dex" | "collections" | "settings" | "import";

interface AppHeaderProps {
  appModule: AppModule;
  moduleColors: Record<AppModule, ModuleColor>;
  loading: boolean;
  showModulePicker: boolean;
  onToggleModulePicker: () => void;
  onSwitchModule: (mod: AppModule) => void;
  view: AppScreen;
  showCollectionsTab: boolean;
  countsTotal: number;
  countsCollections: number;
  onGoTab: (tab: AppScreen) => void;
  onOpenScreen: (screen: AppScreen) => void;
  sinergiaView: SinergiaView;
  onSetSinergiaView: (view: SinergiaView) => void;
}

/**
 * Barra vermelha do topo — logo/módulo, título, ícones de ação e a fileira
 * de abas. Layout varia por módulo, mas TODOS os módulos usam esta mesma
 * barra: nenhum módulo desenha sua própria navegação fora dela.
 */
export default function AppHeader({
  appModule,
  moduleColors,
  loading,
  showModulePicker,
  onToggleModulePicker,
  onSwitchModule,
  view,
  showCollectionsTab,
  countsTotal,
  countsCollections,
  onGoTab,
  onOpenScreen,
  sinergiaView,
  onSetSinergiaView,
}: AppHeaderProps) {
  const current = moduleColors[appModule];

  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${COLORS.shellRed}, ${COLORS.shellRedDark})`,
        padding:
          "calc(12px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 14px calc(16px + env(safe-area-inset-left))",
        flexShrink: 0,
      }}
    >
      <div className="flex items-center gap-3 mb-1" style={{ position: "relative" }}>
        <button
          onClick={onToggleModulePicker}
          aria-label={`Módulo atual: ${current.label}. Trocar módulo.`}
          title={`Módulo: ${current.label}`}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            flexShrink: 0,
            padding: 0,
            background: `radial-gradient(circle at 35% 30%, ${current.light}, ${current.main} 60%, #1B4F7A 100%)`,
            border: "3px solid #1B2A33",
            boxShadow: loading ? undefined : "0 0 0 3px rgba(0,0,0,0.15)",
            animation: loading ? "lensPulse 1s ease-in-out infinite" : "none",
            cursor: "pointer",
          }}
        />
        {showModulePicker && (
          <div
            className="flex items-center gap-2"
            style={{
              position: "absolute",
              top: "48px",
              left: 0,
              zIndex: 20,
              background: COLORS.surface,
              border: `2px solid ${COLORS.screenBorder}`,
              borderRadius: "999px",
              padding: "6px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            }}
          >
            {Object.entries(moduleColors).map(([mod, c]) => (
              <button
                key={mod}
                onClick={() => onSwitchModule(mod as AppModule)}
                aria-label={c.label}
                title={c.label}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: mod === appModule ? "3px solid #1B2A33" : "2px solid rgba(0,0,0,0.25)",
                  background: `radial-gradient(circle at 35% 30%, ${c.light}, ${c.main} 60%, #1B4F7A 100%)`,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORS.gold, border: "1.5px solid #7A5A00" }} />
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6A9955", border: "1.5px solid #2E4A1F" }} />
        </div>
        <h1
          style={{
            flex: 1,
            fontFamily: '"Baloo 2", sans-serif',
            color: COLORS.white,
            fontWeight: 800,
            fontSize: "19px",
            letterSpacing: "0.01em",
            textShadow: "0 2px 0 rgba(0,0,0,0.2)",
            margin: 0,
          }}
        >
          {current.label}
        </h1>
        {appModule === "sinergia" ? (
          <button onClick={() => onSetSinergiaView("settings")} aria-label="Configurações" title="Configurações" style={iconButtonStyle}>
            <SettingsIcon size={17} />
          </button>
        ) : (
          <>
            <button onClick={() => onOpenScreen("import")} aria-label="Importar dados" title="Importar dados" style={iconButtonStyle}>
              <Upload size={17} />
            </button>
            <button onClick={() => onOpenScreen("settings")} aria-label="Configurações" title="Configurações" style={iconButtonStyle}>
              <SettingsIcon size={17} />
            </button>
          </>
        )}
      </div>

      {appModule === "sinergia" ? (
        <div className="flex gap-2" style={{ marginTop: "6px" }}>
          <button
            onClick={() => onSetSinergiaView("effects")}
            className="flex items-center justify-center gap-1.5"
            style={tabStyle(sinergiaView === "effects")}
          >
            <ListTree size={13} /> EFEITOS
          </button>
          <button
            onClick={() => onSetSinergiaView("compare")}
            className="flex items-center justify-center gap-1.5"
            style={tabStyle(sinergiaView === "compare")}
          >
            <GitCompare size={13} /> COMPARAR
          </button>
        </div>
      ) : (
        <div className="flex gap-2" style={{ marginTop: "6px" }}>
          <button onClick={() => onGoTab("search")} style={tabStyle(view === "search")}>
            BUSCAR
          </button>
          <button onClick={() => onGoTab("dex")} style={tabStyle(view === "dex")}>
            POKÉDEX ({countsTotal})
          </button>
          {showCollectionsTab && (
            <button onClick={() => onGoTab("collections")} style={tabStyle(view === "collections")}>
              COLEÇÕES ({countsCollections})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
