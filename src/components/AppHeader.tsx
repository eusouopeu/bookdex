import { Settings as SettingsIcon, Upload, ListTree, GitCompare } from "lucide-react";
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
  // Gradiente da "lente" depende da cor do módulo (dado em runtime), então fica em style.
  const lens = (c: ModuleColor) => ({ background: `radial-gradient(circle at 35% 30%, ${c.light}, ${c.main} 60%, #1B4F7A 100%)` });

  return (
    <div className="shrink-0 bg-linear-to-b from-shell-red to-shell-red-dark pt-[calc(12px+env(safe-area-inset-top))] pr-[calc(16px+env(safe-area-inset-right))] pb-3.5 pl-[calc(16px+env(safe-area-inset-left))]">
      <div className="relative mb-1 flex items-center gap-3">
        <button
          onClick={onToggleModulePicker}
          aria-label={`Módulo atual: ${current.label}. Trocar módulo.`}
          aria-expanded={showModulePicker}
          title={`Módulo: ${current.label}`}
          className={`size-10 shrink-0 cursor-pointer rounded-full border-[3px] border-solid border-[#1B2A33] p-0 ${
            loading ? "animate-[lensPulse_1s_ease-in-out_infinite]" : "shadow-[0_0_0_3px_rgba(0,0,0,0.15)]"
          }`}
          style={lens(current)}
        />
        {showModulePicker && (
          <div className="absolute top-12 left-0 z-20 flex items-center gap-2 rounded-full border-2 border-solid border-screen-border bg-surface p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
            {Object.entries(moduleColors).map(([mod, c]) => (
              <button
                key={mod}
                onClick={() => onSwitchModule(mod as AppModule)}
                aria-label={c.label}
                aria-pressed={mod === appModule}
                title={c.label}
                className={`size-8 cursor-pointer rounded-full border-solid ${
                  mod === appModule ? "border-[3px] border-[#1B2A33]" : "border-2 border-black/25"
                }`}
                style={lens(c)}
              />
            ))}
          </div>
        )}
        <div className="flex gap-1.5" aria-hidden="true">
          <div className="size-2 rounded-full border-[1.5px] border-solid border-[#7A5A00] bg-gold" />
          <div className="size-2 rounded-full border-[1.5px] border-solid border-[#2E4A1F] bg-[#6A9955]" />
        </div>
        <h1 className="m-0 flex-1 font-display text-[19px] font-extrabold tracking-[0.01em] text-cream [text-shadow:0_2px_0_rgba(0,0,0,0.2)]">
          {current.label}
        </h1>
        {appModule === "sinergia" ? (
          <button onClick={() => onSetSinergiaView("settings")} aria-label="Configurações" title="Configurações" className="shell-icon-btn">
            <SettingsIcon size={17} />
          </button>
        ) : (
          <>
            <button onClick={() => onOpenScreen("import")} aria-label="Importar dados" title="Importar dados" className="shell-icon-btn">
              <Upload size={17} />
            </button>
            <button onClick={() => onOpenScreen("settings")} aria-label="Configurações" title="Configurações" className="shell-icon-btn">
              <SettingsIcon size={17} />
            </button>
          </>
        )}
      </div>

      {appModule === "sinergia" ? (
        <div className="mt-1.5 flex gap-2">
          <button
            onClick={() => onSetSinergiaView("effects")}
            aria-pressed={sinergiaView === "effects"}
            className="dex-tab flex items-center justify-center gap-1.5"
          >
            <ListTree size={13} /> EFEITOS
          </button>
          <button
            onClick={() => onSetSinergiaView("compare")}
            aria-pressed={sinergiaView === "compare"}
            className="dex-tab flex items-center justify-center gap-1.5"
          >
            <GitCompare size={13} /> COMPARAR
          </button>
        </div>
      ) : (
        <div className="mt-1.5 flex gap-2">
          <button onClick={() => onGoTab("search")} aria-pressed={view === "search"} className="dex-tab">
            BUSCAR
          </button>
          <button onClick={() => onGoTab("dex")} aria-pressed={view === "dex"} className="dex-tab">
            POKÉDEX ({countsTotal})
          </button>
          {showCollectionsTab && (
            <button onClick={() => onGoTab("collections")} aria-pressed={view === "collections"} className="dex-tab">
              COLEÇÕES ({countsCollections})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
