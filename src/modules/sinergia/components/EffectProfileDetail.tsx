import { useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowUpWideNarrow,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Layers,
  Loader2,
  Maximize2,
  Pencil,
  Search,
  Shield,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { COLORS } from "../../../theme";
import {
  fetchItemRatingsCached,
  fetchItemRatingsForVariantsCached,
  countUncachedCriteria,
  fetchCounterbalanceSuggestions,
  fetchSimilarEffectSuggestions,
  fetchPairInteraction,
} from "../lib/effectsApi";
import { MissingApiKeyError } from "../lib/anthropic";
import {
  combinedMax,
  computeCombinedEffect,
  computeItemBenefitPerCost,
  computeItemScore,
  computeScenarioTotals,
  computeWeightedTotal,
  computeSecondOrderEffects,
  costSummary,
  currentRatings,
  currentOriginalRatings,
  currentRatingMeta,
  isCriterionRated,
  negativeOrNullCriteria,
  pairKey,
  scorePercent,
  snapshotScenario,
  strongPositiveCriteria,
  parseItemNameVariants,
} from "../lib/effectProfiles";
import { buildProfileBackup, downloadBackup } from "../lib/backup";
import { useBatchRun } from "../state/useBatchRun";
import EffectRatingBar from "./EffectRatingBar";
import BatchConfirm from "./BatchConfirm";
import CriteriaBoard from "./CriteriaBoard";
import CheckInPanel from "./CheckInPanel";
import EffectSuggestionsPanel from "./EffectSuggestionsPanel";
import ItemDetailPage from "./ItemDetailPage";
import CriteriaLinksPanel from "./CriteriaLinksPanel";
import DiagnosisPanel from "./DiagnosisPanel";
import CausalMapView from "./CausalMapView";

const TABS = [
  { key: "geral", label: "Geral" },
  { key: "diagnostico", label: "Diagnóstico e Planejamento" },
  { key: "outros", label: "Outros" },
];

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

function sectionTitle(text: string) {
  return (
    <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink, marginBottom: "6px" }}>{text}</div>
  );
}

/**
 * As duas sugestões de um item (contrabalançar / parecidos), sempre na mesma
 * linha, funcionando como toggle entre si: abrir uma esconde a outra, abrir
 * a que já está aberta fecha as duas. Cada uma busca só na primeira vez —
 * depois disso o resultado fica em cache neste componente (que não desmonta
 * ao trocar de aba, só o que é exibido muda).
 */
