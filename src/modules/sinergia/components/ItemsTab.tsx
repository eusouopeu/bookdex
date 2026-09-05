import { useState } from "react";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Check, ChevronDown, ChevronUp, Eye, Loader2, Maximize2, Pencil, Search, Sparkles, Trash2, X } from "lucide-react";
import { COLORS } from "../../../theme";
import { fetchItemRatingsCached, fetchItemRatingsForVariantsCached, countUncachedCriteria } from "../lib/effectsApi";
import { MissingApiKeyError } from "../lib/anthropic";
import {
  combinedMax,
  computeCombinedEffect,
  computeItemBenefitPerCost,
  computeItemScore,
  computeSecondOrderEffects,
  computeWeightedTotal,
  costSummary,
  currentRatings,
  currentOriginalRatings,
  currentRatingMeta,
  isCriterionRated,
  scorePercent,
  parseItemNameVariants,
} from "../lib/effectProfiles";
import CriteriaBoard from "./CriteriaBoard";
import BatchConfirm from "./BatchConfirm";
import EffectRatingBar from "./EffectRatingBar";
import ItemSuggestionsRow from "./ItemSuggestionsRow";

const selectStyle = {
  flex: 1,
  minWidth: 0,
  borderRadius: "8px",
  border: `1.5px solid ${COLORS.screenBorder}`,
  padding: "7px 8px",
  fontFamily: "Inter, sans-serif",
  fontSize: "12px",
  background: COLORS.surface,
  color: COLORS.ink,
  outline: "none",
};

const sortIconButtonStyle = (disabled: boolean) => ({
  width: "32px",
  height: "32px",
  flexShrink: 0,
  borderRadius: "8px",
  border: `1.5px solid ${COLORS.screenBorder}`,
  background: "transparent",
  color: COLORS.ink,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.4 : 1,
});

/**
 * Aba "Geral": placar de critérios, adicionar item (avaliado por IA ou
 * manual), busca/filtro/ordenação e a lista de itens em si. Era metade do
 * `EffectProfileDetail.tsx` original — extraído porque é a única parte que
 * de fato precisa de todo esse estado (rascunho de item, busca, ordenação,
 * renomeação de item), nada disso é usado pelas outras abas.
 */
