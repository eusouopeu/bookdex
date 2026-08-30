import type { ReactNode, MouseEvent } from "react";
import { COLORS } from "../theme";
import PokeballIcon from "./PokeballIcon";
import TagEditor from "./TagEditor";
import NoteEditor from "./NoteEditor";

interface CardShellProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleSize?: number;
  subtitle?: ReactNode;
  media?: ReactNode;
  actions?: ReactNode;
  saved?: boolean;
  onToggle?: () => void;
  captureLabel?: string;
  tags?: string[];
  onTagsChange?: (tags: string[]) => void;
  note?: string;
  onNoteChange?: (note: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelectToggle?: () => void;
  irrelevant?: boolean;
  padding?: string;
  children?: ReactNode;
}

/**
 * A casca comum de todo card do app (técnica, conceito, tipo, palavra, planta).
 *
 * Os cinco cards repetiam a mesma estrutura — moldura, estado de seleção,
 * cabeçalho com título e fila de ícones, chips de tag, editor de nota — cada um
 * com sua cópia dos mesmos estilos. Aqui isso mora num lugar só, e cada card
 * fica sendo apenas o que é próprio dele: o miolo, passado como `children`, e a
 * lista de ações do cabeçalho.
 *
 * A pokébola de captura é sempre a ÚLTIMA ação da fila, então ela é prop
 * própria (`saved`/`onToggle`/`captureLabel`) em vez de mais um item de
 * `actions` — assim nenhum card consegue colocá-la fora de ordem.
 */
export default function CardShell({
  eyebrow,
  title,
  titleSize = 16,
  subtitle,
  media,
  actions,
  saved,
  onToggle,
  captureLabel = "item",
  tags,
  onTagsChange,
  note,
  onNoteChange,
  selectable,
  selected,
  onSelectToggle,
  irrelevant,
  padding = "12px",
  children,
}: CardShellProps) {
  return (
    <div
      onClick={selectable ? onSelectToggle : undefined}
      style={{
        background: COLORS.surface,
        border: `2px solid ${selectable && selected ? COLORS.lensBlue : COLORS.screenBorder}`,
        borderRadius: "10px",
        padding,
        marginBottom: "10px",
        cursor: selectable ? "pointer" : "default",
        boxShadow: selectable && selected ? `0 0 0 2px ${COLORS.lensBlue} inset` : "none",
        opacity: irrelevant ? 0.5 : 1,
      }}
    >
      {media}

      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-start gap-2" style={{ minWidth: 0 }}>
          {selectable && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={onSelectToggle}
              onClick={(e) => e.stopPropagation()}
              style={{ width: "18px", height: "18px", marginTop: "3px", flexShrink: 0 }}
              aria-label={`Selecionar ${title}`}
            />
          )}
          <div style={{ minWidth: 0 }}>
            {eyebrow && (
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "var(--text-faint)" }}>
                {eyebrow}
              </div>
            )}
            <h3
              style={{
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: `${titleSize}px`,
                color: COLORS.ink,
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              {title}
            </h3>
            {subtitle}
          </div>
        </div>

        {!selectable && (actions || onToggle) && (
          <div className="flex items-center" style={{ flexShrink: 0, gap: "18px" }}>
            {actions}
            {onToggle && (
              <button
                onClick={onToggle}
                aria-label={saved ? `Soltar ${captureLabel} da Pokédex` : `Capturar ${captureLabel}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "9px",
                  margin: "-9px",
                  flexShrink: 0,
                }}
              >
                <PokeballIcon filled={saved} size={26} />
              </button>
            )}
          </div>
        )}
      </div>

      {onTagsChange && (
        <div style={{ marginBottom: "4px" }}>
          <TagEditor tags={tags || []} onChange={onTagsChange} />
        </div>
      )}

      {children}

      {onNoteChange && (
        <div className="flex items-center" style={{ flexWrap: "wrap" }}>
          <NoteEditor note={note} onChange={onNoteChange} />
        </div>
      )}
    </div>
  );
}

/**
 * Botão-ícone do cabeçalho, com a área de toque de 44px que os cards já usavam
 * (padding 9 + margin -9 mantém o alvo grande sem alargar a fila visualmente).
 */
interface CardIconButtonProps {
  onClick: (e: MouseEvent) => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

export function CardIconButton({ onClick, label, active, disabled, children }: CardIconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        background: "none",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        padding: "9px",
        margin: "-9px",
        flexShrink: 0,
        display: "flex",
        color: active ? "var(--danger)" : COLORS.screenBorder,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