function ItemSuggestionsRow({ item, profile, onAddByName }: any) {
  const [activeKind, setActiveKind] = useState<string | null>(null); // null | "counter" | "similar"
  const [cache, setCache] = useState<any>({ counter: null, similar: null });
  const [loadingKind, setLoadingKind] = useState<string | null>(null);
  const [errors, setErrors] = useState<any>({ counter: null, similar: null });
  const [addedNames, setAddedNames] = useState<any>({ counter: [], similar: [] });
  const [addingNames, setAddingNames] = useState<any>({ counter: [], similar: [] });

  async function handleClick(kind: string) {
    if (activeKind === kind) {
      setActiveKind(null);
      return;
    }
    setActiveKind(kind);
    if (cache[kind] || loadingKind === kind) return;
    setLoadingKind(kind);
    setErrors((prev: any) => ({ ...prev, [kind]: null }));
    try {
      const isCounter = kind === "counter";
      const criteria = isCounter ? negativeOrNullCriteria(item, profile.criteria) : strongPositiveCriteria(item, profile.criteria);
      const fn = isCounter ? fetchCounterbalanceSuggestions : fetchSimilarEffectSuggestions;
      const result = await fn(profile.name, item.name, criteria);
      setCache((prev: any) => ({ ...prev, [kind]: result }));
    } catch (err: any) {
      setErrors((prev: any) => ({
        ...prev,
        [kind]: err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível gerar sugestões agora.",
      }));
    } finally {
      setLoadingKind(null);
    }
  }

  async function pick(kind: string, name: string) {
    if (addedNames[kind].includes(name) || addingNames[kind].includes(name)) return;
    setAddingNames((prev: any) => ({ ...prev, [kind]: [...prev[kind], name] }));
    try {
      await onAddByName(name);
      setAddedNames((prev: any) => ({ ...prev, [kind]: [...prev[kind], name] }));
    } catch {
      /* a pílula fica pronta pra tentar de novo */
    } finally {
      setAddingNames((prev: any) => ({ ...prev, [kind]: prev[kind].filter((n: string) => n !== name) }));
    }
  }

  const kinds = [
    { key: "counter", Icon: Shield, label: "Contrabalançar", aria: `Sugerir itens que contrabalancem ${item.name}` },
    { key: "similar", Icon: Copy, label: "Parecidos", aria: `Sugerir itens parecidos com ${item.name}` },
  ];

  return (
    <div style={{ marginTop: "6px" }}>
      <div className="flex items-center gap-2" style={{ flexWrap: "nowrap" }}>
        {kinds.map(({ key, Icon, label, aria }) => {
          const active = activeKind === key;
          return (
            <button
              key={key}
              onClick={() => handleClick(key)}
              className="flex items-center justify-center gap-1"
              aria-label={aria}
              aria-pressed={active}
              style={{
                flex: 1,
                minWidth: 0,
                background: active ? "rgba(46,134,222,0.12)" : "none",
                border: `1.5px solid ${active ? COLORS.lensBlue : COLORS.screenBorder}`,
                borderRadius: "999px",
                color: active ? COLORS.lensBlue : COLORS.ink,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10px",
                padding: "3px 6px",
                cursor: "pointer",
              }}
            >
              {loadingKind === key ? <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} /> : <Icon size={11} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            </button>
          );
        })}
      </div>
      {activeKind && (
        <div style={{ marginTop: "6px" }}>
          {errors[activeKind] && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--danger)" }}>{errors[activeKind]}</p>}
          {cache[activeKind] && cache[activeKind].length === 0 && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text-muted)" }}>Nenhuma sugestão desta vez.</p>
          )}
          {cache[activeKind] && cache[activeKind].length > 0 && (
            <div className="flex" style={{ flexWrap: "wrap", gap: "5px" }}>
              {cache[activeKind].map((s: any, i: number) => {
                const added = addedNames[activeKind].includes(s.name);
                const adding = addingNames[activeKind].includes(s.name);
                return (
                  <button
                    key={s.name + i}
                    onClick={() => pick(activeKind, s.name)}
                    disabled={added || adding}
                    title={s.reason}
                    className="flex items-center gap-1"
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: "10px",
                      color: added ? "var(--success)" : COLORS.lensBlue,
                      background: COLORS.surface,
                      border: `1.5px solid ${added ? "var(--success)" : COLORS.lensBlue}`,
                      borderRadius: "999px",
                      padding: "3px 9px",
                      cursor: added || adding ? "default" : "pointer",
                    }}
                  >
                    {adding ? <Loader2 size={10} style={{ animation: "spin 0.9s linear infinite" }} /> : added ? <Check size={10} /> : "+"}
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EffectProfileDetail({
  profile,
  onBack,
  onOpenInCognidex,
  onRenameProfile,
  onDeleteProfile,
  onAddCriterion,
  onRenameCriterion,
  onSetCriterionWeight,
  onSetCriterionHidden,
  onRemoveCriterion,
  onSetProfileSaturation,
  onAddItem,
  onRenameItem,
  onRemoveItem,
  onToggleItemActive,
  onSetItemHidden,
  onUpdateItemRating,
  onFillCriterionForItem,
  onUpdateItemNote,
  onSetItemVariant,
  onCacheItemExplain,
  onSetInteraction,
  onRemoveInteraction,
  onSetRatingMeta,
  onSetCriterionLink,
  onRemoveCriterionLink,
  onSetItemProtocol,
  onSetItemIndicators,
  onSetItemCost,
  onAddCheckIn,
  onRemoveCheckIn,
}: any) {
  const [tab, setTab] = useState("geral");

  const [renamingProfile, setRenamingProfile] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState(profile.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [fillingCriterionId, setFillingCriterionId] = useState<string | null>(null);

  const [itemNameDraft, setItemNameDraft] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const [sortCriterionId, setSortCriterionId] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [sortMode, setSortMode] = useState(""); // "" | "score" | "ratio" | criterionId

  const [searchTerm, setSearchTerm] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [itemRenameDraft, setItemRenameDraft] = useState("");

  const [scenarioA, setScenarioA] = useState<any>(null);

  const [causalMapCriterionId, setCausalMapCriterionId] = useState<string | null>(null);

  const batch = useBatchRun();

  const hasCriteria = profile.criteria.length > 0;
  const activeItems = profile.items.filter((it: any) => it.active);
  const totals = computeCombinedEffect(profile);
  const weightedTotal = computeWeightedTotal(profile);
  const combinedMaxValue = combinedMax(profile);
  const secondOrderTotals = computeSecondOrderEffects(profile, totals);
  const visibleCriteria = profile.criteria.filter((c: any) => !c.hidden);
  const scenarioATotals = scenarioA ? computeScenarioTotals(profile, scenarioA) : null;
  const interactionsList = Object.entries(profile.interactions || {}).map(([key, inter]: [string, any]) => {
    const itemA = profile.items.find((it: any) => it.id === inter.itemAId);
    const itemB = profile.items.find((it: any) => it.id === inter.itemBId);
    return { key, ...inter, itemA, itemB };
  });

  function requestDelete() {
    if (confirmingDelete) {
      onDeleteProfile(profile.id);
      onBack();
    } else {
      setConfirmingDelete(true);
    }
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

  function submitRenameProfile() {
    const clean = profileNameDraft.trim();
    if (clean) onRenameProfile(profile.id, clean);
    else setProfileNameDraft(profile.name);
    setRenamingProfile(false);
  }

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

  function toggleScenarioA() {
    setScenarioA(scenarioA ? null : snapshotScenario(profile));
  }

  /** Interações entre todos os pares de itens ativos ainda não avaliados — O(n²) chamadas, agora com aviso e cancelamento. */
  function detectInteractions() {
    if (activeItems.length < 2) return;
    const labels = profile.criteria.map((c: any) => c.label);
    const pairs: any[] = [];
    for (let i = 0; i < activeItems.length; i++) {
      for (let j = i + 1; j < activeItems.length; j++) {
        const key = pairKey(activeItems[i].id, activeItems[j].id);
        if (!(profile.interactions || {})[key]) pairs.push([activeItems[i], activeItems[j], key]);
      }
    }
    if (!pairs.length) return;

    batch.request({
      label: `Avaliar ${pairs.length} par(es) de itens ativos`,
      units: pairs.length,
      calls: pairs.length,
      kind: "interaction",
      run: async (step: () => void, isCancelled: () => boolean) => {
        let failures = 0;
        for (const [itemA, itemB, key] of pairs) {
          if (isCancelled()) break;
          try {
            // eslint-disable-next-line no-await-in-loop
            const result = await fetchPairInteraction(profile.name, itemA.name, itemB.name, labels);
            const adjustments: any = {};
            const reasonsMap: any = {};
            profile.criteria.forEach((c: any, ci: number) => {
              const found = result.find((r: any) => r.criterion === c.label) || result[ci];
              const v = found ? Math.max(-2, Math.min(2, Math.round(found.value))) : 0;
              if (v !== 0) {
                adjustments[c.id] = v;
                reasonsMap[c.id] = found?.reason || "";
              }
            });
            onSetInteraction(profile.id, key, itemA.id, itemB.id, adjustments, reasonsMap);
          } catch {
            failures++;
          }
          step();
        }
        if (failures) throw new Error(`${failures} par(es) não puderam ser avaliados agora.`);
      },
    });
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

  async function addSuggestionToProfile(suggestion: any) {
    if (suggestion.kind === "substituicao" && suggestion.replaces) {
      const target = profile.items.find((it: any) => it.name.toLowerCase() === suggestion.replaces.toLowerCase());
      if (target) onRemoveItem(profile.id, target.id);
    }
    const ratings: any = {};
    (suggestion.targetCriteria || []).forEach((c: any, i: number) => {
      ratings[c.id] = suggestion.estimatedRatings ? suggestion.estimatedRatings[i] : 0;
    });
    onAddItem(profile.id, { name: suggestion.name, variantLabels: [], ratings: [ratings], reasons: [{}], aiEvaluated: [true] });
  }

  const openItem = openItemId ? profile.items.find((it: any) => it.id === openItemId) : null;
  if (openItem) {
    return (
      <ItemDetailPage
        item={openItem}
        profile={profile}
        onBack={() => setOpenItemId(null)}
        onRenameItem={(name: string) => onRenameItem(profile.id, openItem.id, name)}
        onUpdateItemNote={(note: string) => onUpdateItemNote(profile.id, openItem.id, note)}
        onUpdateItemRating={(critId: string, value: number) => onUpdateItemRating(profile.id, openItem.id, critId, value)}
        onSetItemVariant={(idx: number) => onSetItemVariant(profile.id, openItem.id, idx)}
        onCacheItemExplain={(critId: string, kind: string, text: string) => onCacheItemExplain(profile.id, openItem.id, critId, kind, text)}
        onSetItemProtocol={(protocol: any) => onSetItemProtocol(profile.id, openItem.id, protocol)}
        onSetItemCost={(cost: any) => onSetItemCost(profile.id, openItem.id, cost)}
      />
    );
  }

  if (causalMapCriterionId) {
    return <CausalMapView profile={profile} criterionId={causalMapCriterionId} onBack={() => setCausalMapCriterionId(null)} />;
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
        {renamingProfile ? (
          <input
            autoFocus
            value={profileNameDraft}
            onChange={(e) => setProfileNameDraft(e.target.value)}
            onBlur={submitRenameProfile}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRenameProfile();
              if (e.key === "Escape") {
                setProfileNameDraft(profile.name);
                setRenamingProfile(false);
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
            onClick={() => setRenamingProfile(true)}
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
      <div
        className="flex gap-1"
        style={{ background: "rgba(120,120,120,0.15)", borderRadius: "8px", padding: "3px", marginBottom: "12px" }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
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

      {tab === "geral" && (
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
            onOpenCausalMap={setCausalMapCriterionId}
            onToggleSaturation={(value: boolean) => onSetProfileSaturation(profile.id, value)}
          />

          <BatchConfirm batch={batch} />

          {/* Adicionar item — avaliado (IA ou manual), já salvo direto no perfil */}
          <div
            style={{
              background: "rgba(255,201,71,0.15)",
              border: `2px solid ${COLORS.gold}`,
              borderRadius: "10px",
              padding: "10px 12px",
              margin: "10px 0",
            }}
          >
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
                      <span
                        title="Pontuação ponderada pelos pesos dos critérios"
                        style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px", fontWeight: 700, color: "var(--text-muted)" }}
                      >
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
                    <button
                      onClick={() => setOpenItemId(item.id)}
                      aria-label={`Abrir página de ${item.name}`}
                      style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.ink }}
                    >
                      <Maximize2 size={14} />
                    </button>
                    <button
                      onClick={() => onRemoveItem(profile.id, item.id)}
                      aria-label={`Remover ${item.name}`}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}
                    >
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
                      style={{
                        background: COLORS.surface,
                        border: `1.5px solid ${COLORS.screenBorder}`,
                        borderRadius: "8px",
                        padding: "6px 10px",
                        marginBottom: "5px",
                        opacity: 0.75,
                      }}
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
      )}

      {tab === "diagnostico" && (
        <>
          <CheckInPanel profile={profile} onAddCheckIn={(observed: any, note: string) => onAddCheckIn(profile.id, observed, note)} onRemoveCheckIn={(id: string) => onRemoveCheckIn(profile.id, id)} />
          <DiagnosisPanel
            profile={profile}
            onAddItem={onAddItem}
            onAddCriterion={onAddCriterion}
            onFillCriterionForItem={onFillCriterionForItem}
            onSetRatingMeta={onSetRatingMeta}
            onSetCriterionLink={onSetCriterionLink}
            onSetItemProtocol={onSetItemProtocol}
            onSetItemIndicators={onSetItemIndicators}
            onUpdateItemNote={onUpdateItemNote}
          />
          {hasCriteria && <CriteriaLinksPanel profile={profile} onSetCriterionLink={onSetCriterionLink} onRemoveCriterionLink={onRemoveCriterionLink} />}
        </>
      )}

      {tab === "outros" && (
        <>
          {hasCriteria && (
            <EffectSuggestionsPanel
              profile={profile}
              activeItems={activeItems.map((it: any) => ({ name: it.name, ratings: currentRatings(it) }))}
              onAddSuggestion={addSuggestionToProfile}
            />
          )}

          {/* Cenários A/B — congela a seleção ativa atual como Cenário A pra comparar com o que você for montando depois */}
          <div style={{ marginBottom: "14px" }}>
            {sectionTitle("Cenários A/B")}
            <button
              onClick={toggleScenarioA}
              className="flex items-center gap-1.5"
              style={{
                background: "none",
                border: `1.5px solid ${scenarioA ? COLORS.lensBlue : COLORS.screenBorder}`,
                borderRadius: "999px",
                color: scenarioA ? COLORS.lensBlue : COLORS.ink,
                fontFamily: "Inter, sans-serif",
                fontSize: "10.5px",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              <Layers size={11} />
              {scenarioA ? "Limpar cenário A" : "Fixar seleção atual como Cenário A"}
            </button>

            {scenarioA && (
              <div style={{ marginTop: "8px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px" }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", textAlign: "right" }}>
                      <th style={{ textAlign: "left", fontWeight: 400 }}>Critério</th>
                      <th style={{ fontWeight: 400 }}>A</th>
                      <th style={{ fontWeight: 400 }}>B (atual)</th>
                      <th style={{ fontWeight: 400 }}>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCriteria.map((c: any) => {
                      const a = (scenarioATotals as any)[c.id] || 0;
                      const b = (totals as any)[c.id] || 0;
                      const delta = Math.round((b - a) * 10) / 10;
                      const deltaColor = delta > 0 ? "var(--success)" : delta < 0 ? "var(--danger)" : "var(--text-muted)";
                      return (
                        <tr key={c.id} style={{ borderTop: `1px solid ${COLORS.screenBorder}` }}>
                          <td style={{ padding: "3px 0", fontFamily: "Inter, sans-serif", color: COLORS.ink }}>{c.label}</td>
                          <td style={{ textAlign: "right", color: "var(--text-muted)" }}>{a > 0 ? `+${a}` : a}</td>
                          <td style={{ textAlign: "right", color: COLORS.ink }}>{b > 0 ? `+${b}` : b}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: deltaColor }}>{delta > 0 ? `+${delta}` : delta}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Ative/desative itens na aba Geral pra montar o Cenário B e comparar com o A congelado.
                </p>
              </div>
            )}
          </div>

          {/* Interações entre itens ativos — sinergia/antagonismo além da soma simples */}
          <div style={{ marginBottom: "14px" }}>
            {sectionTitle("Interações entre itens ativos")}
            <button
              onClick={detectInteractions}
              disabled={activeItems.length < 2 || !!batch.progress}
              className="flex items-center gap-1.5"
              aria-label="Detectar interações entre os itens ativos"
              style={{
                background: "none",
                border: `1.5px solid ${COLORS.screenBorder}`,
                borderRadius: "999px",
                color: COLORS.ink,
                fontFamily: "Inter, sans-serif",
                fontSize: "10.5px",
                padding: "4px 10px",
                cursor: activeItems.length < 2 || batch.progress ? "default" : "pointer",
                opacity: activeItems.length < 2 || batch.progress ? 0.6 : 1,
              }}
            >
              {batch.progress ? <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} /> : <Zap size={11} />}
              Detectar interações ({activeItems.length} ativo{activeItems.length === 1 ? "" : "s"})
            </button>
            <BatchConfirm batch={batch} />
            {interactionsList.length > 0 && (
              <div className="flex flex-col gap-1" style={{ marginTop: "8px" }}>
                {interactionsList.map(({ key, itemA, itemB, adjustments, reasons }: any) => {
                  if (!itemA || !itemB) return null;
                  const parts = Object.entries(adjustments || {})
                    .map(([critId, v]: [string, any]) => {
                      const c = profile.criteria.find((cr: any) => cr.id === critId);
                      return c ? `${c.label} ${v > 0 ? "+" : ""}${v}` : null;
                    })
                    .filter(Boolean);
                  const reasonText = Object.values(reasons || {})[0];
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-2"
                      style={{
                        background: "rgba(46,134,222,0.08)",
                        border: `1.5px solid ${COLORS.lensBlue}`,
                        borderRadius: "8px",
                        padding: "5px 8px",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "11px", color: COLORS.ink }}>
                          {itemA.name} × {itemB.name}
                        </div>
                        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {parts.length ? parts.join(" · ") : "sem ajuste"}
                        </div>
                        {reasonText ? <div style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--text)", marginTop: "2px" }}>{reasonText as string}</div> : null}
                      </div>
                      <button
                        onClick={() => onRemoveInteraction(profile.id, key)}
                        aria-label={`Remover interação entre ${itemA.name} e ${itemB.name}`}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginBottom: "14px" }}>
            {sectionTitle("Exportar")}
            <button
              onClick={() => downloadBackup(buildProfileBackup(profile), profile.name)}
              className="flex items-center gap-1.5"
              style={{
                background: "none",
                border: `1.5px solid ${COLORS.screenBorder}`,
                borderRadius: "999px",
                color: COLORS.ink,
                fontFamily: "Inter, sans-serif",
                fontSize: "10.5px",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              <Download size={11} /> Exportar só este perfil
            </button>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
              Gera um arquivo com este perfil só. Na importação (Configurações) dá pra mesclar sem tocar nos outros.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