export default function ItemsTab({
  profile,
  batch,
  onAddCriterion,
  onRenameCriterion,
  onSetCriterionWeight,
  onSetCriterionHidden,
  onRemoveCriterion,
  onSetProfileSaturation,
  onOpenCausalMap,
  onAddItem,
  onRenameItem,
  onRemoveItem,
  onToggleItemActive,
  onSetItemHidden,
  onSetItemVariant,
  onFillCriterionForItem,
  onSetRatingMeta,
  onOpenItem,
}: {
  profile: any;
  batch: any;
  onAddCriterion: (profileId: string, label: string) => void;
  onRenameCriterion: (profileId: string, id: string, label: string) => void;
  onSetCriterionWeight: (profileId: string, id: string, weight: number) => void;
  onSetCriterionHidden: (profileId: string, id: string, hidden: boolean) => void;
  onRemoveCriterion: (profileId: string, id: string) => void;
  onSetProfileSaturation: (profileId: string, value: boolean) => void;
  onOpenCausalMap: (criterionId: string) => void;
  onAddItem: (profileId: string, payload: any) => void;
  onRenameItem: (profileId: string, itemId: string, name: string) => void;
  onRemoveItem: (profileId: string, itemId: string) => void;
  onToggleItemActive: (profileId: string, itemId: string) => void;
  onSetItemHidden: (profileId: string, itemId: string, hidden: boolean) => void;
  onSetItemVariant: (profileId: string, itemId: string, index: number) => void;
  onFillCriterionForItem: (profileId: string, itemId: string, variantIndex: number, criterionId: string, value: number, reason: string) => void;
  onSetRatingMeta: (profileId: string, itemId: string, criterionId: string, meta: any, variantIndex?: number) => void;
  onOpenItem: (itemId: string) => void;
}) {
  const [fillingCriterionId, setFillingCriterionId] = useState<string | null>(null);
  const [itemNameDraft, setItemNameDraft] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const [sortCriterionId, setSortCriterionId] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [sortMode, setSortMode] = useState(""); // "" | "score" | "ratio" | criterionId

  const [searchTerm, setSearchTerm] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const [showHidden, setShowHidden] = useState(false);
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [itemRenameDraft, setItemRenameDraft] = useState("");

  const hasCriteria = profile.criteria.length > 0;
  const activeItems = profile.items.filter((it: any) => it.active);
  const totals = computeCombinedEffect(profile);
  const weightedTotal = computeWeightedTotal(profile);
  const combinedMaxValue = combinedMax(profile);
  const secondOrderTotals = computeSecondOrderEffects(profile, totals);
  const visibleCriteria = profile.criteria.filter((c: any) => !c.hidden);

  /** Itens (e variantes) SEM nota nesse critério — sobra de quando o critério foi criado depois deles. */
  function itemsMissingCriterion(criterionId: string) {
    const out: any[] = [];
    for (const item of profile.items) {
      const count = item.ratings.length;
      for (let variantIndex = 0; variantIndex < count; variantIndex++) {
        if (!(criterionId in (item.ratings[variantIndex] || {}))) {
          out.push({ item, variantIndex });
        }
      }
    }
    return out;
  }

  function variantName(item: any, variantIndex: number) {
    return item.variantLabels?.[variantIndex] ? `${item.name} (${item.variantLabels[variantIndex]})` : item.name;
  }

  /** Preenche o critério nos itens que estão sem nota nele — com custo estimado antes, progresso e cancelamento. */
  async function fillMissingCriterion(criterion: any) {
    const missing = itemsMissingCriterion(criterion.id);
    if (!missing.length || fillingCriterionId) return;

    const uncached = await Promise.all(missing.map(({ item, variantIndex }) => countUncachedCriteria(variantName(item, variantIndex), [criterion.label])));
    const calls = uncached.reduce((a, b) => a + b, 0);

    batch.request({
      label: `Avaliar ${missing.length} item(ns) em "${criterion.label}"`,
      units: missing.length,
      calls,
      kind: "rating",
      run: async (step: () => void, isCancelled: () => boolean) => {
        setFillingCriterionId(criterion.id);
        try {
          for (const { item, variantIndex } of missing) {
            if (isCancelled()) break;
            try {
              // eslint-disable-next-line no-await-in-loop
              const result = await fetchItemRatingsCached(variantName(item, variantIndex), profile.name, [criterion.label]);
              const found = result[0];
              onFillCriterionForItem(profile.id, item.id, variantIndex, criterion.id, found ? found.value : 0, found ? found.reason : "");
              if (found) onSetRatingMeta(profile.id, item.id, criterion.id, { probability: found.probability, confidence: found.confidence }, variantIndex);
            } catch {
              /* segue pros próximos — o item fica pra tentar de novo depois */
            }
            step();
          }
        } finally {
          setFillingCriterionId(null);
        }
      },
    });
  }

  /** Avalia (passando pelo cache global) e SALVA o item direto — sem tela de rascunho. */
  async function addItemByName(rawName: string) {
    const clean = (rawName || "").trim();
    if (!clean || !hasCriteria) return;
    const { base, variants } = parseItemNameVariants(clean);
    const labels = profile.criteria.map((c: any) => c.label);
    const count = variants.length || 1;
    const ratings: any[] = [];
    const reasons: any[] = [];
    const aiEvaluated: boolean[] = [];
    const ratingMeta: any[] = [];

    const resultsPerVariant = variants.length
      ? await fetchItemRatingsForVariantsCached(base, profile.name, labels, variants)
      : [await fetchItemRatingsCached(base, profile.name, labels)];

    for (let i = 0; i < count; i++) {
      const result = resultsPerVariant[i] || [];
      const values: any = {};
      const reas: any = {};
      const meta: any = {};
      profile.criteria.forEach((c: any, ci: number) => {
        const found = result.find((r: any) => r.criterion === c.label) || result[ci];
        values[c.id] = found ? found.value : 0;
        reas[c.id] = found ? found.reason : "";
        meta[c.id] = { probability: found?.probability, confidence: found?.confidence };
      });
      ratings.push(values);
      reasons.push(reas);
      aiEvaluated.push(true);
      ratingMeta.push(meta);
    }
    onAddItem(profile.id, { name: clean, variantLabels: variants, ratings, reasons, aiEvaluated, ratingMeta });
  }

  async function handleEvaluate() {
    const clean = itemNameDraft.trim();
    if (!clean) return;
    setRatingError(null);
    setRatingLoading(true);
    try {
      await addItemByName(clean);
      setItemNameDraft("");
    } catch (err: any) {
      setRatingError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível avaliar agora.");
    } finally {
      setRatingLoading(false);
    }
  }

  function handleManualAdd() {
    const clean = itemNameDraft.trim();
    if (!clean) return;
    const { variants } = parseItemNameVariants(clean);
    const count = variants.length || 1;
    const zeroRatings = () => Object.fromEntries(profile.criteria.map((c: any) => [c.id, 0]));
    onAddItem(profile.id, {
      name: clean,
      variantLabels: variants,
      ratings: Array.from({ length: count }, zeroRatings),
      reasons: Array.from({ length: count }, () => ({})),
      aiEvaluated: Array.from({ length: count }, () => false),
    });
    setItemNameDraft("");
    setRatingError(null);
  }

  const searchFiltered = profile.items.filter((item: any) => {
    if (onlyActive && !item.active) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    if (item.name.toLowerCase().includes(term)) return true;
    return (item.variantLabels || []).some((v: string) => v.toLowerCase().includes(term));
  });

  const filteredItems = searchFiltered.filter((item: any) => !item.hidden);
  const hiddenItems = searchFiltered.filter((item: any) => item.hidden);

  function sortValue(item: any) {
    if (sortMode === "score") return computeItemScore(item, profile.criteria);
    if (sortMode === "ratio") return computeItemBenefitPerCost(item, profile.criteria);
    return currentRatings(item)[sortCriterionId] || 0;
  }

  const sortedItems = sortMode
    ? [...filteredItems].sort((a, b) => (sortAsc ? sortValue(a) - sortValue(b) : sortValue(b) - sortValue(a)))
    : filteredItems;

  return (
    <>
      <CriteriaBoard
        profile={profile}
        totals={totals}
        combinedMaxValue={combinedMaxValue}
        weightedTotal={weightedTotal}
        scorePct={scorePercent(profile)}
        secondOrderTotals={secondOrderTotals}
        activeCount={activeItems.length}
        missingCountFor={(id: string) => itemsMissingCriterion(id).length}
        fillingCriterionId={fillingCriterionId}
        onFillMissing={fillMissingCriterion}
        onAddCriterion={(label: string) => onAddCriterion(profile.id, label)}
        onRenameCriterion={(id: string, label: string) => onRenameCriterion(profile.id, id, label)}
        onSetCriterionWeight={(id: string, weight: number) => onSetCriterionWeight(profile.id, id, weight)}
        onSetCriterionHidden={(id: string, hidden: boolean) => onSetCriterionHidden(profile.id, id, hidden)}
        onRemoveCriterion={(id: string) => onRemoveCriterion(profile.id, id)}
        onOpenCausalMap={onOpenCausalMap}
        onToggleSaturation={(value: boolean) => onSetProfileSaturation(profile.id, value)}
      />

      <BatchConfirm batch={batch} />

      {/* Adicionar item — avaliado (IA ou manual), já salvo direto no perfil */}
      <div style={{ background: "rgba(255,201,71,0.15)", border: `2px solid ${COLORS.gold}`, borderRadius: "10px", padding: "10px 12px", margin: "10px 0" }}>
        <div className="flex gap-2">
          <input
            value={itemNameDraft}
            onChange={(e) => setItemNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEvaluate();
            }}
            placeholder="Nome do item — ex.: Cafeína, Pushup (Aberto/Fechado)..."
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
            onClick={handleEvaluate}
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
            onClick={handleManualAdd}
            style={{ background: "none", border: "none", color: COLORS.lensBlue, fontFamily: "Inter, sans-serif", fontSize: "11px", cursor: "pointer", marginTop: "6px", padding: 0 }}
          >
            ...ou adicionar manualmente, sem IA (edite as notas depois)
          </button>
        )}
        {ratingError && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px" }}>{ratingError}</p>}
        {!itemNameDraft.includes("/") && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)", marginTop: "4px" }}>
            Dica: "Nome (VarianteA/VarianteB)" cria um item com uma tab por variante.
          </p>
        )}
      </div>

      {/* Busca e filtro */}
      {profile.items.length > 1 && (
        <div className="flex items-center gap-2" style={{ marginBottom: "8px" }}>
          <div className="flex items-center gap-1.5" style={{ flex: 1, minWidth: 0, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "6px 10px", background: COLORS.surface }}>
            <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar item..."
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "Inter, sans-serif", fontSize: "12px", color: COLORS.ink }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} aria-label="Limpar busca" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setOnlyActive((v) => !v)}
            aria-pressed={onlyActive}
            aria-label={onlyActive ? "Mostrando só ativos — tocar para mostrar todos" : "Mostrando todos — tocar para filtrar só ativos"}
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "10.5px",
              flexShrink: 0,
              color: onlyActive ? "#fff" : COLORS.ink,
              background: onlyActive ? "var(--success)" : "transparent",
              border: `1.5px solid ${onlyActive ? "var(--success)" : COLORS.screenBorder}`,
              borderRadius: "999px",
              padding: "0 10px",
              minHeight: "34px",
              cursor: "pointer",
            }}
          >
            Só ativos
          </button>
        </div>
      )}

      {/* Ordenação */}
      {profile.items.length > 1 && hasCriteria && (
        <div className="flex items-center gap-2" style={{ marginBottom: "14px" }}>
          <select
            value={sortMode === "criterion" ? sortCriterionId : sortMode === "score" ? "__score__" : sortMode === "ratio" ? "__ratio__" : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__score__") {
                setSortMode("score");
                setSortCriterionId("");
              } else if (v === "__ratio__") {
                setSortMode("ratio");
                setSortCriterionId("");
              } else if (!v) {
                setSortMode("");
                setSortCriterionId("");
              } else {
                setSortMode("criterion");
                setSortCriterionId(v);
              }
            }}
            style={selectStyle}
            aria-label="Ordenar itens"
          >
            <option value="">Ordem original</option>
            <option value="__score__">Ordenar por: Pontuação</option>
            <option value="__ratio__">Ordenar por: Custo-benefício</option>
            {profile.criteria.map((c: any) => (
              <option key={c.id} value={c.id}>
                Ordenar por: {c.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortAsc((s) => !s)}
            disabled={!sortMode}
            aria-label={sortAsc ? "Ordenando do menor para o maior — tocar para voltar ao padrão (maior para o menor)" : "Ordenando do maior para o menor — tocar para inverter"}
            style={sortIconButtonStyle(!sortMode)}
          >
            {sortAsc ? <ArrowUpWideNarrow size={15} /> : <ArrowDownWideNarrow size={15} />}
          </button>
        </div>
      )}

      {/* Itens */}
      {profile.items.length === 0 && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text-muted)", textAlign: "center", marginTop: "20px" }}>
          Nenhum item ainda. Adicione o primeiro acima.
        </p>
      )}
      {profile.items.length > 0 && sortedItems.length === 0 && hiddenItems.length === 0 && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text-muted)", textAlign: "center", marginTop: "20px" }}>
          Nenhum item corresponde à busca/filtro.
        </p>
      )}
      {sortedItems.map((item: any) => {
        const itemCurrent = currentRatings(item);
        const itemOriginal = currentOriginalRatings(item);
        const itemMeta = currentRatingMeta(item);
        const hasVariants = item.variantLabels && item.variantLabels.length > 0;
        const isRenamingThisItem = renamingItemId === item.id;
        const score = computeItemScore(item, profile.criteria);
        const cost = costSummary(item);
        return (
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
              {isRenamingThisItem ? (
                <input
                  autoFocus
                  value={itemRenameDraft}
                  onChange={(e) => setItemRenameDraft(e.target.value)}
                  onBlur={() => {
                    const clean = itemRenameDraft.trim();
                    if (clean) onRenameItem(profile.id, item.id, clean);
                    setRenamingItemId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenamingItemId(null);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: '"Baloo 2", sans-serif',
                    fontWeight: 700,
                    fontSize: "13px",
                    color: COLORS.ink,
                    border: `1.5px solid ${COLORS.screenBorder}`,
                    borderRadius: "6px",
                    padding: "3px 6px",
                    background: COLORS.surface,
                    outline: "none",
                  }}
                />
              ) : (
                <button
                  onClick={() => onToggleItemActive(profile.id, item.id)}
                  className="flex items-center gap-2"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", minWidth: 0 }}
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
                  <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "14px", color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </span>
                </button>
              )}
              <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                {hasCriteria && (
                  <span title="Pontuação ponderada pelos pesos dos critérios" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px", fontWeight: 700, color: "var(--text-muted)" }}>
                    {score > 0 ? `+${score}` : score}
                  </span>
                )}
                <button
                  onClick={() => {
                    setRenamingItemId(item.id);
                    setItemRenameDraft(item.name);
                  }}
                  aria-label={`Renomear ${item.name}`}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  <Pencil size={13} />
                </button>
                <button onClick={() => onOpenItem(item.id)} aria-label={`Abrir página de ${item.name}`} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.ink }}>
                  <Maximize2 size={14} />
                </button>
                <button onClick={() => onRemoveItem(profile.id, item.id)} aria-label={`Remover ${item.name}`} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {cost && (
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "9.5px", color: "var(--text-muted)", marginBottom: "6px" }}>
                {cost} · {computeItemBenefitPerCost(item, profile.criteria)} por unidade de custo
              </div>
            )}

            {hasVariants && (
              <div className="flex" style={{ flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
                {item.variantLabels.map((label: string, idx: number) => {
                  const active = (item.activeVariantIndex || 0) === idx;
                  return (
                    <button
                      key={label + idx}
                      onClick={() => onSetItemVariant(profile.id, item.id, idx)}
                      style={{
                        fontFamily: '"Baloo 2", sans-serif',
                        fontWeight: 700,
                        fontSize: "10.5px",
                        color: active ? "#4A3300" : COLORS.ink,
                        background: active ? COLORS.gold : "transparent",
                        border: `1.5px solid ${active ? COLORS.gold : COLORS.screenBorder}`,
                        borderRadius: "999px",
                        padding: "3px 10px",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {visibleCriteria.map((c: any) => {
              const rated = isCriterionRated(item, c.id);
              return (
                <EffectRatingBar
                  key={c.id}
                  label={c.label}
                  value={(itemCurrent as any)[c.id] || 0}
                  unrated={!rated}
                  originalValue={rated ? (itemOriginal as any)[c.id] ?? null : null}
                  probability={(itemMeta as any)[c.id]?.probability}
                  confidence={(itemMeta as any)[c.id]?.confidence}
                />
              );
            })}

            <ItemSuggestionsRow item={item} profile={profile} onAddByName={addItemByName} />
          </div>
        );
      })}

      {/* Itens desativados ficam ocultos automaticamente pra não atrapalhar a análise — seguem aqui, recolhidos, até você decidir desocultar */}
      {hiddenItems.length > 0 && (
        <div style={{ marginTop: "6px", marginBottom: "10px" }}>
          <button
            onClick={() => setShowHidden((s) => !s)}
            className="flex items-center gap-1.5"
            aria-expanded={showHidden}
            style={{
              background: "none",
              border: `1.5px dashed ${COLORS.screenBorder}`,
              borderRadius: "8px",
              color: "var(--text-muted)",
              fontFamily: "Inter, sans-serif",
              fontSize: "11.5px",
              padding: "6px 10px",
              width: "100%",
              cursor: "pointer",
            }}
          >
            {showHidden ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {hiddenItems.length} item(ns) desativado(s) e oculto(s)
          </button>
          {showHidden && (
            <div style={{ marginTop: "6px" }}>
              {hiddenItems.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2"
                  style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "6px 10px", marginBottom: "5px", opacity: 0.75 }}
                >
                  <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12.5px", color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </span>
                  <button
                    onClick={() => onSetItemHidden(profile.id, item.id, false)}
                    className="flex items-center gap-1"
                    aria-label={`Desocultar ${item.name}`}
                    style={{
                      background: "none",
                      border: `1.5px solid ${COLORS.lensBlue}`,
                      borderRadius: "999px",
                      color: COLORS.lensBlue,
                      fontFamily: "Inter, sans-serif",
                      fontSize: "10.5px",
                      padding: "3px 9px",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <Eye size={11} /> Mostrar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
