import { useState } from "react";
import { ChevronRight, Sparkles, Plus, X } from "lucide-react";
import { COLORS, primaryButtonStyle } from "../theme";
import { computeCombinedEffect } from "../lib/effectProfiles";
import EffectProfileDetail from "./EffectProfileDetail";

/**
 * Aba "Efeitos": perfis que avaliam itens (suplementos, alimentos,
 * exercícios, práticas...) em critérios definidos pelo usuário, pra
 * entender o efeito combinado do que está ativo e receber sugestões.
 */
// `actions` repassa em bloco os handlers do perfil (ver useEffectProfiles) —
// esta tela só usa `onCreateProfile`, o resto é da tela de detalhe.
export default function EffectsSection({ profiles, onCreateProfile, ...actions }: any) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const list = Object.values(profiles || {}).sort((a: any, b: any) => b.createdAt - a.createdAt);
  const openProfile = openId ? (profiles as any)[openId] : null;

  function submitNew() {
    const clean = name.trim();
    if (!clean) return;
    const id = onCreateProfile(clean);
    setName("");
    setCreating(false);
    if (id) setOpenId(id);
  }

  if (openProfile) {
    return (
      <EffectProfileDetail profile={openProfile} onBack={() => setOpenId(null)} {...actions} />
    );
  }

  return (
    <div>
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center justify-center gap-1.5"
          style={{
            width: "100%",
            minHeight: "40px",
            background: "transparent",
            border: `2px dashed ${COLORS.screenBorder}`,
            borderRadius: "8px",
            color: COLORS.ink,
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "12px",
            cursor: "pointer",
            marginBottom: "14px",
          }}
        >
          <Plus size={15} /> Novo perfil de efeito
        </button>
      ) : (
        <div className="flex gap-2" style={{ marginBottom: "14px" }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") {
                setCreating(false);
                setName("");
              }
            }}
            placeholder='Ex.: "Suplementos & Alimentos"'
            style={{
              flex: 1,
              borderRadius: "8px",
              border: `2px solid ${COLORS.screenBorder}`,
              padding: "9px 12px",
              minHeight: "38px",
              fontFamily: "Inter, sans-serif",
              fontSize: "12.5px",
              background: COLORS.surface,
              color: COLORS.ink,
              outline: "none",
            }}
          />
          <button onClick={submitNew} disabled={!name.trim()} style={{ ...primaryButtonStyle, opacity: name.trim() ? 1 : 0.5, flexShrink: 0 }}>
            Criar
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setName("");
            }}
            aria-label="Cancelar"
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {list.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "220px", color: COLORS.screenBorder }}>
          <Sparkles size={32} strokeWidth={1.5} style={{ marginBottom: "10px" }} />
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", maxWidth: "230px" }}>
            Nenhum perfil ainda. Crie um pra começar a avaliar suplementos, exercícios ou o que quiser comparar.
          </p>
        </div>
      )}

      {list.map((profile: any) => {
        const totals = computeCombinedEffect(profile);
        const activeCount = profile.items.filter((it: any) => it.active).length;
        return (
          <button
            key={profile.id}
            onClick={() => setOpenId(profile.id)}
            className="flex items-center gap-2"
            style={{
              width: "100%",
              minHeight: "52px",
              background: COLORS.surface,
              border: `2px solid ${COLORS.screenBorder}`,
              borderRadius: "10px",
              padding: "10px 12px",
              marginBottom: "10px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "13.5px", color: COLORS.ink }}>
                {profile.name}
              </div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)" }}>
                {profile.items.length} item(ns) · {activeCount} ativo(s)
                {profile.criteria.length > 0 &&
                  " · " +
                    profile.criteria
                      .slice(0, 3)
                      .map((c: any) => `${c.label}: ${((totals as any)[c.id] || 0) > 0 ? "+" : ""}${(totals as any)[c.id] || 0}`)
                      .join(" · ")}
              </div>
            </div>
            <ChevronRight size={16} style={{ color: COLORS.screenBorder, flexShrink: 0 }} />
          </button>
        );
      })}
    </div>
  );
}
