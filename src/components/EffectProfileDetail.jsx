import { useState } from "react";
import { ArrowLeft, Check, Loader2, Plus, Sparkles, Target, Trash2, X } from "lucide-react";
import { COLORS, primaryButtonStyle } from "../theme";
import { fetchItemRatings, MissingApiKeyError } from "../lib/anthropic";
import { computeCombinedEffect } from "../lib/effectProfiles";
import EffectRatingBar from "./EffectRatingBar";
import EffectSuggestionsPanel from "./EffectSuggestionsPanel";
import NoteEditor from "./NoteEditor";

export default function EffectProfileDetail({
  profile,
  onBack,
  onDeleteProfile,
  onAddCriterion,
  onRemoveCriterion,
  onAddItem,
  onRemoveItem,
  onToggleItemActive,
  onUpdateItemRating,
  onUpdateItemNote,
}) {
  const [addingCriterion, setAddingCriterion] = useState(false);
  const [criterionDraft, setCriterionDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [itemNameDraft, setItemNameDraft] = useState("");
  const [rating, setRating] = useState(null); // { name, values: {critId: n}, reasons: {critId: str} } — rascunho antes de salvar
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState(null);

  const [showSuggestions, setShowSuggestions] = useState(false);

  const hasCriteria = profile.criteria.length > 0;
  const activeItems = profile.items.filter((it) => it.active);
  const totals = computeCombinedEffect(profile);

  function submitCriterion() {
    const clean = criterionDraft.trim();
    if (!clean) return;
    onAddCriterion(profile.id, clean);
    setCriterionDraft("");
    setAddingCriterion(false);
  }

  function requestDelete() {
    if (confirmingDelete) {
      onDeleteProfile(profile.id);
      onBack();
    } else {
      setConfirmingDelete(true);
    }
  }

  async function startRating() {
    const clean = itemNameDraft.trim();
    if (!clean) return;
    setRatingError(null);
    setRatingLoading(true);
    try {
      const criteriaLabels = profile.criteria.map((c) => c.label);
      const result = await fetchItemRatings(clean, profile.name, criteriaLabels);
      const values = {};
      const reasons = {};
      profile.criteria.forEach((c, i) => {
        const found = result.find((r) => r.criterion === c.label) || result[i];
        values[c.id] = found ? found.value : 0;
        reasons[c.id] = found ? found.reason : "";
      });
      setRating({ name: clean, values, reasons });
    } catch (err) {
      setRatingError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível avaliar agora.");
    } finally {
      setRatingLoading(false);
    }
  }

  function startManualRating() {
    const clean = itemNameDraft.trim();
    if (!clean) return;
    const values = {};
    profile.criteria.forEach((c) => (values[c.id] = 0));
    setRating({ name: clean, values, reasons: {} });
    setRatingError(null);
  }

  function saveRating() {
    if (!rating) return;
    onAddItem(profile.id, { name: rating.name, ratings: rating.values, reasons: rating.reasons });
    setRating(null);
    setItemNameDraft("");
  }

  async function addSuggestionToProfile(suggestion) {
    if (suggestion.kind === "substituicao" && suggestion.replaces) {
      const target = profile.items.find((it) => it.name.toLowerCase() === suggestion.replaces.toLowerCase());
      if (target) onRemoveItem(profile.id, target.id);
    }
    const ratings = {};
    (suggestion.targetCriteria || []).forEach((c, i) => {
      ratings[c.id] = suggestion.estimatedRatings ? suggestion.estimatedRatings[i] : 0;
    });
    onAddItem(profile.id, { name: suggestion.name, ratings, reasons: {} });
  }

  return (
    <div>
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

      <div className="flex items-center justify-between gap-2" style={{ marginBottom: "10px" }}>
        <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink, margin: 0 }}>
          {profile.name}
        </h2>
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

      {/* Critérios */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink, marginBottom: "6px" }}>
          Critérios
        </div>
        <div className="flex items-center" style={{ flexWrap: "wrap", gap: "6px" }}>
          {profile.criteria.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1"
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10.5px",
                color: COLORS.ink,
                background: "rgba(46,134,222,0.12)",
                border: `1.5px solid ${COLORS.lensBlue}`,
                borderRadius: "999px",
                padding: "3px 4px 3px 10px",
              }}
            >
              {c.label}
              <button
                onClick={() => onRemoveCriterion(profile.id, c.id)}
                aria-label={`Remover critério ${c.label}`}
                style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.lensBlue, padding: "2px", display: "flex" }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {addingCriterion ? (
            <input
              autoFocus
              value={criterionDraft}
              onChange={(e) => setCriterionDraft(e.target.value)}
              onBlur={submitCriterion}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCriterion();
                if (e.key === "Escape") {
                  setCriterionDraft("");
                  setAddingCriterion(false);
                }
              }}
              placeholder="novo critério"
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10.5px",
                border: `1.5px solid ${COLORS.screenBorder}`,
                borderRadius: "999px",
                padding: "4px 10px",
                width: "110px",
                outline: "none",
              }}
            />
          ) : (
            <button
              onClick={() => setAddingCriterion(true)}
              className="flex items-center gap-1"
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10.5px",
                color: COLORS.screenBorder,
                background: "transparent",
                border: `1.5px dashed ${COLORS.screenBorder}`,
                borderRadius: "999px",
                padding: "3px 10px",
                cursor: "pointer",
              }}
            >
              <Plus size={11} /> Critério
            </button>
          )}
        </div>
      </div>

      {/* Efeito combinado */}
      {hasCriteria && (
        <div
          style={{
            background: COLORS.surface,
            border: `2px solid ${COLORS.screenBorder}`,
            borderRadius: "10px",
            padding: "10px 12px",
            marginBottom: "14px",
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
            <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>
              Efeito combinado ({activeItems.length} ativo{activeItems.length === 1 ? "" : "s"})
            </span>
            {profile.criteria.length > 0 && (
              <button
                onClick={() => setShowSuggestions((s) => !s)}
                className="flex items-center gap-1"
                style={{
                  background: "none",
                  border: `1.5px solid ${COLORS.lensBlue}`,
                  borderRadius: "999px",
                  color: COLORS.lensBlue,
                  fontFamily: '"Baloo 2", sans-serif',
                  fontWeight: 700,
                  fontSize: "10.5px",
                  padding: "3px 9px",
                  cursor: "pointer",
                }}
              >
                <Target size={11} /> Sugerir
              </button>
            )}
          </div>
          <div className="flex" style={{ flexWrap: "wrap", gap: "6px" }}>
            {profile.criteria.map((c) => {
              const total = totals[c.id] || 0;
              const color = total > 0 ? "var(--success)" : total < 0 ? "var(--danger)" : "var(--text-muted)";
              return (
                <span
                  key={c.id}
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "11px",
                    fontWeight: 700,
                    color,
                    border: `1.5px solid ${color}`,
                    borderRadius: "999px",
                    padding: "3px 10px",
                  }}
                >
                  {c.label}: {total > 0 ? `+${total}` : total}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {showSuggestions && hasCriteria && (
        <EffectSuggestionsPanel
          profile={profile}
          activeItems={activeItems}
          onAddSuggestion={addSuggestionToProfile}
          onClose={() => setShowSuggestions(false)}
        />
      )}

      {/* Adicionar item */}
      <div
        style={{
          background: "rgba(255,201,71,0.15)",
          border: `2px solid ${COLORS.gold}`,
          borderRadius: "10px",
          padding: "10px 12px",
          marginBottom: "14px",
        }}
      >
        {!rating ? (
          <>
            <div className="flex gap-2">
              <input
                value={itemNameDraft}
                onChange={(e) => setItemNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") startRating();
                }}
                placeholder="Nome do item (ex.: Cafeína, Puxada alta...)"
                style={{
                  flex: 1,
                  minWidth: 0,
                  borderRadius: "8px",
                  border: `1.5px solid ${COLORS.screenBorder}`,
                  padding: "8px 10px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12.5px",
                  background: COLORS.surface,
                  color: COLORS.ink,
                  outline: "none",
                }}
              />
              <button
                onClick={startRating}
                disabled={ratingLoading || !itemNameDraft.trim() || !hasCriteria}
                className="flex items-center gap-1.5"
                style={{
                  background: COLORS.gold,
                  color: "#4A3300",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0 12px",
                  fontFamily: '"Baloo 2", sans-serif',
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: ratingLoading || !itemNameDraft.trim() || !hasCriteria ? "default" : "pointer",
                  opacity: ratingLoading || !itemNameDraft.trim() || !hasCriteria ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                {ratingLoading ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={14} />}
                Avaliar
              </button>
            </div>
            {!hasCriteria && (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                Adicione ao menos um critério antes de adicionar itens.
              </p>
            )}
            {hasCriteria && itemNameDraft.trim() && (
              <button
                onClick={startManualRating}
                style={{ background: "none", border: "none", color: COLORS.lensBlue, fontFamily: "Inter, sans-serif", fontSize: "11px", cursor: "pointer", marginTop: "6px", padding: 0 }}
              >
                ...ou avaliar manualmente, sem IA
              </button>
            )}
            {ratingError && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{ratingError}</p>}
          </>
        ) : (
          <div>
            <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "13px", color: COLORS.ink, marginBottom: "8px" }}>
              {rating.name}
            </div>
            {profile.criteria.map((c) => (
              <EffectRatingBar
                key={c.id}
                label={c.label}
                value={rating.values[c.id]}
                editable
                onChange={(v) => setRating((r) => ({ ...r, values: { ...r.values, [c.id]: v } }))}
              />
            ))}
            <div className="flex gap-2" style={{ marginTop: "8px" }}>
              <button onClick={saveRating} style={{ ...primaryButtonStyle, flex: 1, minHeight: "36px" }}>
                Salvar no perfil
              </button>
              <button
                onClick={() => setRating(null)}
                style={{ ...primaryButtonStyle, background: "transparent", color: COLORS.ink, border: `2px solid ${COLORS.screenBorder}`, minHeight: "36px" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Itens */}
      {profile.items.length === 0 && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text-muted)", textAlign: "center", marginTop: "20px" }}>
          Nenhum item ainda. Adicione o primeiro acima.
        </p>
      )}
      {profile.items.map((item) => (
        <div
          key={item.id}
          style={{
            background: COLORS.surface,
            border: `2px solid ${item.active ? COLORS.screenBorder : "var(--text-faint)"}`,
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "10px",
            opacity: item.active ? 1 : 0.55,
          }}
        >
          <div className="flex items-start justify-between gap-2" style={{ marginBottom: "8px" }}>
            <button
              onClick={() => onToggleItemActive(profile.id, item.id)}
              className="flex items-center gap-2"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
              aria-label={item.active ? `Desativar ${item.name}` : `Ativar ${item.name}`}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "5px",
                  border: `2px solid ${item.active ? "var(--success)" : COLORS.screenBorder}`,
                  background: item.active ? "var(--success)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {item.active && <Check size={12} color="#fff" strokeWidth={3} />}
              </div>
              <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "14px", color: COLORS.ink }}>{item.name}</span>
            </button>
            <button
              onClick={() => onRemoveItem(profile.id, item.id)}
              aria-label={`Remover ${item.name}`}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", flexShrink: 0 }}
            >
              <Trash2 size={14} />
            </button>
          </div>
          {profile.criteria.map((c) => (
            <EffectRatingBar
              key={c.id}
              label={c.label}
              value={item.ratings ? item.ratings[c.id] : 0}
              editable
              onChange={(v) => onUpdateItemRating(profile.id, item.id, c.id, v)}
            />
          ))}
          <NoteEditor note={item.note} onChange={(note) => onUpdateItemNote(profile.id, item.id, note)} />
        </div>
      ))}
    </div>
  );
}
