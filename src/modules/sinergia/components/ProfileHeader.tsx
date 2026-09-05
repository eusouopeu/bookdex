import { useState } from "react";
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { COLORS } from "../../../theme";

export const PROFILE_TABS = [
  { key: "geral", label: "Geral" },
  { key: "diagnostico", label: "Diagnóstico e Planejamento" },
  { key: "outros", label: "Outros" },
];

interface ProfileHeaderProps {
  profile: { id: string; name: string };
  tab: string;
  onTabChange: (tab: string) => void;
  onBack: () => void;
  onOpenInCognidex?: (name: string) => void;
  onRenameProfile: (profileId: string, name: string) => void;
  onDeleteProfile: (profileId: string) => void;
}

/** Voltar + link cruzado pro Cognidex + nome (renomeável)/excluir + abas do perfil. */
export default function ProfileHeader({ profile, tab, onTabChange, onBack, onOpenInCognidex, onRenameProfile, onDeleteProfile }: ProfileHeaderProps) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function submitRename() {
    const clean = nameDraft.trim();
    if (clean) onRenameProfile(profile.id, clean);
    else setNameDraft(profile.name);
    setRenaming(false);
  }

  function requestDelete() {
    if (confirmingDelete) {
      onDeleteProfile(profile.id);
      onBack();
    } else {
      setConfirmingDelete(true);
    }
  }

  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5"
        style={{
          background: "none",
          border: "none",
          color: COLORS.ink,
          fontFamily: '"Baloo 2", sans-serif',
          fontWeight: 700,
          fontSize: "12.5px",
          cursor: "pointer",
          padding: "8px 8px 8px 0",
          minHeight: "40px",
        }}
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      {onOpenInCognidex && (
        <button
          onClick={() => onOpenInCognidex(profile.name)}
          className="flex items-center gap-1.5"
          aria-label={`Ver "${profile.name}" no Cognidex`}
          title={`Ver "${profile.name}" no Cognidex`}
          style={{
            background: "none",
            border: `1.5px solid ${COLORS.screenBorder}`,
            borderRadius: "999px",
            color: COLORS.ink,
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            cursor: "pointer",
            padding: "5px 10px",
            marginBottom: "10px",
          }}
        >
          <ExternalLink size={12} /> Ver no Cognidex
        </button>
      )}

      <div className="flex items-center justify-between gap-2" style={{ marginBottom: "10px" }}>
        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                setNameDraft(profile.name);
                setRenaming(false);
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 800,
              fontSize: "16px",
              color: COLORS.ink,
              border: `1.5px solid ${COLORS.screenBorder}`,
              borderRadius: "8px",
              padding: "4px 8px",
              background: COLORS.surface,
              outline: "none",
            }}
          />
        ) : (
          <button
            onClick={() => setRenaming(true)}
            className="flex items-center gap-1.5"
            aria-label={`Renomear perfil "${profile.name}"`}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0, textAlign: "left" }}
          >
            <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile.name}
            </h2>
            <Pencil size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </button>
        )}
        {confirmingDelete ? (
          <button onClick={requestDelete} className="flex items-center gap-1" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "11px", flexShrink: 0 }}>
            <Trash2 size={14} /> Confirmar exclusão?
          </button>
        ) : (
          <button onClick={requestDelete} aria-label={`Excluir perfil "${profile.name}"`} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", flexShrink: 0 }}>
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Abas do perfil: o que se olha toda hora fica em "Geral"; as ferramentas de IA e o que é episódico saem da frente. */}
      <div className="flex gap-1" style={{ background: "rgba(120,120,120,0.15)", borderRadius: "8px", padding: "3px", marginBottom: "12px" }}>
        {PROFILE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            aria-pressed={tab === t.key}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: "32px",
              borderRadius: "6px",
              border: "none",
              background: tab === t.key ? COLORS.surface : "transparent",
              color: tab === t.key ? COLORS.ink : "var(--text-muted)",
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11px",
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              padding: "0 4px",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </>
  );
}
